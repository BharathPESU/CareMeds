import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/session';
import { appendAuditLog, loadStore, persistStore, toSafeUser } from '@/lib/store/repository';
import { isValidColorMode, isValidThemeKey } from '@/lib/theme';
import { z } from 'zod';

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  themeKey: z.string().optional(),
  colorMode: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  const parsed = updateProfileSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid profile update' }, { status: 400 });
  }

  const store = loadStore();
  const user = store.users.find((u) => u.userId === auth.ctx.user.userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const profileChanged =
    (parsed.data.fullName !== undefined && parsed.data.fullName !== user.fullName) ||
    (parsed.data.phone !== undefined && parsed.data.phone !== user.phone);
  if (parsed.data.fullName) user.fullName = parsed.data.fullName;
  if (parsed.data.phone !== undefined) user.phone = parsed.data.phone;
  if (profileChanged) {
    user.updatedAt = nowIso;
  }

  let pref = store.userPreferences.find((p) => p.userId === user.userId);
  if (parsed.data.themeKey || parsed.data.colorMode) {
    const themeKey =
      parsed.data.themeKey && isValidThemeKey(parsed.data.themeKey)
        ? parsed.data.themeKey
        : pref?.themeKey || 'clinical-calm';
    const colorMode =
      parsed.data.colorMode && isValidColorMode(parsed.data.colorMode)
        ? parsed.data.colorMode
        : pref?.colorMode || 'system';

    if (pref) {
      pref.themeKey = themeKey;
      pref.colorMode = colorMode;
      pref.updatedAt = nowIso;
    } else {
      pref = { userId: user.userId, themeKey, colorMode, updatedAt: nowIso };
      store.userPreferences.push(pref);
    }
  }

  if (profileChanged) {
    appendAuditLog(store, {
      userId: user.userId,
      action: 'UPDATE',
      tableName: 'users',
      recordId: user.userId,
      newValues: { full_name: user.fullName, phone: user.phone },
    });
  }
  persistStore(store);

  return NextResponse.json({
    ok: true,
    user: toSafeUser(user),
    preferences: pref || {
      themeKey: store.systemSettings.default_theme || 'clinical-calm',
      colorMode: store.systemSettings.default_color_mode || 'system',
    },
  });
}
