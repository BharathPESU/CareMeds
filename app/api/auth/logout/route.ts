import { NextResponse } from 'next/server';
import { clearSessionCookies, revokeCurrentSession } from '@/lib/auth/session';

export async function POST() {
  await revokeCurrentSession();
  const res = NextResponse.json({ ok: true });
  return clearSessionCookies(res);
}
