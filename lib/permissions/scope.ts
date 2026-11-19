import type { CareAssignmentRecord, ResidentRecord, RoleName } from '../types';

export interface ScopedActor {
  userId: string;
  role: RoleName;
}

export function canAccessResident(
  actor: ScopedActor,
  resident: ResidentRecord,
  activeAssignments: CareAssignmentRecord[]
): boolean {
  if (actor.role === 'Admin') return true;
  if (actor.role === 'Doctor') {
    return resident.assignedDoctorId === actor.userId;
  }
  if (actor.role === 'Caretaker') {
    return activeAssignments.some(
      (a) =>
        a.residentId === resident.residentId &&
        a.caretakerId === actor.userId &&
        a.endedAt === null
    );
  }
  return false;
}

export function filterScopedResidents(
  actor: ScopedActor,
  residents: ResidentRecord[],
  assignments: CareAssignmentRecord[]
): ResidentRecord[] {
  const active = assignments.filter((a) => a.endedAt === null);
  return residents.filter((r) => canAccessResident(actor, r, active));
}

export function canDoctorManageResident(
  actor: ScopedActor,
  resident: ResidentRecord
): boolean {
  return actor.role === 'Doctor' && resident.assignedDoctorId === actor.userId;
}

export function canCaretakerAdministerDose(
  actor: ScopedActor,
  residentId: string,
  assignments: CareAssignmentRecord[]
): boolean {
  if (actor.role !== 'Caretaker') return false;
  return assignments.some(
    (a) =>
      a.residentId === residentId &&
      a.caretakerId === actor.userId &&
      a.endedAt === null
  );
}
