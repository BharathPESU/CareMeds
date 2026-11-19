import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { checkIpRateLimit, evaluateFailedAttempt } from '@/lib/auth/lockout';
import { verifyPassword } from '@/lib/auth/password';
import { findMatchingUnusedRecoveryCode } from '@/lib/auth/recovery-codes';
import { attachSessionCookies, createAuthenticatedSession } from '@/lib/auth/session';
import { verifyTotpCode } from '@/lib/auth/totp';
import { decryptSecret } from '@/lib/crypto';
import { loadStore, persistStore, revokeAllUserSessions, toSafeUser } from '@/lib/store/repository';
import { loginSchema } from '@/lib/validation/schemas';

const INVALID_CREDENTIALS_MSG = 'Invalid username or password.';

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';

  const rate = checkIpRateLimit(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Too many sign-in attempts. Please wait ${rate.retryAfterSeconds} seconds.` },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid credentials payload' },
      { status: 400 }
    );
  }

  const { username, password, totpCode, recoveryCode } = parsed.data;
  const store = loadStore();
  const user = store.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  const nowIso = new Date().toISOString();

  const recordLoginAttempt = (succeeded: boolean, userId: string | null) => {
    store.loginHistory.unshift({
      loginId: randomUUID(),
      userId,
      attemptedUsername: username,
      attemptedAt: nowIso,
      succeeded,
      ipAddress: ip,
    });
  };

  if (!user || !user.isActive) {
    recordLoginAttempt(false, user?.userId ?? null);
    persistStore(store);
    return NextResponse.json({ error: INVALID_CREDENTIALS_MSG }, { status: 401 });
  }

  if (user.isLocked) {
    recordLoginAttempt(false, user.userId);
    persistStore(store);
    return NextResponse.json(
      { error: 'This account is locked after repeated failed attempts. Contact an administrator to unlock it.' },
      { status: 423 }
    );
  }

  const passwordMatches = verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    const threshold = Number(store.systemSettings.lockout_threshold || '5');
    const { nextFailedCount, shouldLock } = evaluateFailedAttempt(user.failedLoginCount, threshold);
    user.failedLoginCount = nextFailedCount;
    if (shouldLock) {
      user.isLocked = true;
      user.lockedAt = nowIso;
      revokeAllUserSessions(store, user.userId);
    }
    user.updatedAt = nowIso;
    recordLoginAttempt(false, user.userId);
    persistStore(store);
    return NextResponse.json({ error: INVALID_CREDENTIALS_MSG }, { status: 401 });
  }

  // Check temporary password 7-day expiry
  if (user.mustChangePassword && user.tempPasswordExpiresAt) {
    if (Date.now() > new Date(user.tempPasswordExpiresAt).getTime()) {
      recordLoginAttempt(false, user.userId);
      persistStore(store);
      return NextResponse.json(
        { error: 'Your temporary password has expired. Ask an administrator to issue a new reset.' },
        { status: 401 }
      );
    }
  }

  // MFA step: revealed ONLY after a valid password for an account with MFA enabled
  if (user.mfaEnabled && user.mfaSecretEncrypted) {
    if (!totpCode && !recoveryCode) {
      return NextResponse.json({ mfaRequired: true }, { status: 200 });
    }

    let mfaValid = false;
    if (totpCode) {
      const secret = decryptSecret(user.mfaSecretEncrypted);
      mfaValid = verifyTotpCode(totpCode, secret);
    } else if (recoveryCode) {
      const userCodes = store.mfaRecoveryCodes.filter((c) => c.userId === user.userId);
      const matched = findMatchingUnusedRecoveryCode(userCodes, recoveryCode);
      if (matched) {
        matched.usedAt = nowIso;
        mfaValid = true;
      }
    }

    if (!mfaValid) {
      const threshold = Number(store.systemSettings.lockout_threshold || '5');
      const { nextFailedCount, shouldLock } = evaluateFailedAttempt(user.failedLoginCount, threshold);
      user.failedLoginCount = nextFailedCount;
      if (shouldLock) {
        user.isLocked = true;
        user.lockedAt = nowIso;
        revokeAllUserSessions(store, user.userId);
      }
      user.updatedAt = nowIso;
      recordLoginAttempt(false, user.userId);
      persistStore(store);
      return NextResponse.json(
        { error: 'Invalid authenticator or recovery code.', mfaRequired: true },
        { status: 401 }
      );
    }
  }

  // Success: reset failure count and create session
  user.failedLoginCount = 0;
  user.updatedAt = nowIso;
  recordLoginAttempt(true, user.userId);
  persistStore(store);

  const { rawToken, csrfToken, expiresAt } = await createAuthenticatedSession(user);
  const requireMfaCaretakers = store.systemSettings.require_mfa_caretakers === 'true';
  const needsMfaEnroll =
    !user.mfaEnabled &&
    (user.role === 'Admin' ||
      user.role === 'Doctor' ||
      (user.role === 'Caretaker' && requireMfaCaretakers));

  const res = NextResponse.json({
    ok: true,
    user: toSafeUser(user),
    mustChangePassword: user.mustChangePassword,
    needsMfaEnroll,
  });

  return attachSessionCookies(res, rawToken, csrfToken, expiresAt);
}
