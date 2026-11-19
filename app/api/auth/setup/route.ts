import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, validatePasswordRules } from '@/lib/auth/password';
import { generateRecoveryCodes } from '@/lib/auth/recovery-codes';
import { attachSessionCookies, createAuthenticatedSession } from '@/lib/auth/session';
import { buildTotpQrDataUrl, buildTotpUri, createTotpSecret, verifyTotpCode } from '@/lib/auth/totp';
import { decryptSecret, encryptSecret, safeCompare } from '@/lib/crypto';
import { appendAuditLog, loadStore, persistStore, toSafeUser } from '@/lib/store/repository';
import { setupAdminSchema } from '@/lib/validation/schemas';
import { z } from 'zod';

const confirmSetupSchema = z.object({
  setupToken: z.string().min(1),
  userId: z.string().min(1),
  totpCode: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit authenticator code'),
});

export async function GET() {
  const store = loadStore();
  const setupCompleted = store.systemSettings.setup_completed === 'true';
  return NextResponse.json({
    setupCompleted,
    hasSetupTokenConfigured: Boolean(process.env.SETUP_TOKEN),
  });
}

export async function POST(req: NextRequest) {
  const store = loadStore();
  if (store.systemSettings.setup_completed === 'true') {
    return NextResponse.json(
      { error: 'Initial administrator setup is already completed and permanently closed.' },
      { status: 403 }
    );
  }

  const expectedToken = process.env.SETUP_TOKEN;
  if (!expectedToken) {
    return NextResponse.json(
      { error: 'SETUP_TOKEN environment variable is not configured on the server.' },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));

  // Step 2: Confirm TOTP scan and issue 10 one-time recovery codes
  if (body && body.step === 'confirm_totp') {
    const parsed = confirmSetupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid code' }, { status: 400 });
    }
    if (!safeCompare(parsed.data.setupToken, expectedToken)) {
      return NextResponse.json({ error: 'Invalid setup token.' }, { status: 403 });
    }

    const user = store.users.find((u) => u.userId === parsed.data.userId && u.role === 'Admin');
    if (!user || !user.pendingMfaSecretEncrypted) {
      return NextResponse.json({ error: 'No pending MFA enrollment found.' }, { status: 404 });
    }

    const secret = decryptSecret(user.pendingMfaSecretEncrypted);
    if (!verifyTotpCode(parsed.data.totpCode, secret)) {
      return NextResponse.json({ error: 'Invalid 6-digit authenticator code. Try again.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    user.mfaEnabled = true;
    user.mfaSecretEncrypted = user.pendingMfaSecretEncrypted;
    user.pendingMfaSecretEncrypted = null;
    user.mfaEnrolledAt = nowIso;
    user.updatedAt = nowIso;

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

    store.systemSettings.setup_completed = 'true';
    appendAuditLog(store, {
      userId: user.userId,
      action: 'UPDATE',
      tableName: 'system_settings',
      recordId: 'setup_completed',
      oldValues: { setup_completed: 'false' },
      newValues: { setup_completed: 'true' },
    });
    persistStore(store);

    const { rawToken, csrfToken, expiresAt } = await createAuthenticatedSession(user);
    const res = NextResponse.json({
      ok: true,
      user: toSafeUser(user),
      recoveryCodes: plainCodes,
    });
    return attachSessionCookies(res, rawToken, csrfToken, expiresAt);
  }

  // Step 1: Validate setup token, create admin user, and return one-time TOTP QR + key
  const parsed = setupAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid setup fields' },
      { status: 400 }
    );
  }

  if (!safeCompare(parsed.data.setupToken, expectedToken)) {
    return NextResponse.json({ error: 'Invalid setup token.' }, { status: 403 });
  }

  const pwCheck = validatePasswordRules(parsed.data.password, parsed.data.username);
  if (!pwCheck.valid) {
    return NextResponse.json({ error: pwCheck.error }, { status: 400 });
  }

  if (store.users.some((u) => u.username.toLowerCase() === parsed.data.username.toLowerCase())) {
    return NextResponse.json({ error: 'That username is already in use.' }, { status: 409 });
  }

  const secret = createTotpSecret();
  const otpauthUri = buildTotpUri(parsed.data.username, secret);
  const qrDataUrl = await buildTotpQrDataUrl(otpauthUri);
  const nowIso = new Date().toISOString();
  const userId = randomUUID();

  store.users.push({
    userId,
    fullName: parsed.data.fullName,
    username: parsed.data.username.toLowerCase(),
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    role: 'Admin',
    passwordHash: hashPassword(parsed.data.password),
    isActive: true,
    mustChangePassword: false,
    tempPasswordExpiresAt: null,
    passwordChangedAt: nowIso,
    failedLoginCount: 0,
    isLocked: false,
    lockedAt: null,
    mfaEnabled: false,
    mfaSecretEncrypted: null,
    pendingMfaSecretEncrypted: encryptSecret(secret),
    mfaEnrolledAt: null,
    createdBy: null,
    createdAt: nowIso,
    deactivatedAt: null,
    deactivatedBy: null,
    updatedAt: nowIso,
  });

  appendAuditLog(store, {
    userId,
    action: 'INSERT',
    tableName: 'users',
    recordId: userId,
    newValues: { username: parsed.data.username.toLowerCase(), role: 'Admin' },
  });
  persistStore(store);

  return NextResponse.json({
    ok: true,
    userId,
    totpSecret: secret,
    qrDataUrl,
  });
}
