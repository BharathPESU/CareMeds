import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/session';
import { canCaretakerAdministerDose, filterScopedResidents } from '@/lib/permissions/scope';
import { selectFefoBatchForDose } from '@/lib/services/stock';
import {
  appendAuditLog,
  loadStore,
  persistStore,
  queueAlertIfNotActive,
} from '@/lib/store/repository';
import { canUndoDose, isDoseOverdue } from '@/lib/time';
import { doseActionSchema } from '@/lib/validation/schemas';

export async function GET() {
  const auth = await requireApiAuth('resident.view');
  if (!auth.ok) return auth.response;

  const store = loadStore();
  const actor = { userId: auth.ctx.user.userId, role: auth.ctx.user.role };
  const scopedResidents = filterScopedResidents(actor, store.residents, store.careAssignments);
  const scopedIds = new Set(scopedResidents.map((r) => r.residentId));
  const grace = Number(store.systemSettings.overdue_grace_minutes || '60');

  const rounds = store.doseEvents
    .map((ev) => {
      const sch = store.dosageSchedules.find((s) => s.scheduleId === ev.scheduleId);
      const rx = sch ? store.prescriptions.find((p) => p.prescriptionId === sch.prescriptionId) : null;
      if (!rx || !scopedIds.has(rx.residentId)) return null;
      const res = store.residents.find((r) => r.residentId === rx.residentId);
      const med = store.medicines.find((m) => m.medicineId === rx.medicineId);
      if (!res || !med || res.status !== 'Active') return null;

      const bed = res.bedId ? store.beds.find((b) => b.bedId === res.bedId) : null;
      const room = bed ? store.rooms.find((rm) => rm.roomId === bed.roomId) : null;
      const allergies = store.allergies
        .filter((a) => a.residentId === res.residentId)
        .map((a) => ({
          label: a.medicineId
            ? store.medicines.find((m) => m.medicineId === a.medicineId)?.name || 'Medicine'
            : a.substanceText || 'Substance',
          severity: a.severity,
          reaction: a.reaction,
        }));
      const confirmedByUser = ev.confirmedBy
        ? store.users.find((u) => u.userId === ev.confirmedBy)
        : null;

      const fefo = selectFefoBatchForDose(
        med.medicineId,
        sch!.doseAmount,
        ev.scheduledAt,
        store.inventoryItems,
        store.stockMovements
      );

      return {
        ...ev,
        overdue: isDoseOverdue(ev.scheduledAt, ev.status, grace),
        canUndo: canUndoDose(ev.undoUntil, ev.confirmedBy, actor.userId),
        residentId: res.residentId,
        residentName: res.fullName,
        residentBloodGroup: res.bloodGroup,
        roomLabel: room && bed ? `Room ${room.roomCode} · Bed ${bed.bedCode}` : 'Unassigned',
        allergies,
        allergyStatus: res.allergyStatus,
        medicineId: med.medicineId,
        medicineName: med.name,
        medicineGeneric: med.genericName,
        medicineStrength: med.strength,
        foodInstruction: med.foodInstruction,
        isControlled: med.isControlled,
        doseAmount: sch!.doseAmount,
        doseUnit: sch!.doseUnit,
        route: sch!.route,
        specialInstructions: rx.specialInstructions,
        confirmedByName: confirmedByUser?.fullName || null,
        availableStock: fefo.totalAvailableNonExpired,
        nextBatchNumber: fefo.batch?.batchNumber || null,
        nextBatchExpiry: fefo.batch?.expiryDate || null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  return NextResponse.json({
    rounds,
    canAdminister: actor.role === 'Caretaker',
    undoWindowMinutes: Number(store.systemSettings.undo_window_minutes || '5'),
    facility: store.facility,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth('dose.confirm');
  if (!auth.ok) return auth.response;

  const parsed = doseActionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid dose action' },
      { status: 400 }
    );
  }

  const store = loadStore();
  const ev = store.doseEvents.find((d) => d.doseEventId === parsed.data.doseEventId);
  if (!ev) return NextResponse.json({ error: 'Dose event not found' }, { status: 404 });

  const sch = store.dosageSchedules.find((s) => s.scheduleId === ev.scheduleId);
  const rx = sch ? store.prescriptions.find((p) => p.prescriptionId === sch.prescriptionId) : null;
  if (!sch || !rx) return NextResponse.json({ error: 'Schedule or prescription not found' }, { status: 404 });

  const actor = { userId: auth.ctx.user.userId, role: auth.ctx.user.role };
  if (!canCaretakerAdministerDose(actor, rx.residentId, store.careAssignments)) {
    return NextResponse.json(
      { error: 'Only a Caretaker with an active assignment to this resident can administer doses.' },
      { status: 403 }
    );
  }

  const med = store.medicines.find((m) => m.medicineId === rx.medicineId);
  const res = store.residents.find((r) => r.residentId === rx.residentId);
  const now = new Date();
  const nowIso = now.toISOString();
  const undoMinutes = Number(store.systemSettings.undo_window_minutes || '5');

  // UNDO within undo_window_minutes by the same caretaker
  if (parsed.data.action === 'Undo') {
    if (!canUndoDose(ev.undoUntil, ev.confirmedBy, actor.userId, now)) {
      return NextResponse.json(
        { error: 'The undo window has expired or this dose was confirmed by another caretaker.' },
        { status: 400 }
      );
    }

    const previousStatus = ev.status;
    ev.status = 'Pending';
    ev.administeredAt = null;
    ev.confirmedBy = null;
    ev.reason = null;
    ev.undoUntil = null;

    // Reverse the linked Dose taken movement if one existed
    const takenMove = store.stockMovements.find(
      (m) => m.doseEventId === ev.doseEventId && m.movementType === 'Dose taken'
    );
    if (takenMove) {
      store.stockMovements = store.stockMovements.filter(
        (m) => m.movementId !== takenMove.movementId
      );
    }

    store.doseEventStatusLog.unshift({
      logId: randomUUID(),
      doseEventId: ev.doseEventId,
      fromStatus: previousStatus,
      toStatus: 'Pending',
      changedBy: actor.userId,
      changedAt: nowIso,
      reason: 'Undone within undo window',
    });

    appendAuditLog(store, {
      userId: actor.userId,
      action: 'UNDO',
      tableName: 'dose_events',
      recordId: ev.doseEventId,
      oldValues: { status: previousStatus },
      newValues: { status: 'Pending' },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, doseEvent: ev });
  }

  if (ev.status !== 'Pending') {
    return NextResponse.json(
      { error: `Dose is already marked ${ev.status}. Use Undo within the undo window to revert.` },
      { status: 409 }
    );
  }

  if (parsed.data.action === 'Taken') {
    if (!parsed.data.identityVerified) {
      return NextResponse.json(
        { error: 'Confirm resident identity and allergy check before recording Taken.' },
        { status: 400 }
      );
    }

    // Atomic FEFO stock check & deduction (Business rules #5, #6, #7, #8)
    const doseQty = Math.ceil(sch.doseAmount);
    const { batch } = selectFefoBatchForDose(
      rx.medicineId,
      doseQty,
      ev.scheduledAt,
      store.inventoryItems,
      store.stockMovements
    );

    if (!batch) {
      // Quantity cannot go negative — dose stays Pending, raise LOW_STOCK alert
      queueAlertIfNotActive(store, {
        alertCode: 'LOW_STOCK',
        priority: 'High',
        residentId: rx.residentId,
        doseEventId: ev.doseEventId,
        message: `Insufficient non-expired stock of ${med?.name || 'medicine'} to administer dose for ${res?.fullName || 'resident'}. Contact administrator immediately.`,
      });
      persistStore(store);
      return NextResponse.json(
        {
          error:
            'Insufficient non-expired stock on hand. Dose remains Pending, a High-priority LOW_STOCK alert has been raised, and you should contact the administrator.',
        },
        { status: 409 }
      );
    }

    // Deduct stock in the same logical transaction
    const moveId = randomUUID();
    store.stockMovements.push({
      movementId: moveId,
      stockId: batch.stockId,
      movementType: 'Dose taken',
      quantityChange: -doseQty,
      reason: `FEFO dose deduction (Batch ${batch.batchNumber})`,
      doseEventId: ev.doseEventId,
      approvalStatus: 'Not required',
      performedBy: actor.userId,
      approvedBy: null,
      createdAt: nowIso,
    });

    ev.status = 'Taken';
    ev.administeredAt = nowIso;
    ev.confirmedBy = actor.userId;
    ev.reason = null;
    ev.undoUntil = new Date(now.getTime() + undoMinutes * 60_000).toISOString();

    store.doseEventStatusLog.unshift({
      logId: randomUUID(),
      doseEventId: ev.doseEventId,
      fromStatus: 'Pending',
      toStatus: 'Taken',
      changedBy: actor.userId,
      changedAt: nowIso,
      reason: `Identity & allergy check verified; Batch ${batch.batchNumber}`,
    });

    // Check if remaining batch stock fell below reorder level
    const newQty = batch.quantityOnHand - doseQty;
    if (newQty <= batch.reorderLevel) {
      queueAlertIfNotActive(store, {
        alertCode: 'LOW_STOCK',
        priority: 'High',
        stockId: batch.stockId,
        message: `${med?.name || 'Medicine'} (Batch ${batch.batchNumber}) fell to ${newQty} ${med?.stockUnit || 'units'} (reorder level ${batch.reorderLevel}).`,
      });
    }

    appendAuditLog(store, {
      userId: actor.userId,
      action: 'UPDATE',
      tableName: 'dose_events',
      recordId: ev.doseEventId,
      oldValues: { status: 'Pending' },
      newValues: { status: 'Taken', stock_id: batch.stockId, batch: batch.batchNumber, qty_deducted: doseQty },
    });
    persistStore(store);
    return NextResponse.json({
      ok: true,
      doseEvent: ev,
      batchUsed: batch.batchNumber,
      undoUntil: ev.undoUntil,
    });
  }

  // Refused, Missed, or Held (reason already validated by Zod)
  ev.status = parsed.data.action;
  ev.confirmedBy = actor.userId;
  ev.reason = parsed.data.reason!.trim();
  ev.undoUntil = new Date(now.getTime() + undoMinutes * 60_000).toISOString();

  store.doseEventStatusLog.unshift({
    logId: randomUUID(),
    doseEventId: ev.doseEventId,
    fromStatus: 'Pending',
    toStatus: parsed.data.action,
    changedBy: actor.userId,
    changedAt: nowIso,
    reason: ev.reason,
  });

  if (parsed.data.action === 'Missed') {
    queueAlertIfNotActive(store, {
      alertCode: 'MISSED_DOSE',
      priority: 'High',
      residentId: rx.residentId,
      doseEventId: ev.doseEventId,
      prescriptionId: rx.prescriptionId,
      message: `${med?.name || 'Medicine'} missed for ${res?.fullName || 'resident'}: ${ev.reason}`,
    });
  }

  appendAuditLog(store, {
    userId: actor.userId,
    action: 'UPDATE',
    tableName: 'dose_events',
    recordId: ev.doseEventId,
    oldValues: { status: 'Pending' },
    newValues: { status: ev.status, reason: ev.reason },
  });
  persistStore(store);

  return NextResponse.json({ ok: true, doseEvent: ev, undoUntil: ev.undoUntil });
}
