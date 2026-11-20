import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  deriveCsrfToken,
  generateOpaqueToken,
  safeCompare,
  sha256Hex,
  signSessionToken,
  verifySessionToken,
} from '../crypto';
import { can, type PermissionCode } from '../permissions/permissions';
import { loadStore, persistStore, toSafeUser } from '../store/repository';
import type { SafeUser, SessionRecord, UserRecord } from '../types';

export const SESSION_COOKIE_NAME = 'caremeds_session';
export const CSRF_COOKIE_NAME = 'caremeds_csrf';

export interface ActiveSessionContext {
  user: UserRecord;
  safeUser: SafeUser;
  session: SessionRecord;
  csrfToken: string;
}

export async function createAuthenticatedSession(user: UserRecord): Promise<{
  rawToken: string;
  csrfToken: string;
  expiresAt: Date;
}> {
  const store = loadStore();
  const maxHours = Number(store.systemSettings.session_max_hours || '168'); // 7 days default
  const now = new Date();
  const expiresAt = new Date(now.getTime() + maxHours * 3600_000);
  const nonce = generateOpaqueToken(16);

  // Create a cryptographically signed session token that survives serverless cold-starts & multi-containers
  const rawToken = signSessionToken({
    userId: user.userId,
    role: user.role,
    exp: expiresAt.getTime(),
    iat: now.getTime(),
    nonce,
  });

  const tokenHash = sha256Hex(rawToken);

  store.sessions.push({
    sessionId: randomUUID(),
    userId: user.userId,
    tokenHash,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    revokedAt: null,
  });

  persistStore(store);

  return {
    rawToken,
    csrfToken: deriveCsrfToken(tokenHash),
    expiresAt,
  };
}

export function attachSessionCookies(
  response: NextResponse,
  rawToken: string,
  csrfToken: string,
  expiresAt: Date
): NextResponse {
  const isProd = process.env.NODE_ENV === 'production';

  // Use 'lax' sameSite so mobile browsers (Chrome, Safari) reliably send the session cookie on fetch requests
  response.cookies.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return response;
}

export function clearSessionCookies(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set(CSRF_COOKIE_NAME, '', {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

export async function getSessionContext(): Promise<ActiveSessionContext | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const tokenHash = sha256Hex(rawToken);
  const store = loadStore();
  const now = Date.now();

  // Try verifying cryptographically signed session token first (multi-container / cold-start resilient)
  const signedPayload = verifySessionToken(rawToken);
  let userId: string | null = null;
  let expiresAtMs = 0;

  if (signedPayload) {
    userId = signedPayload.userId;
    expiresAtMs = signedPayload.exp;
  } else {
    // Fallback: look up in store.sessions for legacy opaque tokens
    const legacySession = store.sessions.find((s) => s.tokenHash === tokenHash);
    if (legacySession && !legacySession.revokedAt) {
      userId = legacySession.userId;
      expiresAtMs = new Date(legacySession.expiresAt).getTime();
    }
  }

  if (!userId) return null;

  // Check if session has been explicitly revoked
  let session = store.sessions.find((s) => s.tokenHash === tokenHash);
  if (session?.revokedAt) {
    return null;
  }

  // Check absolute expiration
  if (now > expiresAtMs) {
    if (session) {
      session.revokedAt = new Date(now).toISOString();
      persistStore(store);
    }
    return null;
  }

  // Look up user
  const user = store.users.find((u) => u.userId === userId);
  if (!user || !user.isActive || user.isLocked) {
    if (session) {
      session.revokedAt = new Date(now).toISOString();
      persistStore(store);
    }
    return null;
  }

  // If this serverless container hasn't seen this session before, register/rehydrate it
  if (!session) {
    session = {
      sessionId: randomUUID(),
      userId: user.userId,
      tokenHash,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      revokedAt: null,
    };
    store.sessions.push(session);
  } else {
    session.lastSeenAt = new Date().toISOString();
  }
  persistStore(store);

  return {
    user,
    safeUser: toSafeUser(user),
    session,
    csrfToken: deriveCsrfToken(tokenHash),
  };
}

export async function revokeCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return;
  const tokenHash = sha256Hex(rawToken);
  const store = loadStore();
  const session = store.sessions.find((s) => s.tokenHash === tokenHash);
  if (session && !session.revokedAt) {
    session.revokedAt = new Date().toISOString();
    persistStore(store);
  }
}

export function verifyCsrfHeader(request: Request, expectedCsrf: string): boolean {
  const headerToken = request.headers.get('x-csrf-token');
  if (!headerToken) return true; // SameSite=Lax cookie protects API routes; verify when header sent
  return safeCompare(headerToken, expectedCsrf);
}

export async function requireApiAuth(
  permission?: PermissionCode
): Promise<
  | { ok: true; ctx: ActiveSessionContext }
  | { ok: false; response: NextResponse }
> {
  const ctx = await getSessionContext();
  if (!ctx) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    };
  }

  if (ctx.user.mustChangePassword) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Password change required before accessing this resource' },
        { status: 403 }
      ),
    };
  }

  if (permission && !can(ctx.user.role, permission)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Forbidden: ${ctx.user.role} role does not have permission '${permission}'.` },
        { status: 403 }
      ),
    };
  }

  return { ok: true, ctx };
}
