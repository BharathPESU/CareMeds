export type RoleName = 'Admin' | 'Caretaker' | 'Doctor';

export type ThemeKey = 'clinical-calm' | 'warm-care' | 'modern-indigo';
export type ColorMode = 'light' | 'dark' | 'system';

export type ResidentStatus = 'Active' | 'Discharged' | 'Archived';
export type AllergyStatus = 'Unknown' | 'None known' | 'Recorded';
export type AllergySeverity = 'Mild' | 'Moderate' | 'Severe';

export type MedicineForm = 'Tablet' | 'Syrup' | 'Injection' | 'Capsule' | 'Cream' | 'Inhaler';
export type StockUnit = 'tablet' | 'capsule' | 'ml' | 'vial' | 'sachet' | 'tube' | 'inhaler';
export type MedicineStatus = 'Active' | 'Discontinued';
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export type StorageLocationType =
  | 'Cabinet'
  | 'Shelf'
  | 'Fridge'
  | 'Locked controlled-drug box';

export type PrescriptionStatus = 'Active' | 'Completed' | 'Stopped' | 'On hold';
export type DoseRoute = 'Oral' | 'Injection' | 'Topical' | 'Inhaled';
export type DoseFrequency = 'Once daily' | 'Twice daily' | 'Weekly' | 'Every X hours' | 'PRN';

export type DoseEventStatus = 'Pending' | 'Taken' | 'Refused' | 'Missed' | 'Held';

export type StockMovementType =
  | 'Stock in'
  | 'Dose taken'
  | 'Adjustment'
  | 'Return'
  | 'Disposal'
  | 'Damage';

export type MovementApprovalStatus = 'Not required' | 'Pending' | 'Approved' | 'Rejected';

export type PurchaseOrderStatus =
  | 'Draft'
  | 'Awaiting approval'
  | 'Approved'
  | 'Ordered'
  | 'Received'
  | 'Cancelled';

export type AlertCode =
  | 'LOW_STOCK'
  | 'EXPIRY'
  | 'MISSED_DOSE'
  | 'OVERDUE_DOSE'
  | 'ABNORMAL_VITAL'
  | 'PRESCRIPTION_ENDING';

export type AlertPriority = 'High' | 'Medium' | 'Low';
export type AlertStatus = 'Open' | 'Acknowledged' | 'Resolved' | 'Escalated';
export type AlertActionType = 'Acknowledged' | 'Resolved' | 'Escalated' | 'Note';

export interface UserRecord {
  userId: string;
  fullName: string;
  username: string;
  email: string | null;
  phone: string | null;
  role: RoleName;
  passwordHash: string;
  isActive: boolean;
  mustChangePassword: boolean;
  tempPasswordExpiresAt: string | null;
  passwordChangedAt: string | null;
  failedLoginCount: number;
  isLocked: boolean;
  lockedAt: string | null;
  mfaEnabled: boolean;
  mfaSecretEncrypted: string | null;
  mfaEnrolledAt: string | null;
  pendingMfaSecretEncrypted?: string | null;
  // Ephemeral one-time plaintext temp password retained ONLY until credential CSV is downloaded once
  pendingTempPasswordForExport?: string | null;
  createdBy: string | null;
  createdAt: string;
  deactivatedAt: string | null;
  deactivatedBy: string | null;
  updatedAt: string;
}

export interface SafeUser {
  userId: string;
  fullName: string;
  username: string;
  email: string | null;
  phone: string | null;
  role: RoleName;
  isActive: boolean;
  mustChangePassword: boolean;
  tempPasswordExpiresAt: string | null;
  isLocked: boolean;
  lockedAt: string | null;
  mfaEnabled: boolean;
  mfaEnrolledAt: string | null;
  hasPendingCredentialExport: boolean;
  createdAt: string;
}

export interface SessionRecord {
  sessionId: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface MfaRecoveryCodeRecord {
  codeId: string;
  userId: string;
  codeHash: string;
  usedAt: string | null;
  createdAt: string;
}

export interface UserPreferenceRecord {
  userId: string;
  themeKey: ThemeKey;
  colorMode: ColorMode;
  updatedAt: string;
}

export interface CredentialExportRecord {
  exportId: string;
  targetUserId: string;
  exportedBy: string;
  exportedAt: string;
}

export interface LoginHistoryRecord {
  loginId: string;
  userId: string | null;
  attemptedUsername: string;
  attemptedAt: string;
  succeeded: boolean;
  ipAddress: string | null;
}

export interface FacilityRecord {
  facilityId: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  registrationNo: string;
}

export interface DoseTimeWindowRecord {
  windowId: string;
  name: string;
  startTime: string;
  endTime: string;
}

export interface VitalTypeRecord {
  vitalTypeId: string;
  code: 'BP_SYSTOLIC' | 'BP_DIASTOLIC' | 'BLOOD_SUGAR' | 'TEMPERATURE' | 'PULSE' | 'SPO2' | 'WEIGHT';
  name: string;
  unit: string;
  minNormal: number | null;
  maxNormal: number | null;
}

export interface AuditLogRecord {
  auditId: number;
  userId: string | null;
  userName?: string;
  action: string;
  tableName: string;
  recordId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  createdAt: string;
}

export interface RoomRecord {
  roomId: string;
  roomCode: string;
  wingOrFloor: string;
}

export interface BedRecord {
  bedId: string;
  roomId: string;
  bedCode: string;
}

export interface ResidentRecord {
  residentId: string;
  fullName: string;
  photoPath: string | null;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  bedId: string | null;
  admissionDate: string;
  dietNotes: string | null;
  assignedDoctorId: string | null;
  status: ResidentStatus;
  archivedAt: string | null;
  archiveReason: string | null;
  allergyStatus: AllergyStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CareAssignmentRecord {
  assignmentId: string;
  caretakerId: string;
  residentId: string;
  assignedBy: string;
  assignedAt: string;
  endedAt: string | null;
  endedBy: string | null;
}

export interface ResidentContactRecord {
  contactId: string;
  residentId: string;
  fullName: string;
  relationship: string;
  phone: string;
  email: string | null;
  isPrimary: boolean;
  receivesNotifications: boolean;
}

export interface ResidentDiagnosisRecord {
  diagnosisId: string;
  residentId: string;
  description: string;
  diagnosedOn: string;
  isActive: boolean;
  recordedBy: string;
}

export interface ResidentHistoryRecord {
  historyId: string;
  residentId: string;
  type: 'Past illness' | 'Surgery' | 'Vaccination';
  description: string;
  eventDate: string;
  recordedBy: string;
}

export interface AllergyRecord {
  allergyId: string;
  residentId: string;
  medicineId: string | null;
  substanceText: string | null;
  reaction: string;
  severity: AllergySeverity;
  recordedBy: string;
  recordedAt: string;
}

export interface ResidentNoteRecord {
  noteId: string;
  residentId: string;
  authorId: string;
  noteType: 'Doctor visit' | 'General';
  body: string;
  createdAt: string;
}

export interface ShiftHandoverNoteRecord {
  noteId: string;
  residentId: string;
  windowId: string;
  shiftDate: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface ResidentDocumentRecord {
  documentId: string;
  residentId: string;
  documentType: 'Lab result' | 'Visit letter' | 'Other';
  storagePath: string;
  fileName: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface MedicineRecord {
  medicineId: string;
  name: string;
  genericName: string;
  form: MedicineForm;
  strength: string;
  stockUnit: StockUnit;
  manufacturer: string;
  category: string;
  foodInstruction: string | null;
  sideEffects: string | null;
  storageCondition: string | null;
  isControlled: boolean;
  status: MedicineStatus;
  approvalStatus: ApprovalStatus;
  proposedBy: string;
  approvedBy: string | null;
  createdAt: string;
}

export interface StorageLocationRecord {
  locationId: string;
  name: string;
  locationType: StorageLocationType;
  isLocked: boolean;
}

export interface FridgeTemperatureLogRecord {
  logId: string;
  locationId: string;
  temperatureC: number;
  recordedAt: string;
  recordedBy: string;
}

export interface PrescriptionRecord {
  prescriptionId: string;
  residentId: string;
  medicineId: string;
  prescribedBy: string;
  reasonDiagnosis: string;
  specialInstructions: string | null;
  allergyOverrideReason: string | null;
  startDate: string;
  endDate: string | null;
  status: PrescriptionStatus;
  stopReason: string | null;
  stoppedAt: string | null;
  renewalReminderDays: number;
  previousPrescriptionId: string | null;
}

export interface DosageScheduleRecord {
  scheduleId: string;
  prescriptionId: string;
  doseAmount: number;
  doseUnit: StockUnit;
  route: DoseRoute;
  frequency: DoseFrequency;
  intervalHours: number | null;
  isPrn: boolean;
  prnMinGapMinutes: number | null;
  prnMaxPerDay: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  changedBy: string;
  changeReason: string | null;
  times: { scheduleTimeId: string; timeOfDay: string; windowId: string }[];
}

export interface DoseEventRecord {
  doseEventId: string;
  scheduleId: string;
  scheduledAt: string;
  status: DoseEventStatus;
  administeredAt: string | null;
  confirmedBy: string | null;
  reason: string | null;
  isManual: boolean;
  createdBy: string;
  undoUntil: string | null;
}

export interface DoseEventStatusLogRecord {
  logId: string;
  doseEventId: string;
  fromStatus: DoseEventStatus;
  toStatus: DoseEventStatus;
  changedBy: string;
  changedAt: string;
  reason: string | null;
}

export interface SupplierRecord {
  supplierId: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string | null;
}

export interface InventoryItemRecord {
  stockId: string;
  medicineId: string;
  batchNumber: string;
  supplierId: string;
  locationId: string;
  purchaseDate: string;
  unitCost: number;
  expiryDate: string;
  reorderLevel: number;
}

export interface StockMovementRecord {
  movementId: string;
  stockId: string;
  movementType: StockMovementType;
  quantityChange: number;
  reason: string | null;
  doseEventId: string | null;
  approvalStatus: MovementApprovalStatus;
  performedBy: string;
  approvedBy: string | null;
  createdAt: string;
}

export interface PurchaseOrderRecord {
  poId: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  createdBy: string;
  approvedBy: string | null;
  createdAt: string;
  approvedAt: string | null;
  lines: { lineId: string; medicineId: string; quantity: number; unitCost: number }[];
}

export interface VitalReadingRecord {
  readingId: string;
  residentId: string;
  recordedAt: string;
  recordedBy: string;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  bloodSugar: number | null;
  bloodSugarUnit: 'mg/dL' | 'mmol/L';
  temperatureC: number | null;
  pulseBpm: number | null;
  spo2Percent: number | null;
  weightKg: number | null;
  notes: string | null;
}

export interface AlertRecord {
  alertId: string;
  alertCode: AlertCode;
  priority: AlertPriority;
  status: AlertStatus;
  residentId: string | null;
  stockId: string | null;
  doseEventId: string | null;
  readingId: string | null;
  prescriptionId: string | null;
  message: string;
  createdAt: string;
  dueBy: string | null;
  escalatedTo: string | null;
}

export interface AlertActionRecord {
  actionId: string;
  alertId: string;
  userId: string;
  action: AlertActionType;
  note: string;
  createdAt: string;
}

export interface NotificationRecord {
  notificationId: string;
  residentContactId: string | null;
  userId: string | null;
  alertId: string | null;
  incidentId: string | null;
  channel: 'SMS' | 'Email';
  status: 'Queued' | 'Sent' | 'Failed';
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface EmergencyIncidentRecord {
  incidentId: string;
  residentId: string;
  reportedBy: string;
  occurredAt: string;
  description: string;
  status: 'Open' | 'Closed';
}

export interface IncidentLogEntryRecord {
  entryId: string;
  incidentId: string;
  loggedBy: string;
  actionTime: string;
  actionTaken: string;
  outcome: string;
  loggedAt: string;
}

export interface AssistantConversationRecord {
  conversationId: string;
  userId: string;
  startedAt: string;
  title: string;
}

export interface AssistantMessageRecord {
  messageId: string;
  conversationId: string;
  sender: 'User' | 'Assistant';
  content: string;
  createdAt: string;
}
