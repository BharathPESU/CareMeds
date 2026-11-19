import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/session';
import { can } from '@/lib/permissions/permissions';
import { canAccessResident, canDoctorManageResident } from '@/lib/permissions/scope';
import { appendAuditLog, loadStore, persistStore } from '@/lib/store/repository';
import { calculateAge } from '@/lib/time';
import {
  archiveResidentSchema,
  createAllergySchema,
  handoverNoteSchema,
  residentNoteSchema,
} from '@/lib/validation/schemas';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth('resident.view');
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const store = loadStore();
  const resident = store.residents.find((r) => r.residentId === id);
  if (!resident) {
    return NextResponse.json({ error: 'Resident not found' }, { status: 404 });
  }

  const actor = { userId: auth.ctx.user.userId, role: auth.ctx.user.role };
  if (!canAccessResident(actor, resident, store.careAssignments)) {
    return NextResponse.json({ error: 'Forbidden: resident is outside your assignment scope.' }, { status: 403 });
  }

  const bed = resident.bedId ? store.beds.find((b) => b.bedId === resident.bedId) : null;
  const room = bed ? store.rooms.find((rm) => rm.roomId === bed.roomId) : null;
  const doctor = resident.assignedDoctorId
    ? store.users.find((u) => u.userId === resident.assignedDoctorId)
    : null;

  const contacts = store.residentContacts.filter((c) => c.residentId === id);
  const diagnoses = store.residentDiagnoses.filter((d) => d.residentId === id);
  const history = store.residentHistory.filter((h) => h.residentId === id);
  const allergies = store.allergies
    .filter((a) => a.residentId === id)
    .map((a) => ({
      ...a,
      medicineName: a.medicineId
        ? store.medicines.find((m) => m.medicineId === a.medicineId)?.name || 'Unknown medicine'
        : null,
    }));

  const prescriptions = store.prescriptions
    .filter((p) => p.residentId === id)
    .map((p) => {
      const med = store.medicines.find((m) => m.medicineId === p.medicineId);
      const schedules = store.dosageSchedules.filter((s) => s.prescriptionId === p.prescriptionId);
      const prescriber = store.users.find((u) => u.userId === p.prescribedBy);
      return {
        ...p,
        medicineName: med?.name || 'Unknown',
        medicineStrength: med?.strength || '',
        stockUnit: med?.stockUnit || '',
        prescribedByName: prescriber?.fullName || 'Doctor',
        schedules,
      };
    });

  const rxIds = new Set(prescriptions.map((p) => p.prescriptionId));
  const schMap = new Map(
    store.dosageSchedules
      .filter((s) => rxIds.has(s.prescriptionId))
      .map((s) => [s.scheduleId, s])
  );

  const doses = store.doseEvents
    .filter((d) => schMap.has(d.scheduleId))
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
    .map((d) => {
      const sch = schMap.get(d.scheduleId)!;
      const rx = prescriptions.find((p) => p.prescriptionId === sch.prescriptionId);
      const staff = d.confirmedBy
        ? store.users.find((u) => u.userId === d.confirmedBy)?.fullName || null
        : null;
      return {
        ...d,
        medicineName: rx?.medicineName || '',
        doseLabel: `${sch.doseAmount} ${sch.doseUnit}`,
        confirmedByName: staff,
      };
    });

  const vitals = store.vitalReadings
    .filter((v) => v.residentId === id)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .map((v) => ({
      ...v,
      recordedByName: store.users.find((u) => u.userId === v.recordedBy)?.fullName || 'Staff',
    }));

  const notes = store.residentNotes
    .filter((n) => n.residentId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((n) => ({
      ...n,
      authorName: store.users.find((u) => u.userId === n.authorId)?.fullName || 'Staff',
    }));

  const handovers = store.shiftHandoverNotes
    .filter((h) => h.residentId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((h) => ({
      ...h,
      windowName: store.doseTimeWindows.find((w) => w.windowId === h.windowId)?.name || 'Shift',
      authorName: store.users.find((u) => u.userId === h.authorId)?.fullName || 'Staff',
    }));

  const documents = store.residentDocuments
    .filter((doc) => doc.residentId === id)
    .map((doc) => ({
      ...doc,
      uploadedByName: store.users.find((u) => u.userId === doc.uploadedBy)?.fullName || 'Doctor',
    }));

  const assignments = store.careAssignments
    .filter((a) => a.residentId === id)
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))
    .map((a) => ({
      ...a,
      caretakerName: store.users.find((u) => u.userId === a.caretakerId)?.fullName || 'Caretaker',
      assignedByName: store.users.find((u) => u.userId === a.assignedBy)?.fullName || 'Staff',
    }));

  const activeCaretakersList = store.users
    .filter((u) => u.role === 'Caretaker' && u.isActive)
    .map((u) => ({ userId: u.userId, fullName: u.fullName }));

  return NextResponse.json({
    resident: {
      ...resident,
      age: calculateAge(resident.dateOfBirth),
      roomCode: room?.roomCode || null,
      wingOrFloor: room?.wingOrFloor || null,
      bedCode: bed?.bedCode || null,
      doctorName: doctor?.fullName || null,
      doctorPhone: doctor?.phone || null,
    },
    contacts,
    diagnoses,
    history,
    allergies,
    prescriptions,
    doses,
    vitals,
    notes,
    handovers,
    documents,
    assignments,
    activeCaretakersList,
    doseWindows: store.doseTimeWindows,
    medicines: store.medicines.filter((m) => m.approvalStatus === 'Approved'),
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth('resident.view');
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const store = loadStore();
  const resident = store.residents.find((r) => r.residentId === id);
  if (!resident) {
    return NextResponse.json({ error: 'Resident not found' }, { status: 404 });
  }

  const actor = { userId: auth.ctx.user.userId, role: auth.ctx.user.role };
  if (!canAccessResident(actor, resident, store.careAssignments)) {
    return NextResponse.json({ error: 'Forbidden: resident outside your scope' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const nowIso = new Date().toISOString();

  // 1. Archive resident (Admin only, requires reason, stops Active prescriptions, cancels future Pending doses, notifies assigned doctor)
  if (body.operation === 'archive') {
    if (!can(actor.role, 'resident.archive')) {
      return NextResponse.json({ error: 'Only Administrators can archive a resident.' }, { status: 403 });
    }
    const parsed = archiveResidentSchema.safeParse({ reason: body.reason });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Archive reason required' }, { status: 400 });
    }

    const oldStatus = resident.status;
    resident.status = 'Archived';
    resident.archivedAt = nowIso;
    resident.archiveReason = parsed.data.reason;
    resident.updatedAt = nowIso;

    // Stop all Active prescriptions and cancel future Pending doses
    const stoppedRxIds = new Set<string>();
    for (const rx of store.prescriptions) {
      if (rx.residentId === id && rx.status === 'Active') {
        rx.status = 'Stopped';
        rx.stopReason = `Resident archived: ${parsed.data.reason}`;
        rx.stoppedAt = nowIso;
        stoppedRxIds.add(rx.prescriptionId);
      }
    }
    const stoppedSchIds = new Set(
      store.dosageSchedules.filter((s) => stoppedRxIds.has(s.prescriptionId)).map((s) => s.scheduleId)
    );
    store.doseEvents = store.doseEvents.filter(
      (ev) => !(stoppedSchIds.has(ev.scheduleId) && ev.status === 'Pending' && ev.scheduledAt > nowIso)
    );

    if (resident.assignedDoctorId) {
      store.notifications.unshift({
        notificationId: randomUUID(),
        residentContactId: null,
        userId: resident.assignedDoctorId,
        alertId: null,
        incidentId: null,
        channel: 'Email',
        status: 'Queued',
        attempts: 0,
        lastError: null,
        sentAt: null,
        createdAt: nowIso,
      });
    }

    appendAuditLog(store, {
      userId: actor.userId,
      action: 'ARCHIVE',
      tableName: 'residents',
      recordId: id,
      oldValues: { status: oldStatus },
      newValues: { status: 'Archived', archive_reason: parsed.data.reason, stopped_prescriptions: stoppedRxIds.size },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, resident });
  }

  // 2. Add allergy
  if (body.operation === 'add_allergy') {
    const parsed = createAllergySchema.safeParse({ ...body, residentId: id });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid allergy' }, { status: 400 });
    }
    const allergyId = randomUUID();
    const record = {
      allergyId,
      residentId: id,
      medicineId: parsed.data.medicineId || null,
      substanceText: parsed.data.substanceText || null,
      reaction: parsed.data.reaction,
      severity: parsed.data.severity,
      recordedBy: actor.userId,
      recordedAt: nowIso,
    };
    store.allergies.push(record);
    resident.allergyStatus = 'Recorded';
    resident.updatedAt = nowIso;
    appendAuditLog(store, {
      userId: actor.userId,
      action: 'INSERT',
      tableName: 'allergies',
      recordId: allergyId,
      newValues: { severity: record.severity, reaction: record.reaction },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, allergy: record });
  }

  // 3. Downgrade allergy severity (Doctor only, with recorded reason)
  if (body.operation === 'downgrade_allergy') {
    if (!canDoctorManageResident(actor, resident)) {
      return NextResponse.json({ error: 'Only the assigned Doctor can downgrade an allergy severity.' }, { status: 403 });
    }
    const allergy = store.allergies.find((a) => a.allergyId === body.allergyId && a.residentId === id);
    if (!allergy) return NextResponse.json({ error: 'Allergy record not found' }, { status: 404 });
    if (!body.reason || String(body.reason).trim().length < 5) {
      return NextResponse.json({ error: 'A clinical reason (min 5 characters) is required to downgrade an allergy.' }, { status: 400 });
    }
    const oldSeverity = allergy.severity;
    allergy.severity = body.severity === 'Mild' ? 'Mild' : 'Moderate';
    appendAuditLog(store, {
      userId: actor.userId,
      action: 'UPDATE',
      tableName: 'allergies',
      recordId: allergy.allergyId,
      oldValues: { severity: oldSeverity },
      newValues: { severity: allergy.severity, reason: String(body.reason).trim() },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, allergy });
  }

  // 4. Add clinical or general note
  if (body.operation === 'add_note') {
    if (body.noteType === 'Doctor visit' && !can(actor.role, 'clinical_notes.create')) {
      return NextResponse.json({ error: 'Only Doctors can add doctor visit notes.' }, { status: 403 });
    }
    const parsed = residentNoteSchema.safeParse({
      residentId: id,
      noteType: body.noteType || 'General',
      body: body.body,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid note' }, { status: 400 });
    }
    const note = {
      noteId: randomUUID(),
      residentId: id,
      authorId: actor.userId,
      noteType: parsed.data.noteType,
      body: parsed.data.body,
      createdAt: nowIso,
    };
    store.residentNotes.unshift(note);
    persistStore(store);
    return NextResponse.json({ ok: true, note });
  }

  // 5. Add shift handover note (Caretaker only)
  if (body.operation === 'add_handover') {
    if (!can(actor.role, 'handover.create')) {
      return NextResponse.json({ error: 'Only Caretakers can add shift handover notes.' }, { status: 403 });
    }
    const parsed = handoverNoteSchema.safeParse({
      residentId: id,
      windowId: body.windowId,
      body: body.body,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid handover note' }, { status: 400 });
    }
    const note = {
      noteId: randomUUID(),
      residentId: id,
      windowId: parsed.data.windowId,
      shiftDate: nowIso.slice(0, 10),
      authorId: actor.userId,
      body: parsed.data.body,
      createdAt: nowIso,
    };
    store.shiftHandoverNotes.unshift(note);
    persistStore(store);
    return NextResponse.json({ ok: true, note });
  }

  // 6. Assign caretaker (Admin or Doctor)
  if (body.operation === 'assign_caretaker') {
    const allowed = actor.role === 'Admin' || actor.role === 'Doctor';
    if (!allowed) {
      return NextResponse.json({ error: 'Only Admins or Doctors can assign caretakers.' }, { status: 403 });
    }
    const caretaker = store.users.find(
      (u) => u.userId === body.caretakerId && u.role === 'Caretaker' && u.isActive
    );
    if (!caretaker) {
      return NextResponse.json({ error: 'Select an active Caretaker account.' }, { status: 400 });
    }
    const alreadyActive = store.careAssignments.some(
      (a) => a.residentId === id && a.caretakerId === caretaker.userId && a.endedAt === null
    );
    if (alreadyActive) {
      return NextResponse.json({ error: 'This caretaker is already actively assigned to this resident.' }, { status: 409 });
    }
    const assignment = {
      assignmentId: randomUUID(),
      caretakerId: caretaker.userId,
      residentId: id,
      assignedBy: actor.userId,
      assignedAt: nowIso,
      endedAt: null,
      endedBy: null,
    };
    store.careAssignments.push(assignment);
    appendAuditLog(store, {
      userId: actor.userId,
      action: 'INSERT',
      tableName: 'care_assignments',
      recordId: assignment.assignmentId,
      newValues: { caretaker_id: caretaker.userId, resident_id: id },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, assignment });
  }

  // 7. End caretaker assignment (never deleted — sets ended_at and ended_by)
  if (body.operation === 'end_assignment') {
    const allowed = actor.role === 'Admin' || actor.role === 'Doctor';
    if (!allowed) {
      return NextResponse.json({ error: 'Only Admins or Doctors can end assignments.' }, { status: 403 });
    }
    const assignment = store.careAssignments.find(
      (a) => a.assignmentId === body.assignmentId && a.residentId === id && a.endedAt === null
    );
    if (!assignment) {
      return NextResponse.json({ error: 'Active assignment not found.' }, { status: 404 });
    }
    assignment.endedAt = nowIso;
    assignment.endedBy = actor.userId;
    appendAuditLog(store, {
      userId: actor.userId,
      action: 'UPDATE',
      tableName: 'care_assignments',
      recordId: assignment.assignmentId,
      oldValues: { ended_at: null },
      newValues: { ended_at: nowIso, ended_by: actor.userId },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, assignment });
  }

  // 8. Edit basic resident profile details
  if (body.operation === 'update_profile') {
    if (!can(actor.role, 'resident.edit')) {
      return NextResponse.json({ error: 'You do not have permission to edit resident details.' }, { status: 403 });
    }
    if (typeof body.dietNotes === 'string') resident.dietNotes = body.dietNotes;
    if (typeof body.fullName === 'string' && body.fullName.trim().length >= 2) {
      resident.fullName = body.fullName.trim();
    }
    resident.updatedAt = nowIso;
    appendAuditLog(store, {
      userId: actor.userId,
      action: 'UPDATE',
      tableName: 'residents',
      recordId: id,
      newValues: { full_name: resident.fullName, diet_notes: resident.dietNotes },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, resident });
  }

  return NextResponse.json({ error: 'Unknown resident operation' }, { status: 400 });
}
