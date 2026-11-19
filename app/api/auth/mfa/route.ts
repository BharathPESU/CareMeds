import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { generateRecoveryCodes } from '@/lib/auth/recovery-codes';
import { getSessionContext } from '@/lib/auth/session';
import { buildTotpQrDataUrl, buildTotpUri, createTotpSecret, verifyTotpCode } from '@/lib/auth/totp';
import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { appendAuditLog, loadStore, persistStore } from '@/lib/store/repository';
import { z } from 'zod';

const confirmSchema = z.object({
  totpCode: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
});

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const store = loadStore();
  const user = store.users.find((u) => u.userId === ctx.user.userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (user.mfaEnabled && user.mfaSecretEncrypted) {
    return NextResponse.json({ alreadyEnrolled: true });
  }

  const secret = user.pendingMfaSecretEncrypted
    ? decryptSecret(user.pendingMfaSecretEncrypted)
    : createTotpSecret();

  if (!user.pendingMfaSecretEncrypted) {
    user.pendingMfaSecretEncrypted = encryptSecret(secret);
    persistStore(store);
  }

  const otpauthUri = buildTotpUri(user.username, secret);
  const qrDataUrl = await buildTotpQrDataUrl(otpauthUri);

  return NextResponse.json({
    alreadyEnrolled: false,
    totpSecret: secret,
    qrDataUrl,
  });
}

export async function POST(req: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const parsed = confirmSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid authenticator code' },
      { status: 400 }
    );
  }

  const store = loadStore();
  const user = store.users.find((u) => u.userId === ctx.user.userId);
  if (!user || !user.pendingMfaSecretEncrypted) {
    return NextResponse.json({ error: 'Start MFA enrollment before verifying.' }, { status: 400 });
  }

  const secret = decryptSecret(user.pendingMfaSecretEncrypted);
  if (!verifyTotpCode(parsed.data.totpCode, secret)) {
    return NextResponse.json(
      { error: 'The 6-digit code did not match. Check your device clock and try again.' },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  user.mfaEnabled = true;
  user.mfaSecretEncrypted = user.pendingMfaSecretEncrypted;
  user.pendingMfaSecretEncrypted = null;
  user.mfaEnrolledAt = nowIso;
  user.updatedAt = nowIso;

  // Replace any prior recovery codes with 10 fresh one-time codes
  store.mfaRecoveryCodes = store.mfaRecoveryCodes.filter((c) => c.userId !== user.userId);
  const { plainCodes, hashes } = generateRecoveryCodes(10);
  for (const h of hashes) {
    store.mfaRecoveryCodes.push({
      codeId: randomUUID(),
      userId: user.userId,
      codeHash: h,
      usedAt: null,
      createdAt: nowIso,
    });
  }

  appendAuditLog(store, {
    userId: user.userId,
    action: 'UPDATE',
    tableName: 'users',
    recordId: user.userId,
    newValues: { mfa_enabled: true, mfa_enrolled_at: nowIso },
  });
  persistStore(store);

  return NextResponse.json({ ok: true, recoveryCodes: plainCodes });
}
