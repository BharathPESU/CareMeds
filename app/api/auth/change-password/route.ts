import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, validatePasswordRules, verifyPassword } from '@/lib/auth/password';
import { getSessionContext } from '@/lib/auth/session';
import { appendAuditLog, loadStore, persistStore } from '@/lib/store/repository';
import { changePasswordSchema } from '@/lib/validation/schemas';

export async function POST(req: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const parsed = changePasswordSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid password payload' },
      { status: 400 }
    );
  }

  const store = loadStore();
  const user = store.users.find((u) => u.userId === ctx.user.userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!verifyPassword(parsed.data.currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
  }

  const policy = validatePasswordRules(
    parsed.data.newPassword,
    user.username,
    parsed.data.currentPassword
  );
  if (!policy.valid) {
    return NextResponse.json({ error: policy.error }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  user.passwordHash = hashPassword(parsed.data.newPassword);
  user.mustChangePassword = false;
  user.tempPasswordExpiresAt = null;
  user.pendingTempPasswordForExport = null;
  user.passwordChangedAt = nowIso;
  user.updatedAt = nowIso;

  appendAuditLog(store, {
    userId: user.userId,
    action: 'UPDATE',
    tableName: 'users',
    recordId: user.userId,
    newValues: { password_changed_at: nowIso, must_change_password: false },
  });
  persistStore(store);

  const requireMfaCaretakers = store.systemSettings.require_mfa_caretakers === 'true';
  const needsMfaEnroll =
    !user.mfaEnabled &&
    (user.role === 'Admin' ||
      user.role === 'Doctor' ||
      (user.role === 'Caretaker' && requireMfaCaretakers));

  return NextResponse.json({ ok: true, needsMfaEnroll });
}
