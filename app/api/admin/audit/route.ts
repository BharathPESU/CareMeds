import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/session';
import { loadStore } from '@/lib/store/repository';

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth('audit.view');
  if (!auth.ok) return auth.response;

  const store = loadStore();
  const tableFilter = req.nextUrl.searchParams.get('table') || '';
  const userFilter = req.nextUrl.searchParams.get('userId') || '';

  const entries = store.auditLog
    .slice()
    .sort((a, b) => b.auditId - a.auditId)
    .filter((entry) => {
      if (tableFilter && entry.tableName !== tableFilter) return false;
      if (userFilter && entry.userId !== userFilter) return false;
      return true;
    })
    .slice(0, 200)
    .map((entry) => ({
      ...entry,
      userName: entry.userId
        ? store.users.find((u) => u.userId === entry.userId)?.fullName || 'Unknown'
        : 'System',
    }));

  const tables = Array.from(new Set(store.auditLog.map((e) => e.tableName))).sort();
  const users = store.users.map((u) => ({ userId: u.userId, fullName: u.fullName, role: u.role }));

  return NextResponse.json({ entries, tables, users });
}
