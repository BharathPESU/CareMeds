import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/auth/session';
import { loadStore } from '@/lib/store/repository';
import { isPostgresConfigured } from '@/db/client';

export async function GET() {
  const store = loadStore();
  const ctx = await getSessionContext();

  if (!ctx) {
    return NextResponse.json({
      authenticated: false,
      setupCompleted: store.systemSettings.setup_completed === 'true',
      previewMode: !isPostgresConfigured(),
      facilityName: store.facility.name,
      defaultTheme: store.systemSettings.default_theme || 'clinical-calm',
      defaultColorMode: store.systemSettings.default_color_mode || 'system',
    });
  }

  const pref = store.userPreferences.find((p) => p.userId === ctx.user.userId);
  const requireMfaCaretakers = store.systemSettings.require_mfa_caretakers === 'true';
  const needsMfaEnroll =
    !ctx.user.mfaEnabled &&
    (ctx.user.role === 'Admin' ||
      ctx.user.role === 'Doctor' ||
      (ctx.user.role === 'Caretaker' && requireMfaCaretakers));

  return NextResponse.json({
    authenticated: true,
    previewMode: !isPostgresConfigured(),
    user: ctx.safeUser,
    csrfToken: ctx.csrfToken,
    needsMfaEnroll,
    facility: store.facility,
    preferences: {
      themeKey: pref?.themeKey || store.systemSettings.default_theme || 'clinical-calm',
      colorMode: pref?.colorMode || store.systemSettings.default_color_mode || 'system',
    },
    settings: {
      undoWindowMinutes: Number(store.systemSettings.undo_window_minutes || '5'),
      overdueGraceMinutes: Number(store.systemSettings.overdue_grace_minutes || '60'),
      expiryWarningDays: Number(store.systemSettings.expiry_warning_days || '60'),
      renewalReminderDays: Number(store.systemSettings.renewal_reminder_days || '7'),
    },
  });
}
