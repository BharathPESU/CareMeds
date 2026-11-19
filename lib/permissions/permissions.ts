import type { RoleName } from '../types';

export type PermissionCode =
  | 'user.create'
  | 'user.reset_password'
  | 'user.deactivate'
  | 'user.unlock'
  | 'user.view_login_history'
  | 'settings.edit'
  | 'caretaker.assign'
  | 'assignment.view_all'
  | 'resident.view'
  | 'resident.edit'
  | 'resident.archive'
  | 'medicine.view'
  | 'medicine.propose'
  | 'medicine.approve'
  | 'prescription.view'
  | 'prescription.create'
  | 'prescription.edit'
  | 'dose.confirm'
  | 'vitals.view'
  | 'vitals.record'
  | 'clinical_notes.view'
  | 'clinical_notes.create'
  | 'handover.view'
  | 'handover.create'
  | 'stock.view'
  | 'stock.receive_return'
  | 'stock.propose_adjustment'
  | 'stock.approve_adjustment'
  | 'po.view'
  | 'po.manage'
  | 'alert.view'
  | 'alert.resolve'
  | 'emergency.view'
  | 'emergency.manage'
  | 'reports.view'
  | 'audit.view'
  | 'assistant.use';

export const ALL_PERMISSIONS: { code: PermissionCode; description: string }[] = [
  { code: 'user.create', description: 'Create doctor and caretaker accounts' },
  { code: 'user.reset_password', description: 'Reset user passwords and issue temporary passwords' },
  { code: 'user.deactivate', description: 'Deactivate staff accounts' },
  { code: 'user.unlock', description: 'Unlock accounts locked after failed sign-ins' },
  { code: 'user.view_login_history', description: 'View login history for all accounts' },
  { code: 'settings.edit', description: 'Configure facility profile, dose windows, thresholds, and settings' },
  { code: 'caretaker.assign', description: 'Assign or end caretaker assignments to residents' },
  { code: 'assignment.view_all', description: 'View all doctor and caretaker resident assignments' },
  { code: 'resident.view', description: 'View resident records within role scope' },
  { code: 'resident.edit', description: 'Add and edit resident profiles within role scope' },
  { code: 'resident.archive', description: 'Archive residents with a mandatory reason' },
  { code: 'medicine.view', description: 'View medicine master catalogue' },
  { code: 'medicine.propose', description: 'Propose new medicines for admin approval' },
  { code: 'medicine.approve', description: 'Approve, reject, or discontinue medicines' },
  { code: 'prescription.view', description: 'View prescriptions and dosage schedules' },
  { code: 'prescription.create', description: 'Create prescriptions and dosage schedules' },
  { code: 'prescription.edit', description: 'Edit, hold, stop, or complete prescriptions' },
  { code: 'dose.confirm', description: 'Confirm, refuse, mark missed, hold, or undo doses' },
  { code: 'vitals.view', description: 'View resident health readings and vitals trends' },
  { code: 'vitals.record', description: 'Record resident vital readings' },
  { code: 'clinical_notes.view', description: 'View doctor visit notes and lab uploads' },
  { code: 'clinical_notes.create', description: 'Add doctor visit notes and upload lab results' },
  { code: 'handover.view', description: 'View shift handover notes' },
  { code: 'handover.create', description: 'Add shift handover notes' },
  { code: 'stock.view', description: 'View medicine inventory and storage locations' },
  { code: 'stock.receive_return', description: 'Record stock received, returns, and fridge temperatures' },
  { code: 'stock.propose_adjustment', description: 'Propose stock adjustments, disposals, and damage write-offs' },
  { code: 'stock.approve_adjustment', description: 'Approve or reject proposed stock adjustments' },
  { code: 'po.view', description: 'View purchase orders' },
  { code: 'po.manage', description: 'Create and approve purchase orders' },
  { code: 'alert.view', description: 'View alerts within role scope' },
  { code: 'alert.resolve', description: 'Acknowledge and resolve alerts with notes' },
  { code: 'emergency.view', description: 'View emergency profiles and incident logs' },
  { code: 'emergency.manage', description: 'Trigger emergency incidents and log emergency actions' },
  { code: 'reports.view', description: 'View and export role-scoped reports' },
  { code: 'audit.view', description: 'View the append-only system audit log' },
  { code: 'assistant.use', description: 'Use the Care Assistant (general reference only)' },
];

export const ROLE_PERMISSION_CODES: Record<RoleName, PermissionCode[]> = {
  Admin: [
    'user.create',
    'user.reset_password',
    'user.deactivate',
    'user.unlock',
    'user.view_login_history',
    'settings.edit',
    'caretaker.assign',
    'assignment.view_all',
    'resident.view',
    'resident.edit',
    'resident.archive',
    'medicine.view',
    'medicine.approve',
    'prescription.view',
    'vitals.view',
    'clinical_notes.view',
    'handover.view',
    'stock.view',
    'stock.receive_return',
    'stock.approve_adjustment',
    'po.view',
    'po.manage',
    'alert.view',
    'alert.resolve',
    'emergency.view',
    'reports.view',
    'audit.view',
    'assistant.use',
  ],
  Doctor: [
    'caretaker.assign',
    'resident.view',
    'medicine.view',
    'medicine.propose',
    'prescription.view',
    'prescription.create',
    'prescription.edit',
    'vitals.view',
    'vitals.record',
    'clinical_notes.view',
    'clinical_notes.create',
    'handover.view',
    'stock.view',
    'po.view',
    'alert.view',
    'alert.resolve',
    'emergency.view',
    'reports.view',
    'assistant.use',
  ],
  Caretaker: [
    'resident.view',
    'resident.edit',
    'medicine.view',
    'prescription.view',
    'dose.confirm',
    'vitals.view',
    'vitals.record',
    'clinical_notes.view',
    'handover.view',
    'handover.create',
    'stock.view',
    'stock.receive_return',
    'stock.propose_adjustment',
    'alert.view',
    'alert.resolve',
    'emergency.view',
    'emergency.manage',
    'reports.view',
    'assistant.use',
  ],
};

export function can(role: RoleName, permission: PermissionCode): boolean {
  return ROLE_PERMISSION_CODES[role].includes(permission);
}
