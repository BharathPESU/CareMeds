import { getDb, isPostgresConfigured } from './client';
import {
  alertTypes,
  doseTimeWindows,
  permissions,
  rolePermissions,
  roles,
  systemSettings,
  vitalTypes,
} from './schema';
import { ROLE_PERMISSION_CODES, ALL_PERMISSIONS } from '../lib/permissions/permissions';
import { eq } from 'drizzle-orm';

export const DEFAULT_SYSTEM_SETTINGS: Record<string, string> = {
  setup_completed: 'false',
  session_idle_minutes: '15',
  session_max_hours: '12',
  lockout_threshold: '5',
  require_mfa_caretakers: 'false',
  expiry_warning_days: '60',
  escalation_minutes: '15',
  undo_window_minutes: '5',
  renewal_reminder_days: '7',
  overdue_grace_minutes: '60',
  default_theme: 'clinical-calm',
  default_color_mode: 'system',
};

export const DEFAULT_ALERT_TYPES = [
  { code: 'LOW_STOCK', defaultPriority: 'High' },
  { code: 'EXPIRY', defaultPriority: 'Medium' },
  { code: 'MISSED_DOSE', defaultPriority: 'High' },
  { code: 'OVERDUE_DOSE', defaultPriority: 'High' },
  { code: 'ABNORMAL_VITAL', defaultPriority: 'High' },
  { code: 'PRESCRIPTION_ENDING', defaultPriority: 'Medium' },
] as const;

// Vital types ship with NULL thresholds; the facility doctor enters them during setup.
export const DEFAULT_VITAL_TYPES = [
  { code: 'BP_SYSTOLIC', name: 'Blood Pressure (Systolic)', unit: 'mmHg' },
  { code: 'BP_DIASTOLIC', name: 'Blood Pressure (Diastolic)', unit: 'mmHg' },
  { code: 'BLOOD_SUGAR', name: 'Blood Sugar', unit: 'mg/dL' },
  { code: 'TEMPERATURE', name: 'Body Temperature', unit: '°C' },
  { code: 'PULSE', name: 'Pulse Rate', unit: 'bpm' },
  { code: 'SPO2', name: 'Oxygen Saturation (SpO2)', unit: '%' },
  { code: 'WEIGHT', name: 'Body Weight', unit: 'kg' },
] as const;

export const DEFAULT_DOSE_WINDOWS = [
  { name: 'Morning', startTime: '06:00:00', endTime: '11:59:00' },
  { name: 'Afternoon', startTime: '12:00:00', endTime: '16:59:00' },
  { name: 'Evening', startTime: '17:00:00', endTime: '20:59:00' },
  { name: 'Night', startTime: '21:00:00', endTime: '05:59:00' },
] as const;

export async function runSeed() {
  if (!isPostgresConfigured()) {
    console.log('DATABASE_URL not configured — skipping Postgres seed.');
    return;
  }

  const db = getDb();

  // 1. Seed roles
  for (const name of ['Admin', 'Caretaker', 'Doctor'] as const) {
    await db.insert(roles).values({ name }).onConflictDoNothing();
  }
  const allRoles = await db.select().from(roles);
  const roleMap = new Map(allRoles.map((r) => [r.name, r.roleId]));

  // 2. Seed permissions
  for (const p of ALL_PERMISSIONS) {
    await db.insert(permissions).values(p).onConflictDoNothing();
  }
  const allPerms = await db.select().from(permissions);
  const permMap = new Map(allPerms.map((p) => [p.code, p.permissionId]));

  // 3. Seed role_permissions matrix
  for (const [roleName, codes] of Object.entries(ROLE_PERMISSION_CODES)) {
    const roleId = roleMap.get(roleName);
    if (!roleId) continue;
    for (const code of codes) {
      const permissionId = permMap.get(code);
      if (!permissionId) continue;
      await db.insert(rolePermissions).values({ roleId, permissionId }).onConflictDoNothing();
    }
  }

  // 4. Seed alert_types
  for (const at of DEFAULT_ALERT_TYPES) {
    await db.insert(alertTypes).values({ ...at }).onConflictDoNothing();
  }

  // 5. Seed vital_types (thresholds explicitly null)
  for (const vt of DEFAULT_VITAL_TYPES) {
    await db
      .insert(vitalTypes)
      .values({ code: vt.code, name: vt.name, unit: vt.unit, minNormal: null, maxNormal: null })
      .onConflictDoNothing();
  }

  // 6. Seed dose_time_windows
  for (const win of DEFAULT_DOSE_WINDOWS) {
    await db.insert(doseTimeWindows).values({ ...win }).onConflictDoNothing();
  }

  // 7. Seed system_settings
  for (const [settingKey, settingValue] of Object.entries(DEFAULT_SYSTEM_SETTINGS)) {
    const existing = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.settingKey, settingKey));
    if (existing.length === 0) {
      await db.insert(systemSettings).values({ settingKey, settingValue });
    }
  }

  console.log('CareMeds Postgres seed complete.');
}
