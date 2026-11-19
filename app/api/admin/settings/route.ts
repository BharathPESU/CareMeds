import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/session';
import { appendAuditLog, loadStore, persistStore } from '@/lib/store/repository';
import { isValidColorMode, isValidThemeKey } from '@/lib/theme';

export async function GET() {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  const store = loadStore();
  return NextResponse.json({
    facility: store.facility,
    systemSettings: store.systemSettings,
    doseTimeWindows: store.doseTimeWindows,
    vitalTypes: store.vitalTypes,
    failedNotificationsCount: store.notifications.filter((n) => n.status === 'Failed').length,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const store = loadStore();
  const role = auth.ctx.user.role;
  const userId = auth.ctx.user.userId;

  // Doctors (during facility setup) or Admins can update vital thresholds
  if (body.section === 'vital_thresholds') {
    if (role !== 'Doctor' && role !== 'Admin') {
      return NextResponse.json(
        { error: 'Only Doctors or Administrators can configure vital thresholds.' },
        { status: 403 }
      );
    }
    const updates = Array.isArray(body.vitalTypes) ? body.vitalTypes : [];
    for (const u of updates) {
      const vt = store.vitalTypes.find((x) => x.vitalTypeId === u.vitalTypeId);
      if (!vt) continue;
      vt.minNormal = u.minNormal === '' || u.minNormal == null ? null : Number(u.minNormal);
      vt.maxNormal = u.maxNormal === '' || u.maxNormal == null ? null : Number(u.maxNormal);
    }
    appendAuditLog(store, {
      userId,
      action: 'UPDATE',
      tableName: 'vital_types',
      recordId: 'thresholds',
      newValues: { count: updates.length },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, vitalTypes: store.vitalTypes });
  }

  // All other settings require Admin ('settings.edit')
  if (role !== 'Admin') {
    return NextResponse.json({ error: 'Only Administrators can modify facility settings.' }, { status: 403 });
  }

  if (body.section === 'facility' && body.facility) {
    store.facility = {
      ...store.facility,
      name: String(body.facility.name || store.facility.name).trim(),
      address: String(body.facility.address || store.facility.address).trim(),
      phone: String(body.facility.phone || store.facility.phone).trim(),
      email: String(body.facility.email || store.facility.email).trim(),
      registrationNo: String(body.facility.registrationNo || store.facility.registrationNo).trim(),
    };
    appendAuditLog(store, {
      userId,
      action: 'UPDATE',
      tableName: 'facility',
      recordId: store.facility.facilityId,
      newValues: { name: store.facility.name },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, facility: store.facility });
  }

  if (body.section === 'system_settings' && body.settings) {
    const allowedKeys = [
      'session_idle_minutes',
      'session_max_hours',
      'lockout_threshold',
      'require_mfa_caretakers',
      'expiry_warning_days',
      'escalation_minutes',
      'undo_window_minutes',
      'renewal_reminder_days',
      'overdue_grace_minutes',
      'default_theme',
      'default_color_mode',
    ];
    const changed: Record<string, string> = {};
    for (const k of allowedKeys) {
      if (body.settings[k] !== undefined) {
        const val = String(body.settings[k]);
        if (k === 'default_theme' && !isValidThemeKey(val)) continue;
        if (k === 'default_color_mode' && !isValidColorMode(val)) continue;
        store.systemSettings[k] = val;
        changed[k] = val;
      }
    }
    appendAuditLog(store, {
      userId,
      action: 'UPDATE',
      tableName: 'system_settings',
      recordId: 'batch',
      newValues: changed,
    });
    persistStore(store);
    return NextResponse.json({ ok: true, systemSettings: store.systemSettings });
  }

  return NextResponse.json({ error: 'Invalid settings section' }, { status: 400 });
}
