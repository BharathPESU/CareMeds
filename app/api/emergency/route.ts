import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/session';
import { canAccessResident, filterScopedResidents } from '@/lib/permissions/scope';
import { loadStore, persistStore } from '@/lib/store/repository';
import { calculateAge } from '@/lib/time';
import { emergencyIncidentSchema, incidentLogEntrySchema } from '@/lib/validation/schemas';

export async function GET() {
  const auth = await requireApiAuth('emergency.view');
  if (!auth.ok) return auth.response;

  const store = loadStore();
  const actor = { userId: auth.ctx.user.userId, role: auth.ctx.user.role };
  const scopedResidents = filterScopedResidents(actor, store.residents, store.careAssignments).filter(
    (r) => r.status === 'Active'
  );
  const scopedIds = new Set(scopedResidents.map((r) => r.residentId));

  const residentProfiles = scopedResidents.map((r) => {
    const bed = r.bedId ? store.beds.find((b) => b.bedId === r.bedId) : null;
    const room = bed ? store.rooms.find((rm) => rm.roomId === bed.roomId) : null;
    const doctor = r.assignedDoctorId
      ? store.users.find((u) => u.userId === r.assignedDoctorId)
      : null;

    return {
      residentId: r.residentId,
      fullName: r.fullName,
      age: calculateAge(r.dateOfBirth),
      bloodGroup: r.bloodGroup,
      roomLabel: room && bed ? `Room ${room.roomCode} · Bed ${bed.bedCode}` : 'Unassigned',
      allergyStatus: r.allergyStatus,
      allergies: store.allergies
        .filter((a) => a.residentId === r.residentId)
        .map((a) => ({
          label: a.medicineId
            ? store.medicines.find((m) => m.medicineId === a.medicineId)?.name || 'Medicine'
            : a.substanceText || 'Substance',
          severity: a.severity,
          reaction: a.reaction,
        })),
      conditions: store.residentDiagnoses
        .filter((d) => d.residentId === r.residentId && d.isActive)
        .map((d) => d.description),
      doctor: doctor ? { fullName: doctor.fullName, phone: doctor.phone } : null,
      contacts: store.residentContacts.filter((c) => c.residentId === r.residentId),
    };
  });

  const incidents = store.emergencyIncidents
    .filter((i) => scopedIds.has(i.residentId))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map((inc) => ({
      ...inc,
      residentName:
        store.residents.find((r) => r.residentId === inc.residentId)?.fullName || 'Resident',
      reportedByName:
        store.users.find((u) => u.userId === inc.reportedBy)?.fullName || 'Staff',
      entries: store.incidentLogEntries
        .filter((e) => e.incidentId === inc.incidentId)
        .sort((a, b) => b.actionTime.localeCompare(a.actionTime))
        .map((e) => ({
          ...e,
          loggedByName: store.users.find((u) => u.userId === e.loggedBy)?.fullName || 'Staff',
        })),
    }));

  return NextResponse.json({
    residentProfiles,
    incidents,
    canManage: actor.role === 'Caretaker',
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth('emergency.manage');
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const store = loadStore();
  const actor = { userId: auth.ctx.user.userId, role: auth.ctx.user.role };
  const nowIso = new Date().toISOString();

  if (body.operation === 'add_entry') {
    const parsed = incidentLogEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid log entry' }, { status: 400 });
    }
    const incident = store.emergencyIncidents.find((i) => i.incidentId === parsed.data.incidentId);
    if (!incident) return NextResponse.json({ error: 'Incident not found' }, { status: 404 });

    const entry = {
      entryId: randomUUID(),
      incidentId: incident.incidentId,
      loggedBy: actor.userId,
      actionTime: nowIso,
      actionTaken: parsed.data.actionTaken,
      outcome: parsed.data.outcome,
      loggedAt: nowIso,
    };
    store.incidentLogEntries.unshift(entry);
    if (body.closeIncident) {
      incident.status = 'Closed';
    }
    persistStore(store);
    return NextResponse.json({ ok: true, entry });
  }

  const parsed = emergencyIncidentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid incident details' }, { status: 400 });
  }

  const resident = store.residents.find((r) => r.residentId === parsed.data.residentId);
  if (!resident || !canAccessResident(actor, resident, store.careAssignments)) {
    return NextResponse.json({ error: 'Resident not found in your care assignment.' }, { status: 403 });
  }

  const incidentId = randomUUID();
  const incident = {
    incidentId,
    residentId: resident.residentId,
    reportedBy: actor.userId,
    occurredAt: nowIso,
    description: parsed.data.description,
    status: 'Open' as const,
  };
  store.emergencyIncidents.unshift(incident);

  // Queue notifications for opted-in family contacts & assigned doctor
  const contacts = store.residentContacts.filter(
    (c) => c.residentId === resident.residentId && c.receivesNotifications
  );
  for (const c of contacts) {
    store.notifications.unshift({
      notificationId: randomUUID(),
      residentContactId: c.contactId,
      userId: null,
      alertId: null,
      incidentId,
      channel: 'SMS',
      status: 'Queued',
      attempts: 0,
      lastError: null,
      sentAt: null,
      createdAt: nowIso,
    });
  }
  if (resident.assignedDoctorId) {
    store.notifications.unshift({
      notificationId: randomUUID(),
      residentContactId: null,
      userId: resident.assignedDoctorId,
      alertId: null,
      incidentId,
      channel: 'Email',
      status: 'Queued',
      attempts: 0,
      lastError: null,
      sentAt: null,
      createdAt: nowIso,
    });
  }

  persistStore(store);
  return NextResponse.json({ ok: true, incident }, { status: 201 });
}
