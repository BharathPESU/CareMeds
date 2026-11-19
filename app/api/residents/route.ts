import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/session';
import { filterScopedResidents } from '@/lib/permissions/scope';
import { appendAuditLog, loadStore, persistStore } from '@/lib/store/repository';
import { calculateAge } from '@/lib/time';
import { createResidentSchema } from '@/lib/validation/schemas';

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth('resident.view');
  if (!auth.ok) return auth.response;

  const store = loadStore();
  const includeArchived = req.nextUrl.searchParams.get('includeArchived') === 'true';
  const scoped = filterScopedResidents(
    { userId: auth.ctx.user.userId, role: auth.ctx.user.role },
    store.residents,
    store.careAssignments
  ).filter((r) => includeArchived || r.status !== 'Archived');

  const items = scoped.map((r) => {
    const bed = r.bedId ? store.beds.find((b) => b.bedId === r.bedId) : null;
    const room = bed ? store.rooms.find((rm) => rm.roomId === bed.roomId) : null;
    const doctor = r.assignedDoctorId
      ? store.users.find((u) => u.userId === r.assignedDoctorId)
      : null;
    const residentAllergies = store.allergies.filter((a) => a.residentId === r.residentId);
    const activeCaretakers = store.careAssignments
      .filter((ca) => ca.residentId === r.residentId && ca.endedAt === null)
      .map((ca) => store.users.find((u) => u.userId === ca.caretakerId))
      .filter(Boolean)
      .map((u) => ({ userId: u!.userId, fullName: u!.fullName }));
    const activeRxCount = store.prescriptions.filter(
      (p) => p.residentId === r.residentId && p.status === 'Active'
    ).length;

    return {
      ...r,
      age: calculateAge(r.dateOfBirth),
      roomCode: room?.roomCode || null,
      wingOrFloor: room?.wingOrFloor || null,
      bedCode: bed?.bedCode || null,
      doctorName: doctor?.fullName || null,
      allergiesCount: residentAllergies.length,
      hasSevereAllergy: residentAllergies.some((a) => a.severity === 'Severe'),
      activeCaretakers,
      activeRxCount,
    };
  });

  const doctors = store.users
    .filter((u) => u.role === 'Doctor' && u.isActive)
    .map((u) => ({ userId: u.userId, fullName: u.fullName }));

  const occupiedBedIds = new Set(
    store.residents.filter((r) => r.status === 'Active' && r.bedId).map((r) => r.bedId!)
  );
  const availableBeds = store.beds
    .filter((b) => !occupiedBedIds.has(b.bedId))
    .map((b) => {
      const room = store.rooms.find((rm) => rm.roomId === b.roomId);
      return {
        bedId: b.bedId,
        label: `Room ${room?.roomCode || '?'} · Bed ${b.bedCode} (${room?.wingOrFloor || ''})`,
      };
    });

  return NextResponse.json({ residents: items, doctors, availableBeds });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth('resident.edit');
  if (!auth.ok) return auth.response;

  const parsed = createResidentSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid resident fields' },
      { status: 400 }
    );
  }

  const store = loadStore();
  if (parsed.data.bedId) {
    const bedTaken = store.residents.some(
      (r) => r.status === 'Active' && r.bedId === parsed.data.bedId
    );
    if (bedTaken) {
      return NextResponse.json({ error: 'Selected bed is already occupied.' }, { status: 409 });
    }
  }

  const nowIso = new Date().toISOString();
  const residentId = randomUUID();
  const resident = {
    residentId,
    fullName: parsed.data.fullName,
    photoPath: null,
    dateOfBirth: parsed.data.dateOfBirth,
    gender: parsed.data.gender,
    bloodGroup: parsed.data.bloodGroup,
    bedId: parsed.data.bedId || null,
    admissionDate: parsed.data.admissionDate,
    dietNotes: parsed.data.dietNotes || null,
    assignedDoctorId: parsed.data.assignedDoctorId || null,
    status: 'Active' as const,
    archivedAt: null,
    archiveReason: null,
    allergyStatus: parsed.data.allergyStatus,
    createdBy: auth.ctx.user.userId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  store.residents.push(resident);

  // If a Caretaker adds a resident, automatically assign them so the resident stays in their scope
  if (auth.ctx.user.role === 'Caretaker') {
    store.careAssignments.push({
      assignmentId: randomUUID(),
      caretakerId: auth.ctx.user.userId,
      residentId,
      assignedBy: auth.ctx.user.userId,
      assignedAt: nowIso,
      endedAt: null,
      endedBy: null,
    });
  }

  appendAuditLog(store, {
    userId: auth.ctx.user.userId,
    action: 'INSERT',
    tableName: 'residents',
    recordId: residentId,
    newValues: { full_name: resident.fullName, bed_id: resident.bedId },
  });
  persistStore(store);

  return NextResponse.json({ ok: true, resident }, { status: 201 });
}
