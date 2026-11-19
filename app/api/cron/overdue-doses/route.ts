import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { safeCompare } from '@/lib/crypto';
import { loadStore, persistStore, queueAlertIfNotActive } from '@/lib/store/repository';
import { isDoseOverdue } from '@/lib/time';

function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return false;
  return safeCompare(auth.slice(7), secret);
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  const store = loadStore();
  const grace = Number(store.systemSettings.overdue_grace_minutes || '60');
  const escalationMin = Number(store.systemSettings.escalation_minutes || '15');
  const now = new Date();
  let overdueAlertsRaised = 0;
  let escalatedCount = 0;

  for (const ev of store.doseEvents) {
    if (isDoseOverdue(ev.scheduledAt, ev.status, grace, now)) {
      const sch = store.dosageSchedules.find((s) => s.scheduleId === ev.scheduleId);
      const rx = sch ? store.prescriptions.find((p) => p.prescriptionId === sch.prescriptionId) : null;
      if (!rx || rx.status !== 'Active') continue;
      const res = store.residents.find((r) => r.residentId === rx.residentId);
      const med = store.medicines.find((m) => m.medicineId === rx.medicineId);
      const before = store.alerts.length;
      queueAlertIfNotActive(store, {
        alertCode: 'OVERDUE_DOSE',
        priority: 'High',
        residentId: rx.residentId,
        doseEventId: ev.doseEventId,
        prescriptionId: rx.prescriptionId,
        message: `${med?.name || 'Medicine'} for ${res?.fullName || 'Resident'} is overdue.`,
      });
      if (store.alerts.length > before) overdueAlertsRaised++;
    }
  }

  // Escalate unacknowledged High alerts past escalation_minutes
  const primaryAdmin = store.users.find((u) => u.role === 'Admin' && u.isActive);
  for (const alert of store.alerts) {
    if (alert.priority === 'High' && alert.status === 'Open') {
      const elapsedMin = (now.getTime() - new Date(alert.createdAt).getTime()) / 60_000;
      if (elapsedMin >= escalationMin && primaryAdmin) {
        alert.status = 'Escalated';
        alert.escalatedTo = primaryAdmin.userId;
        store.alertActions.push({
          actionId: randomUUID(),
          alertId: alert.alertId,
          userId: primaryAdmin.userId,
          action: 'Escalated',
          note: `Auto-escalated after ${escalationMin} minutes without acknowledgement.`,
          createdAt: now.toISOString(),
        });
        escalatedCount++;
      }
    }
  }

  persistStore(store);
  return NextResponse.json({ ok: true, overdueAlertsRaised, escalatedCount });
}
