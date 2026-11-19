import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isPostgresConfigured } from '@/db/client';
import { attachSessionCookies, createAuthenticatedSession } from '@/lib/auth/session';
import { loadStore, persistStore, toSafeUser } from '@/lib/store/repository';
import { z } from 'zod';

const previewRoleSchema = z.object({
  role: z.enum(['Admin', 'Doctor', 'Caretaker']),
});

export async function POST(req: NextRequest) {
  if (isPostgresConfigured()) {
    return NextResponse.json(
      { error: 'Preview role switching is disabled when Supabase Postgres is connected.' },
      { status: 403 }
    );
  }

  const parsed = previewRoleSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Select Admin, Doctor, or Caretaker.' }, { status: 400 });
  }

  const store = loadStore();
  const user = store.users.find(
    (u) => u.role === parsed.data.role && u.isActive && !u.isLocked
  );
  if (!user) {
    return NextResponse.json({ error: 'No active account found for that role.' }, { status: 404 });
  }

  store.loginHistory.unshift({
    loginId: randomUUID(),
    userId: user.userId,
    attemptedUsername: user.username,
    attemptedAt: new Date().toISOString(),
    succeeded: true,
    ipAddress: '127.0.0.1',
  });
  persistStore(store);

  const { rawToken, csrfToken, expiresAt } = await createAuthenticatedSession(user);
  const res = NextResponse.json({ ok: true, user: toSafeUser(user) });
  return attachSessionCookies(res, rawToken, csrfToken, expiresAt);
}
