import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { safeCompare } from '@/lib/crypto';
import { computeStockQuantity } from '@/lib/services/stock';
import { loadStore, persistStore, queueAlertIfNotActive } from '@/lib/store/repository';
import { daysUntilDate } from '@/lib/time';

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
  const now = new Date();
  const expiryDays = Number(store.systemSettings.expiry_warning_days || '60');
  const renewalDays = Number(store.systemSettings.renewal_reminder_days || '7');
  const systemAdmin = store.users.find((u) => u.role === 'Admin' && u.isActive);

  let dosesGenerated = 0;
  let alertsChecked = 0;

  // 1. Generate dose events for next 48 hours from Active prescriptions
  for (const rx of store.prescriptions) {
    if (rx.status !== 'Active') continue;
    const resident = store.residents.find((r) => r.residentId === rx.residentId);
    if (!resident || resident.status !== 'Active') continue;

    const schedules = store.dosageSchedules.filter((s) => s.prescriptionId === rx.prescriptionId && !s.isPrn);
    for (const sch of schedules) {
      for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
        const d = new Date(now.getTime() + dayOffset * 86400_000);
        const dayStr = d.toISOString().slice(0, 10);
        if (dayStr < sch.effectiveFrom || (sch.effectiveTo && dayStr > sch.effectiveTo)) continue;
        if (rx.endDate && dayStr > rx.endDate) continue;

        for (const t of sch.times) {
          const [hh, mm] = t.timeOfDay.split(':').map(Number);
          const scheduledUtc = new Date(
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh, mm, 0) - 330 * 60_000
          ).toISOString();

          const dup = store.doseEvents.some(
            (e) => e.scheduleId === sch.scheduleId && e.scheduledAt === scheduledUtc
          );
          if (!dup && systemAdmin) {
            store.doseEvents.push({
              doseEventId: randomUUID(),
              scheduleId: sch.scheduleId,
              scheduledAt: scheduledUtc,
              status: 'Pending',
              administeredAt: null,
              confirmedBy: null,
              reason: null,
              isManual: false,
              createdBy: systemAdmin.userId,
              undoUntil: null,
            });
            dosesGenerated++;
          }
        }
      }
    }

    // Prescription ending alerts
    if (rx.endDate) {
      const left = daysUntilDate(rx.endDate, now);
      if (left >= 0 && left <= (rx.renewalReminderDays || renewalDays)) {
        const med = store.medicines.find((m) => m.medicineId === rx.medicineId);
        queueAlertIfNotActive(store, {
          alertCode: 'PRESCRIPTION_ENDING',
          priority: 'Medium',
          residentId: rx.residentId,
          prescriptionId: rx.prescriptionId,
          message: `${med?.name || 'Prescription'} for ${resident.fullName} ends in ${left} day(s).`,
        });
        alertsChecked++;
      }
    }
  }

  // 2. Expiry & Low-stock alerts
  for (const item of store.inventoryItems) {
    const qty = computeStockQuantity(item.stockId, store.stockMovements);
    const med = store.medicines.find((m) => m.medicineId === item.medicineId);
    const daysLeft = daysUntilDate(item.expiryDate, now);
    if (qty > 0 && daysLeft <= expiryDays) {
      queueAlertIfNotActive(store, {
        alertCode: 'EXPIRY',
        priority: daysLeft <= 0 ? 'High' : 'Medium',
        stockId: item.stockId,
        message: `${med?.name || 'Medicine'} batch ${item.batchNumber} ${daysLeft <= 0 ? 'has expired' : `expires in ${daysLeft} days`}.`,
      });
      alertsChecked++;
    }
    if (qty <= item.reorderLevel && daysLeft > 0) {
      queueAlertIfNotActive(store, {
        alertCode: 'LOW_STOCK',
        priority: 'High',
        stockId: item.stockId,
        message: `${med?.name || 'Medicine'} batch ${item.batchNumber} has ${qty} ${med?.stockUnit || 'units'} remaining (reorder level ${item.reorderLevel}).`,
      });
      alertsChecked++;
    }
  }

  // 3. Retention purges (365d login history, 30d assistant messages, 30d expired sessions)
  const cutoff365 = now.getTime() - 365 * 86400_000;
  const cutoff30 = now.getTime() - 30 * 86400_000;
  store.loginHistory = store.loginHistory.filter((l) => new Date(l.attemptedAt).getTime() >= cutoff365);
  store.assistantMessages = store.assistantMessages.filter((m) => new Date(m.createdAt).getTime() >= cutoff30);
  store.sessions = store.sessions.filter(
    (s) => !s.revokedAt && new Date(s.expiresAt).getTime() >= cutoff30
  );

  persistStore(store);
  return NextResponse.json({ ok: true, dosesGenerated, alertsChecked });
}
