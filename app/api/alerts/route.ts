import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/session';
import { filterScopedResidents } from '@/lib/permissions/scope';
import { loadStore, persistStore } from '@/lib/store/repository';
import { alertActionSchema } from '@/lib/validation/schemas';

export async function GET() {
  const auth = await requireApiAuth('alert.view');
  if (!auth.ok) return auth.response;

  const store = loadStore();
  const actor = { userId: auth.ctx.user.userId, role: auth.ctx.user.role };
  const scopedResidents = filterScopedResidents(actor, store.residents, store.careAssignments);
  const scopedIds = new Set(scopedResidents.map((r) => r.residentId));

  const alerts = store.alerts
    .filter((a) => {
      if (actor.role === 'Admin') return true;
      if (a.residentId) return scopedIds.has(a.residentId);
      return actor.role === 'Caretaker' && (a.alertCode === 'LOW_STOCK' || a.alertCode === 'EXPIRY');
    })
    .map((a) => ({
      ...a,
      residentName: a.residentId
        ? store.residents.find((r) => r.residentId === a.residentId)?.fullName || null
        : null,
      escalatedToName: a.escalatedTo
        ? store.users.find((u) => u.userId === a.escalatedTo)?.fullName || null
        : null,
      actions: store.alertActions
        .filter((act) => act.alertId === a.alertId)
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
        .map((act) => ({
          ...act,
          userName: store.users.find((u) => u.userId === act.userId)?.fullName || 'Staff',
        })),
    }));

  return NextResponse.json({ alerts });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth('alert.resolve');
  if (!auth.ok) return auth.response;

  const parsed = alertActionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid alert action' },
      { status: 400 }
    );
  }

  const store = loadStore();
  const alert = store.alerts.find((a) => a.alertId === parsed.data.alertId);
  if (!alert) return NextResponse.json({ error: 'Alert not found' }, { status: 404 });

  if (parsed.data.action === 'Acknowledged') {
    alert.status = 'Acknowledged';
  } else if (parsed.data.action === 'Resolved') {
    alert.status = 'Resolved';
  }

  const actionRecord = {
    actionId: randomUUID(),
    alertId: alert.alertId,
    userId: auth.ctx.user.userId,
    action: parsed.data.action,
    note: parsed.data.note || `${parsed.data.action} by ${auth.ctx.user.fullName}`,
    createdAt: new Date().toISOString(),
  };

  store.alertActions.unshift(actionRecord);
  persistStore(store);

  return NextResponse.json({ ok: true, alert, actionRecord });
}
