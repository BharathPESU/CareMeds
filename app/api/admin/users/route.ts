import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  generateTemporaryPassword,
  generateUsername,
  hashPassword,
} from '@/lib/auth/password';
import { requireApiAuth } from '@/lib/auth/session';
import {
  appendAuditLog,
  loadStore,
  persistStore,
  revokeAllUserSessions,
  toSafeUser,
} from '@/lib/store/repository';
import { createUserSchema } from '@/lib/validation/schemas';

export async function GET() {
  const auth = await requireApiAuth('user.create');
  if (!auth.ok) return auth.response;

  const store = loadStore();

  const users = store.users.map((u) => toSafeUser(u));
  const loginHistory = store.loginHistory.slice(0, 60);
  const credentialExports = store.credentialExports
    .slice(0, 30)
    .map((e) => ({
      ...e,
      targetName: store.users.find((u) => u.userId === e.targetUserId)?.fullName || 'User',
      exportedByName: store.users.find((u) => u.userId === e.exportedBy)?.fullName || 'Admin',
    }));

  const assignments = store.careAssignments
    .slice()
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))
    .map((a) => ({
      ...a,
      caretakerName: store.users.find((u) => u.userId === a.caretakerId)?.fullName || 'Caretaker',
      residentName: store.residents.find((r) => r.residentId === a.residentId)?.fullName || 'Resident',
      assignedByName: store.users.find((u) => u.userId === a.assignedBy)?.fullName || 'Staff',
      endedByName: a.endedBy
        ? store.users.find((u) => u.userId === a.endedBy)?.fullName || null
        : null,
    }));

  return NextResponse.json({
    users,
    loginHistory,
    credentialExports,
    assignments,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth('user.create');
  if (!auth.ok) return auth.response;

  const parsed = createUserSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid staff details' },
      { status: 400 }
    );
  }

  if ((parsed.data.role as string) === 'Admin') {
    return NextResponse.json(
      { error: 'Only one administrator is permitted in the system. You can only create Doctors and Caretakers.' },
      { status: 403 }
    );
  }

  const store = loadStore();

  let username = parsed.data.username?.trim();
  if (username) {
    const exists = store.users.some(
      (u) => u.username.toLowerCase() === username!.toLowerCase()
    );
    if (exists) {
      return NextResponse.json(
        { error: `Username "${username}" is already taken. Please choose another.` },
        { status: 409 }
      );
    }
  } else {
    username = generateUsername(
      parsed.data.fullName,
      store.users.map((u) => u.username)
    );
  }

  const initialPassword = parsed.data.password?.trim() || generateTemporaryPassword(16);
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAtIso = new Date(now.getTime() + 7 * 86400_000).toISOString();
  const userId = randomUUID();

  const user = {
    userId,
    fullName: parsed.data.fullName,
    username,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    role: parsed.data.role,
    passwordHash: hashPassword(initialPassword),
    isActive: true,
    mustChangePassword: false,
    tempPasswordExpiresAt: expiresAtIso,
    passwordChangedAt: null,
    failedLoginCount: 0,
    isLocked: false,
    lockedAt: null,
    mfaEnabled: false,
    mfaSecretEncrypted: null,
    mfaEnrolledAt: null,
    pendingTempPasswordForExport: initialPassword,
    createdBy: auth.ctx.user.userId,
    createdAt: nowIso,
    deactivatedAt: null,
    deactivatedBy: null,
    updatedAt: nowIso,
  };

  store.users.unshift(user);
  appendAuditLog(store, {
    userId: auth.ctx.user.userId,
    action: 'INSERT',
    tableName: 'users',
    recordId: userId,
    newValues: { full_name: user.fullName, username: user.username, role: user.role },
  });
  persistStore(store);

  return NextResponse.json({ ok: true, user: toSafeUser(user) }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiAuth('user.create');
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const store = loadStore();
  const target = store.users.find((u) => u.userId === body.userId);
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const now = new Date();
  const nowIso = now.toISOString();

  if (body.operation === 'reset_password') {
    const tempPassword = generateTemporaryPassword(16);
    target.passwordHash = hashPassword(tempPassword);
    target.mustChangePassword = true;
    target.tempPasswordExpiresAt = new Date(now.getTime() + 7 * 86400_000).toISOString();
    target.pendingTempPasswordForExport = tempPassword;
    target.isLocked = false;
    target.lockedAt = null;
    target.failedLoginCount = 0;
    target.updatedAt = nowIso;
    revokeAllUserSessions(store, target.userId);

    appendAuditLog(store, {
      userId: auth.ctx.user.userId,
      action: 'RESET_PASSWORD',
      tableName: 'users',
      recordId: target.userId,
      newValues: { must_change_password: true, sessions_revoked: true },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, user: toSafeUser(target) });
  }

  if (body.operation === 'unlock') {
    target.isLocked = false;
    target.lockedAt = null;
    target.failedLoginCount = 0;
    target.updatedAt = nowIso;
    appendAuditLog(store, {
      userId: auth.ctx.user.userId,
      action: 'UNLOCK',
      tableName: 'users',
      recordId: target.userId,
      oldValues: { is_locked: true },
      newValues: { is_locked: false },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, user: toSafeUser(target) });
  }

  if (body.operation === 'deactivate') {
    // Rule #18: Cannot deactivate the last active Admin
    if (target.role === 'Admin') {
      const activeAdmins = store.users.filter((u) => u.role === 'Admin' && u.isActive);
      if (activeAdmins.length <= 1) {
        return NextResponse.json(
          { error: 'Cannot deactivate the last active Administrator account.' },
          { status: 409 }
        );
      }
    }
    target.isActive = false;
    target.deactivatedAt = nowIso;
    target.deactivatedBy = auth.ctx.user.userId;
    target.updatedAt = nowIso;
    revokeAllUserSessions(store, target.userId);

    appendAuditLog(store, {
      userId: auth.ctx.user.userId,
      action: 'DEACTIVATE',
      tableName: 'users',
      recordId: target.userId,
      oldValues: { is_active: true },
      newValues: { is_active: false },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, user: toSafeUser(target) });
  }

  if (body.operation === 'reactivate') {
    target.isActive = true;
    target.deactivatedAt = null;
    target.deactivatedBy = null;
    target.updatedAt = nowIso;
    appendAuditLog(store, {
      userId: auth.ctx.user.userId,
      action: 'REACTIVATE',
      tableName: 'users',
      recordId: target.userId,
      oldValues: { is_active: false },
      newValues: { is_active: true },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, user: toSafeUser(target) });
  }

  return NextResponse.json({ error: 'Unknown user operation' }, { status: 400 });
}
