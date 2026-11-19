import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/session';
import { canDoctorManageResident, filterScopedResidents } from '@/lib/permissions/scope';
import {
  checkDoseUnitMatchesMedicine,
  checkDuplicateActivePrescription,
  checkPrescriptionAllergy,
} from '@/lib/services/dosing';
import { appendAuditLog, loadStore, persistStore } from '@/lib/store/repository';
import { daysUntilDate } from '@/lib/time';
import { createPrescriptionSchema } from '@/lib/validation/schemas';

export async function GET() {
  const auth = await requireApiAuth('prescription.view');
  if (!auth.ok) return auth.response;

  const store = loadStore();
  const actor = { userId: auth.ctx.user.userId, role: auth.ctx.user.role };
  const scopedResidents = filterScopedResidents(actor, store.residents, store.careAssignments);
  const scopedIds = new Set(scopedResidents.map((r) => r.residentId));
  const defaultReminderDays = Number(store.systemSettings.renewal_reminder_days || '7');

  const prescriptions = store.prescriptions
    .filter((p) => scopedIds.has(p.residentId))
    .map((p) => {
      const res = store.residents.find((r) => r.residentId === p.residentId);
      const med = store.medicines.find((m) => m.medicineId === p.medicineId);
      const doc = store.users.find((u) => u.userId === p.prescribedBy);
      const schedules = store.dosageSchedules.filter((s) => s.prescriptionId === p.prescriptionId);
      const daysLeft = p.endDate ? daysUntilDate(p.endDate) : null;
      const needsRenewal =
        p.status === 'Active' &&
        daysLeft !== null &&
        daysLeft >= 0 &&
        daysLeft <= (p.renewalReminderDays || defaultReminderDays);

      return {
        ...p,
        residentName: res?.fullName || 'Unknown',
        medicineName: med?.name || 'Unknown',
        medicineStrength: med?.strength || '',
        stockUnit: med?.stockUnit || '',
        prescribedByName: doc?.fullName || 'Doctor',
        schedules,
        daysLeft,
        needsRenewal,
      };
    });

  return NextResponse.json({
    prescriptions,
    residents: scopedResidents
      .filter((r) => r.status === 'Active')
      .map((r) => ({
        residentId: r.residentId,
        fullName: r.fullName,
        allergies: store.allergies
          .filter((a) => a.residentId === r.residentId)
          .map((a) => ({
            medicineId: a.medicineId,
            substanceText: a.substanceText,
            severity: a.severity,
            reaction: a.reaction,
          })),
      })),
    approvedMedicines: store.medicines.filter(
      (m) => m.approvalStatus === 'Approved' && m.status === 'Active'
    ),
    doseWindows: store.doseTimeWindows,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth('prescription.create');
  if (!auth.ok) return auth.response;

  const parsed = createPrescriptionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid prescription fields' },
      { status: 400 }
    );
  }

  const store = loadStore();
  const data = parsed.data;
  const resident = store.residents.find((r) => r.residentId === data.residentId);
  if (!resident || resident.status !== 'Active') {
    return NextResponse.json({ error: 'Active resident not found.' }, { status: 404 });
  }

  if (!canDoctorManageResident({ userId: auth.ctx.user.userId, role: auth.ctx.user.role }, resident)) {
    return NextResponse.json(
      { error: 'Doctors can only prescribe for residents assigned to them.' },
      { status: 403 }
    );
  }

  const medicine = store.medicines.find((m) => m.medicineId === data.medicineId);
  if (!medicine || medicine.approvalStatus !== 'Approved' || medicine.status !== 'Active') {
    return NextResponse.json(
      { error: 'Only Approved and Active medicines from the catalogue can be prescribed.' },
      { status: 400 }
    );
  }

  // Rule #4: dose_unit MUST equal medicine.stock_unit
  const unitCheck = checkDoseUnitMatchesMedicine(data.doseUnit, medicine);
  if (!unitCheck.valid) {
    return NextResponse.json({ error: unitCheck.error }, { status: 400 });
  }

  if (data.endDate && data.endDate < data.startDate) {
    return NextResponse.json({ error: 'End date must be on or after the start date.' }, { status: 400 });
  }

  // Rule #9: Allergy check (Severe BLOCKED; Mild/Moderate requires override reason)
  const residentAllergies = store.allergies.filter((a) => a.residentId === resident.residentId);
  const allergyCheck = checkPrescriptionAllergy(residentAllergies, medicine);
  if (allergyCheck.status === 'BlockedSevere') {
    return NextResponse.json(
      { error: allergyCheck.message, allergyBlocked: true },
      { status: 409 }
    );
  }
  if (
    allergyCheck.status === 'WarningOverrideRequired' &&
    (!data.allergyOverrideReason || data.allergyOverrideReason.trim().length < 5)
  ) {
    return NextResponse.json(
      {
        error: allergyCheck.message,
        allergyOverrideRequired: true,
        severity: allergyCheck.matchingAllergy?.severity,
      },
      { status: 409 }
    );
  }

  const duplicate = checkDuplicateActivePrescription(
    resident.residentId,
    medicine.medicineId,
    store.prescriptions
  );

  const prescriptionId = randomUUID();
  const scheduleId = randomUUID();
  const defaultWinId = store.doseTimeWindows[0]?.windowId || '';
  const times =
    data.times.length > 0
      ? data.times.map((t) => ({ scheduleTimeId: randomUUID(), ...t }))
      : [{ scheduleTimeId: randomUUID(), timeOfDay: '09:00', windowId: defaultWinId }];

  const prescription = {
    prescriptionId,
    residentId: resident.residentId,
    medicineId: medicine.medicineId,
    prescribedBy: auth.ctx.user.userId,
    reasonDiagnosis: data.reasonDiagnosis,
    specialInstructions: data.specialInstructions || null,
    allergyOverrideReason: data.allergyOverrideReason?.trim() || null,
    startDate: data.startDate,
    endDate: data.endDate || null,
    status: 'Active' as const,
    stopReason: null,
    stoppedAt: null,
    renewalReminderDays: data.renewalReminderDays,
    previousPrescriptionId: null,
  };

  const schedule = {
    scheduleId,
    prescriptionId,
    doseAmount: data.doseAmount,
    doseUnit: data.doseUnit,
    route: data.route,
    frequency: data.frequency,
    intervalHours: data.intervalHours ?? null,
    isPrn: data.isPrn || data.frequency === 'PRN',
    prnMinGapMinutes: data.prnMinGapMinutes ?? null,
    prnMaxPerDay: data.prnMaxPerDay ?? null,
    effectiveFrom: data.startDate,
    effectiveTo: data.endDate || null,
    changedBy: auth.ctx.user.userId,
    changeReason: 'Initial prescription schedule',
    times,
  };

  store.prescriptions.unshift(prescription);
  store.dosageSchedules.push(schedule);

  // Immediately schedule today's next dose event for non-PRN active prescriptions
  if (!schedule.isPrn) {
    store.doseEvents.push({
      doseEventId: randomUUID(),
      scheduleId,
      scheduledAt: new Date(Date.now() + 90 * 60_000).toISOString(),
      status: 'Pending',
      administeredAt: null,
      confirmedBy: null,
      reason: null,
      isManual: false,
      createdBy: auth.ctx.user.userId,
      undoUntil: null,
    });
  }

  appendAuditLog(store, {
    userId: auth.ctx.user.userId,
    action: 'INSERT',
    tableName: 'prescriptions',
    recordId: prescriptionId,
    newValues: {
      resident_id: resident.residentId,
      medicine_id: medicine.medicineId,
      dose: `${schedule.doseAmount} ${schedule.doseUnit}`,
      allergy_override: Boolean(prescription.allergyOverrideReason),
    },
  });
  persistStore(store);

  return NextResponse.json(
    {
      ok: true,
      prescription,
      schedule,
      duplicateWarning: duplicate
        ? `Note: resident already had another ${duplicate.status} prescription for ${medicine.name}.`
        : null,
    },
    { status: 201 }
  );
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiAuth('prescription.edit');
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const store = loadStore();
  const rx = store.prescriptions.find((p) => p.prescriptionId === body.prescriptionId);
  if (!rx) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });

  const resident = store.residents.find((r) => r.residentId === rx.residentId);
  if (
    !resident ||
    !canDoctorManageResident({ userId: auth.ctx.user.userId, role: auth.ctx.user.role }, resident)
  ) {
    return NextResponse.json({ error: 'Only the resident’s assigned Doctor can modify this prescription.' }, { status: 403 });
  }

  const nowIso = new Date().toISOString();
  const oldStatus = rx.status;

  if (body.operation === 'renew') {
    const days = Number(body.extendDays || 30);
    const baseDate = rx.endDate ? new Date(`${rx.endDate}T00:00:00Z`) : new Date();
    baseDate.setUTCDate(baseDate.getUTCDate() + Math.max(7, Math.min(180, days)));
    rx.endDate = baseDate.toISOString().slice(0, 10);
    rx.status = 'Active';
    appendAuditLog(store, {
      userId: auth.ctx.user.userId,
      action: 'RENEW',
      tableName: 'prescriptions',
      recordId: rx.prescriptionId,
      oldValues: { status: oldStatus },
      newValues: { status: 'Active', end_date: rx.endDate },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, prescription: rx });
  }

  const nextStatus = body.status as 'Active' | 'Completed' | 'Stopped' | 'On hold';
  if (!['Active', 'Completed', 'Stopped', 'On hold'].includes(nextStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  if ((nextStatus === 'Stopped' || nextStatus === 'On hold') && (!body.reason || String(body.reason).trim().length < 3)) {
    return NextResponse.json({ error: 'Provide a clinical reason to stop or hold a prescription.' }, { status: 400 });
  }

  rx.status = nextStatus;
  if (nextStatus === 'Stopped' || nextStatus === 'On hold') {
    rx.stopReason = String(body.reason).trim();
    rx.stoppedAt = nowIso;
  }

  appendAuditLog(store, {
    userId: auth.ctx.user.userId,
    action: 'UPDATE',
    tableName: 'prescriptions',
    recordId: rx.prescriptionId,
    oldValues: { status: oldStatus },
    newValues: { status: nextStatus, stop_reason: rx.stopReason },
  });
  persistStore(store);
  return NextResponse.json({ ok: true, prescription: rx });
}
