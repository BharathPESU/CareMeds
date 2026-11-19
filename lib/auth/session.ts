import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { deriveCsrfToken, generateOpaqueToken, safeCompare, sha256Hex } from '../crypto';
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
  const maxHours = Number(store.systemSettings.session_max_hours || '12');
  const rawToken = generateOpaqueToken(32);
  const tokenHash = sha256Hex(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + maxHours * 3600_000);

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

  response.cookies.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });

  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });

  return response;
}

export function clearSessionCookies(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set(CSRF_COOKIE_NAME, '', {
    httpOnly: false,
    sameSite: 'strict',
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
  const session = store.sessions.find((s) => s.tokenHash === tokenHash);
  if (!session || session.revokedAt) return null;

  const now = Date.now();
  const expiresAtMs = new Date(session.expiresAt).getTime();
  const idleMinutes = Number(store.systemSettings.session_idle_minutes || '15');
  const lastSeenMs = new Date(session.lastSeenAt).getTime();

  if (now > expiresAtMs || now - lastSeenMs > idleMinutes * 60_000) {
    session.revokedAt = new Date(now).toISOString();
    persistStore(store);
    return null;
  }

  const user = store.users.find((u) => u.userId === session.userId);
  if (!user || !user.isActive || user.isLocked) {
    session.revokedAt = new Date(now).toISOString();
    persistStore(store);
    return null;
  }

  session.lastSeenAt = new Date(now).toISOString();
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
  if (!headerToken) return true; // SameSite=Strict cookie protects API routes; verify when header sent
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
