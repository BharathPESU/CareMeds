export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

export function calculateAge(dateOfBirth: string, referenceDate = new Date()): number {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 0;
  let age = referenceDate.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = referenceDate.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return Math.max(0, age);
}

export function formatDateTime(iso: string | null | undefined, tz = APP_TIMEZONE): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: tz,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatTime(iso: string | null | undefined, tz = APP_TIMEZONE): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatDate(iso: string | null | undefined, tz = APP_TIMEZONE): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: tz,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function toIsoDateString(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function isDoseOverdue(
  scheduledAt: string,
  status: string,
  overdueGraceMinutes = 60,
  now = new Date()
): boolean {
  if (status !== 'Pending') return false;
  const scheduled = new Date(scheduledAt).getTime();
  return now.getTime() > scheduled + overdueGraceMinutes * 60_000;
}

export function canUndoDose(
  undoUntil: string | null,
  confirmedBy: string | null,
  currentUserId: string,
  now = new Date()
): boolean {
  if (!undoUntil || !confirmedBy || confirmedBy !== currentUserId) return false;
  return now.getTime() <= new Date(undoUntil).getTime();
}

export function daysUntilDate(dateStr: string, now = new Date()): number {
  const target = new Date(`${dateStr}T00:00:00Z`).getTime();
  const today = new Date(`${toIsoDateString(now)}T00:00:00Z`).getTime();
  return Math.ceil((target - today) / (24 * 60 * 60 * 1000));
}
