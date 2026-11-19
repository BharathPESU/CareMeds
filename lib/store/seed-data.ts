import { randomUUID } from 'node:crypto';
import { hashPassword } from '../auth/password';
import type {
  AlertActionRecord,
  AlertRecord,
  AllergyRecord,
  AssistantConversationRecord,
  AssistantMessageRecord,
  AuditLogRecord,
  BedRecord,
  CareAssignmentRecord,
  CredentialExportRecord,
  DosageScheduleRecord,
  DoseEventRecord,
  DoseEventStatusLogRecord,
  DoseTimeWindowRecord,
  EmergencyIncidentRecord,
  FacilityRecord,
  FridgeTemperatureLogRecord,
  IncidentLogEntryRecord,
  InventoryItemRecord,
  LoginHistoryRecord,
  MedicineRecord,
  MfaRecoveryCodeRecord,
  NotificationRecord,
  PrescriptionRecord,
  PurchaseOrderRecord,
  ResidentContactRecord,
  ResidentDiagnosisRecord,
  ResidentDocumentRecord,
  ResidentHistoryRecord,
  ResidentNoteRecord,
  ResidentRecord,
  RoomRecord,
  SessionRecord,
  ShiftHandoverNoteRecord,
  StockMovementRecord,
  StorageLocationRecord,
  SupplierRecord,
  UserPreferenceRecord,
  UserRecord,
  VitalReadingRecord,
  VitalTypeRecord,
} from '../types';

export interface CareMedsStoreData {
  facility: FacilityRecord;
  systemSettings: Record<string, string>;
  doseTimeWindows: DoseTimeWindowRecord[];
  vitalTypes: VitalTypeRecord[];
  users: UserRecord[];
  sessions: SessionRecord[];
  mfaRecoveryCodes: MfaRecoveryCodeRecord[];
  userPreferences: UserPreferenceRecord[];
  credentialExports: CredentialExportRecord[];
  loginHistory: LoginHistoryRecord[];
  auditLog: AuditLogRecord[];
  nextAuditId: number;
  rooms: RoomRecord[];
  beds: BedRecord[];
  residents: ResidentRecord[];
  careAssignments: CareAssignmentRecord[];
  residentContacts: ResidentContactRecord[];
  residentDiagnoses: ResidentDiagnosisRecord[];
  residentHistory: ResidentHistoryRecord[];
  allergies: AllergyRecord[];
  residentNotes: ResidentNoteRecord[];
  shiftHandoverNotes: ShiftHandoverNoteRecord[];
  residentDocuments: ResidentDocumentRecord[];
  medicines: MedicineRecord[];
  storageLocations: StorageLocationRecord[];
  fridgeTemperatureLogs: FridgeTemperatureLogRecord[];
  prescriptions: PrescriptionRecord[];
  dosageSchedules: DosageScheduleRecord[];
  doseEvents: DoseEventRecord[];
  doseEventStatusLog: DoseEventStatusLogRecord[];
  suppliers: SupplierRecord[];
  inventoryItems: InventoryItemRecord[];
  stockMovements: StockMovementRecord[];
  purchaseOrders: PurchaseOrderRecord[];
  vitalReadings: VitalReadingRecord[];
  alerts: AlertRecord[];
  alertActions: AlertActionRecord[];
  notifications: NotificationRecord[];
  emergencyIncidents: EmergencyIncidentRecord[];
  incidentLogEntries: IncidentLogEntryRecord[];
  assistantConversations: AssistantConversationRecord[];
  assistantMessages: AssistantMessageRecord[];
}

function isoOffsetDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoTodayAt(hourIst: number, minuteIst: number): string {
  // Convert IST (UTC+5:30) wall-clock time on today's date to UTC ISO string
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const day = now.getUTCDate();
  const utcMs = Date.UTC(y, m, day, hourIst, minuteIst, 0) - 330 * 60_000;
  return new Date(utcMs).toISOString();
}

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

export function createInitialPreviewStore(): CareMedsStoreData {
  const nowIso = new Date().toISOString();
  const todayIso = nowIso.slice(0, 10);

  // Use random unguessable hashes for preview accounts (preview sign-in uses server role switcher)
  const lockedHash = hashPassword(randomUUID() + randomUUID());

  const admin1Id = '10000000-0000-4000-8000-000000000001';
  const admin2Id = '10000000-0000-4000-8000-000000000002';
  const doctor1Id = '10000000-0000-4000-8000-000000000003';
  const doctor2Id = '10000000-0000-4000-8000-000000000004';
  const caretaker1Id = '10000000-0000-4000-8000-000000000005';
  const caretaker2Id = '10000000-0000-4000-8000-000000000006';

  const winMorning = '20000000-0000-4000-8000-000000000001';
  const winAfternoon = '20000000-0000-4000-8000-000000000002';
  const winEvening = '20000000-0000-4000-8000-000000000003';
  const winNight = '20000000-0000-4000-8000-000000000004';

  const room101 = '30000000-0000-4000-8000-000000000001';
  const room102 = '30000000-0000-4000-8000-000000000002';
  const room103 = '30000000-0000-4000-8000-000000000003';
  const room201 = '30000000-0000-4000-8000-000000000004';
  const room202 = '30000000-0000-4000-8000-000000000005';

  const bed101A = '31000000-0000-4000-8000-000000000001';
  const bed101B = '31000000-0000-4000-8000-000000000002';
  const bed102A = '31000000-0000-4000-8000-000000000003';
  const bed103A = '31000000-0000-4000-8000-000000000004';
  const bed201A = '31000000-0000-4000-8000-000000000005';
  const bed202A = '31000000-0000-4000-8000-000000000006';
  const bed202B = '31000000-0000-4000-8000-000000000007';

  const res1 = '40000000-0000-4000-8000-000000000001';
  const res2 = '40000000-0000-4000-8000-000000000002';
  const res3 = '40000000-0000-4000-8000-000000000003';
  const res4 = '40000000-0000-4000-8000-000000000004';
  const res5 = '40000000-0000-4000-8000-000000000005';
  const res6 = '40000000-0000-4000-8000-000000000006';

  const medAmlodipine = '50000000-0000-4000-8000-000000000001';
  const medMetformin = '50000000-0000-4000-8000-000000000002';
  const medAtorvastatin = '50000000-0000-4000-8000-000000000003';
  const medInsulin = '50000000-0000-4000-8000-000000000004';
  const medAmoxicillin = '50000000-0000-4000-8000-000000000005';
  const medAspirin = '50000000-0000-4000-8000-000000000006';
  const medSalbutamol = '50000000-0000-4000-8000-000000000007';
  const medLorazepam = '50000000-0000-4000-8000-000000000008';
  const medDonepezilPending = '50000000-0000-4000-8000-000000000009';

  const locCabinet = '55000000-0000-4000-8000-000000000001';
  const locShelf = '55000000-0000-4000-8000-000000000002';
  const locFridge = '55000000-0000-4000-8000-000000000003';
  const locControlled = '55000000-0000-4000-8000-000000000004';

  const sup1 = '56000000-0000-4000-8000-000000000001';
  const sup2 = '56000000-0000-4000-8000-000000000002';

  const stockAmlo1 = '57000000-0000-4000-8000-000000000001';
  const stockAmlo2 = '57000000-0000-4000-8000-000000000002';
  const stockMet1 = '57000000-0000-4000-8000-000000000003';
  const stockAtor1 = '57000000-0000-4000-8000-000000000004';
  const stockIns1 = '57000000-0000-4000-8000-000000000005';
  const stockAsp1 = '57000000-0000-4000-8000-000000000006';
  const stockSalb1 = '57000000-0000-4000-8000-000000000007';
  const stockLora1 = '57000000-0000-4000-8000-000000000008';
  const stockExpired = '57000000-0000-4000-8000-000000000009';

  const rx1 = '60000000-0000-4000-8000-000000000001';
  const rx2 = '60000000-0000-4000-8000-000000000002';
  const rx3 = '60000000-0000-4000-8000-000000000003';
  const rx4 = '60000000-0000-4000-8000-000000000004';
  const rx5 = '60000000-0000-4000-8000-000000000005';
  const rx6 = '60000000-0000-4000-8000-000000000006';
  const rx7 = '60000000-0000-4000-8000-000000000007';

  const sch1 = '61000000-0000-4000-8000-000000000001';
  const sch2 = '61000000-0000-4000-8000-000000000002';
  const sch3 = '61000000-0000-4000-8000-000000000003';
  const sch4 = '61000000-0000-4000-8000-000000000004';
  const sch5 = '61000000-0000-4000-8000-000000000005';
  const sch6 = '61000000-0000-4000-8000-000000000006';
  const sch7 = '61000000-0000-4000-8000-000000000007';

  const dose1 = '62000000-0000-4000-8000-000000000001';
  const dose2 = '62000000-0000-4000-8000-000000000002';
  const dose3 = '62000000-0000-4000-8000-000000000003';
  const dose4 = '62000000-0000-4000-8000-000000000004';
  const dose5 = '62000000-0000-4000-8000-000000000005';
  const dose6 = '62000000-0000-4000-8000-000000000006';
  const dose7 = '62000000-0000-4000-8000-000000000007';
  const dose8 = '62000000-0000-4000-8000-000000000008';

  const alert1 = '70000000-0000-4000-8000-000000000001';
  const alert2 = '70000000-0000-4000-8000-000000000002';
  const alert3 = '70000000-0000-4000-8000-000000000003';
  const alert4 = '70000000-0000-4000-8000-000000000004';

  const inc1 = '80000000-0000-4000-8000-000000000001';

  return {
    facility: {
      facilityId: '00000000-0000-4000-8000-000000000001',
      name: 'Shanti Niketan Senior Care',
      address: '14 Gulmohar Road, Juhu, Mumbai 400049, Maharashtra',
      phone: '+91 22 2620 4418',
      email: 'care@shantiniketan.example.in',
      registrationNo: 'MH-MUM-CARE-2021-0482',
    },
    systemSettings: {
      setup_completed: 'true',
      session_idle_minutes: '15',
      session_max_hours: '12',
      lockout_threshold: '5',
      require_mfa_caretakers: 'false',
      expiry_warning_days: '60',
      escalation_minutes: '15',
      undo_window_minutes: '5',
      renewal_reminder_days: '7',
      overdue_grace_minutes: '60',
      default_theme: 'clinical-calm',
      default_color_mode: 'system',
    },
    doseTimeWindows: [
      { windowId: winMorning, name: 'Morning', startTime: '06:00', endTime: '11:59' },
      { windowId: winAfternoon, name: 'Afternoon', startTime: '12:00', endTime: '16:59' },
      { windowId: winEvening, name: 'Evening', startTime: '17:00', endTime: '20:59' },
      { windowId: winNight, name: 'Night', startTime: '21:00', endTime: '05:59' },
    ],
    // Vital thresholds start NULL per CareMeds specification; the facility doctor enters them during setup.
    vitalTypes: [
      { vitalTypeId: '21000000-0000-4000-8000-000000000001', code: 'BP_SYSTOLIC', name: 'Blood Pressure (Systolic)', unit: 'mmHg', minNormal: null, maxNormal: null },
      { vitalTypeId: '21000000-0000-4000-8000-000000000002', code: 'BP_DIASTOLIC', name: 'Blood Pressure (Diastolic)', unit: 'mmHg', minNormal: null, maxNormal: null },
      { vitalTypeId: '21000000-0000-4000-8000-000000000003', code: 'BLOOD_SUGAR', name: 'Blood Sugar', unit: 'mg/dL', minNormal: null, maxNormal: null },
      { vitalTypeId: '21000000-0000-4000-8000-000000000004', code: 'TEMPERATURE', name: 'Body Temperature', unit: '°C', minNormal: null, maxNormal: null },
      { vitalTypeId: '21000000-0000-4000-8000-000000000005', code: 'PULSE', name: 'Pulse Rate', unit: 'bpm', minNormal: null, maxNormal: null },
      { vitalTypeId: '21000000-0000-4000-8000-000000000006', code: 'SPO2', name: 'Oxygen Saturation (SpO2)', unit: '%', minNormal: null, maxNormal: null },
      { vitalTypeId: '21000000-0000-4000-8000-000000000007', code: 'WEIGHT', name: 'Body Weight', unit: 'kg', minNormal: null, maxNormal: null },
    ],
    users: [
      {
        userId: admin1Id,
        fullName: 'Meera Krishnan',
        username: 'meera.krishnan',
        email: 'meera.krishnan@shantiniketan.example.in',
        phone: '+91 98201 11001',
        role: 'Admin',
        passwordHash: lockedHash,
        isActive: true,
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
        passwordChangedAt: isoHoursAgo(240),
        failedLoginCount: 0,
        isLocked: false,
        lockedAt: null,
        mfaEnabled: true,
        mfaSecretEncrypted: null,
        mfaEnrolledAt: isoHoursAgo(240),
        createdBy: null,
        createdAt: isoHoursAgo(480),
        deactivatedAt: null,
        deactivatedBy: null,
        updatedAt: nowIso,
      },
      {
        userId: admin2Id,
        fullName: 'Vikram Menon',
        username: 'vikram.menon',
        email: 'vikram.menon@shantiniketan.example.in',
        phone: '+91 98201 11002',
        role: 'Admin',
        passwordHash: lockedHash,
        isActive: true,
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
        passwordChangedAt: isoHoursAgo(200),
        failedLoginCount: 0,
        isLocked: false,
        lockedAt: null,
        mfaEnabled: true,
        mfaSecretEncrypted: null,
        mfaEnrolledAt: isoHoursAgo(200),
        createdBy: admin1Id,
        createdAt: isoHoursAgo(420),
        deactivatedAt: null,
        deactivatedBy: null,
        updatedAt: nowIso,
      },
      {
        userId: doctor1Id,
        fullName: 'Dr. Ananya Desai',
        username: 'ananya.desai',
        email: 'ananya.desai@shantiniketan.example.in',
        phone: '+91 98201 22001',
        role: 'Doctor',
        passwordHash: lockedHash,
        isActive: true,
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
        passwordChangedAt: isoHoursAgo(180),
        failedLoginCount: 0,
        isLocked: false,
        lockedAt: null,
        mfaEnabled: true,
        mfaSecretEncrypted: null,
        mfaEnrolledAt: isoHoursAgo(180),
        createdBy: admin1Id,
        createdAt: isoHoursAgo(400),
        deactivatedAt: null,
        deactivatedBy: null,
        updatedAt: nowIso,
      },
      {
        userId: doctor2Id,
        fullName: 'Dr. Rajesh Kulkarni',
        username: 'rajesh.kulkarni',
        email: 'rajesh.kulkarni@shantiniketan.example.in',
        phone: '+91 98201 22002',
        role: 'Doctor',
        passwordHash: lockedHash,
        isActive: true,
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
        passwordChangedAt: isoHoursAgo(160),
        failedLoginCount: 0,
        isLocked: false,
        lockedAt: null,
        mfaEnabled: true,
        mfaSecretEncrypted: null,
        mfaEnrolledAt: isoHoursAgo(160),
        createdBy: admin1Id,
        createdAt: isoHoursAgo(360),
        deactivatedAt: null,
        deactivatedBy: null,
        updatedAt: nowIso,
      },
      {
        userId: caretaker1Id,
        fullName: 'Priya Nair',
        username: 'priya.nair',
        email: 'priya.nair@shantiniketan.example.in',
        phone: '+91 98201 33001',
        role: 'Caretaker',
        passwordHash: lockedHash,
        isActive: true,
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
        passwordChangedAt: isoHoursAgo(120),
        failedLoginCount: 0,
        isLocked: false,
        lockedAt: null,
        mfaEnabled: false,
        mfaSecretEncrypted: null,
        mfaEnrolledAt: null,
        createdBy: admin1Id,
        createdAt: isoHoursAgo(350),
        deactivatedAt: null,
        deactivatedBy: null,
        updatedAt: nowIso,
      },
      {
        userId: caretaker2Id,
        fullName: 'Suresh Patel',
        username: 'suresh.patel',
        email: 'suresh.patel@shantiniketan.example.in',
        phone: '+91 98201 33002',
        role: 'Caretaker',
        passwordHash: lockedHash,
        isActive: true,
        mustChangePassword: false,
        tempPasswordExpiresAt: null,
        passwordChangedAt: isoHoursAgo(96),
        failedLoginCount: 0,
        isLocked: false,
        lockedAt: null,
        mfaEnabled: false,
        mfaSecretEncrypted: null,
        mfaEnrolledAt: null,
        createdBy: admin1Id,
        createdAt: isoHoursAgo(300),
        deactivatedAt: null,
        deactivatedBy: null,
        updatedAt: nowIso,
      },
    ],
    sessions: [],
    mfaRecoveryCodes: [],
    userPreferences: [],
    credentialExports: [],
    loginHistory: [
      {
        loginId: randomUUID(),
        userId: caretaker1Id,
        attemptedUsername: 'priya.nair',
        attemptedAt: isoHoursAgo(3),
        succeeded: true,
        ipAddress: '10.12.4.18',
      },
      {
        loginId: randomUUID(),
        userId: doctor1Id,
        attemptedUsername: 'ananya.desai',
        attemptedAt: isoHoursAgo(2),
        succeeded: true,
        ipAddress: '10.12.4.22',
      },
      {
        loginId: randomUUID(),
        userId: admin1Id,
        attemptedUsername: 'meera.krishnan',
        attemptedAt: isoHoursAgo(1),
        succeeded: true,
        ipAddress: '10.12.4.10',
      },
    ],
    rooms: [
      { roomId: room101, roomCode: '101', wingOrFloor: 'Ground Floor · East Wing' },
      { roomId: room102, roomCode: '102', wingOrFloor: 'Ground Floor · East Wing' },
      { roomId: room103, roomCode: '103', wingOrFloor: 'Ground Floor · East Wing' },
      { roomId: room201, roomCode: '201', wingOrFloor: 'First Floor · Garden Wing' },
      { roomId: room202, roomCode: '202', wingOrFloor: 'First Floor · Garden Wing' },
    ],
    beds: [
      { bedId: bed101A, roomId: room101, bedCode: 'A' },
      { bedId: bed101B, roomId: room101, bedCode: 'B' },
      { bedId: bed102A, roomId: room102, bedCode: 'A' },
      { bedId: bed103A, roomId: room103, bedCode: 'A' },
      { bedId: bed201A, roomId: room201, bedCode: 'A' },
      { bedId: bed202A, roomId: room202, bedCode: 'A' },
      { bedId: bed202B, roomId: room202, bedCode: 'B' },
    ],
    residents: [
      {
        residentId: res1,
        fullName: 'Kamala Subramanian',
        photoPath: null,
        dateOfBirth: '1943-04-12',
        gender: 'Female',
        bloodGroup: 'O+',
        bedId: bed101A,
        admissionDate: '2024-02-15',
        dietNotes: 'Low-sodium vegetarian diet; avoid grapefruit.',
        assignedDoctorId: doctor1Id,
        status: 'Active',
        archivedAt: null,
        archiveReason: null,
        allergyStatus: 'Recorded',
        createdBy: admin1Id,
        createdAt: isoHoursAgo(500),
        updatedAt: nowIso,
      },
      {
        residentId: res2,
        fullName: 'Harishchandra Joshi',
        photoPath: null,
        dateOfBirth: '1939-11-28',
        gender: 'Male',
        bloodGroup: 'B+',
        bedId: bed102A,
        admissionDate: '2023-09-04',
        dietNotes: 'Diabetic soft diet; small frequent meals.',
        assignedDoctorId: doctor1Id,
        status: 'Active',
        archivedAt: null,
        archiveReason: null,
        allergyStatus: 'Recorded',
        createdBy: admin1Id,
        createdAt: isoHoursAgo(500),
        updatedAt: nowIso,
      },
      {
        residentId: res3,
        fullName: 'Margaret D’Souza',
        photoPath: null,
        dateOfBirth: '1946-07-19',
        gender: 'Female',
        bloodGroup: 'A+',
        bedId: bed103A,
        admissionDate: '2025-01-10',
        dietNotes: 'High-protein diet; monitor fluid intake.',
        assignedDoctorId: doctor1Id,
        status: 'Active',
        archivedAt: null,
        archiveReason: null,
        allergyStatus: 'None known',
        createdBy: admin1Id,
        createdAt: isoHoursAgo(480),
        updatedAt: nowIso,
      },
      {
        residentId: res4,
        fullName: 'Raghavendra Rao',
        photoPath: null,
        dateOfBirth: '1941-01-05',
        gender: 'Male',
        bloodGroup: 'AB+',
        bedId: bed201A,
        admissionDate: '2024-06-22',
        dietNotes: 'Cardiac low-fat diet; warm water with evening medicines.',
        assignedDoctorId: doctor1Id,
        status: 'Active',
        archivedAt: null,
        archiveReason: null,
        allergyStatus: 'Unknown',
        createdBy: admin1Id,
        createdAt: isoHoursAgo(460),
        updatedAt: nowIso,
      },
      {
        residentId: res5,
        fullName: 'Shanta Gokhale',
        photoPath: null,
        dateOfBirth: '1944-09-30',
        gender: 'Female',
        bloodGroup: 'O-',
        bedId: bed202A,
        admissionDate: '2024-10-12',
        dietNotes: 'No nuts; prefers warm milk before bedtime.',
        assignedDoctorId: doctor2Id,
        status: 'Active',
        archivedAt: null,
        archiveReason: null,
        allergyStatus: 'Recorded',
        createdBy: admin1Id,
        createdAt: isoHoursAgo(420),
        updatedAt: nowIso,
      },
      {
        residentId: res6,
        fullName: 'Dilip Kumar Chatterjee',
        photoPath: null,
        dateOfBirth: '1938-03-17',
        gender: 'Male',
        bloodGroup: 'A-',
        bedId: bed101B,
        admissionDate: '2023-12-01',
        dietNotes: 'Mechanical soft diet; upright for 30 min after meals.',
        assignedDoctorId: doctor2Id,
        status: 'Active',
        archivedAt: null,
        archiveReason: null,
        allergyStatus: 'None known',
        createdBy: admin1Id,
        createdAt: isoHoursAgo(400),
        updatedAt: nowIso,
      },
    ],
    careAssignments: [
      { assignmentId: '41000000-0000-4000-8000-000000000001', caretakerId: caretaker1Id, residentId: res1, assignedBy: doctor1Id, assignedAt: isoHoursAgo(300), endedAt: null, endedBy: null },
      { assignmentId: '41000000-0000-4000-8000-000000000002', caretakerId: caretaker1Id, residentId: res2, assignedBy: doctor1Id, assignedAt: isoHoursAgo(300), endedAt: null, endedBy: null },
      { assignmentId: '41000000-0000-4000-8000-000000000003', caretakerId: caretaker1Id, residentId: res3, assignedBy: doctor1Id, assignedAt: isoHoursAgo(240), endedAt: null, endedBy: null },
      { assignmentId: '41000000-0000-4000-8000-000000000004', caretakerId: caretaker1Id, residentId: res4, assignedBy: doctor1Id, assignedAt: isoHoursAgo(240), endedAt: null, endedBy: null },
      { assignmentId: '41000000-0000-4000-8000-000000000005', caretakerId: caretaker2Id, residentId: res5, assignedBy: doctor2Id, assignedAt: isoHoursAgo(200), endedAt: null, endedBy: null },
      { assignmentId: '41000000-0000-4000-8000-000000000006', caretakerId: caretaker2Id, residentId: res6, assignedBy: doctor2Id, assignedAt: isoHoursAgo(200), endedAt: null, endedBy: null },
      // Historical ended assignment to demonstrate assignment history
      { assignmentId: '41000000-0000-4000-8000-000000000007', caretakerId: caretaker2Id, residentId: res1, assignedBy: admin1Id, assignedAt: isoHoursAgo(600), endedAt: isoHoursAgo(310), endedBy: admin1Id },
    ],
    residentContacts: [
      { contactId: '42000000-0000-4000-8000-000000000001', residentId: res1, fullName: 'Arvind Subramanian', relationship: 'Son', phone: '+91 98202 55101', email: 'arvind.sub@example.in', isPrimary: true, receivesNotifications: true },
      { contactId: '42000000-0000-4000-8000-000000000002', residentId: res2, fullName: 'Nandini Joshi', relationship: 'Daughter', phone: '+91 98202 55102', email: 'nandini.j@example.in', isPrimary: true, receivesNotifications: true },
      { contactId: '42000000-0000-4000-8000-000000000003', residentId: res3, fullName: 'Peter D’Souza', relationship: 'Son', phone: '+91 98202 55103', email: 'peter.ds@example.in', isPrimary: true, receivesNotifications: true },
      { contactId: '42000000-0000-4000-8000-000000000004', residentId: res4, fullName: 'Kavitha Rao', relationship: 'Daughter', phone: '+91 98202 55104', email: 'kavitha.rao@example.in', isPrimary: true, receivesNotifications: false },
      { contactId: '42000000-0000-4000-8000-000000000005', residentId: res5, fullName: 'Milind Gokhale', relationship: 'Son', phone: '+91 98202 55105', email: 'milind.g@example.in', isPrimary: true, receivesNotifications: true },
      { contactId: '42000000-0000-4000-8000-000000000006', residentId: res6, fullName: 'Rituparna Chatterjee', relationship: 'Daughter', phone: '+91 98202 55106', email: 'ritu.c@example.in', isPrimary: true, receivesNotifications: true },
    ],
    residentDiagnoses: [
      { diagnosisId: randomUUID(), residentId: res1, description: 'Essential Hypertension (Stage 2)', diagnosedOn: '2018-05-14', isActive: true, recordedBy: doctor1Id },
      { diagnosisId: randomUUID(), residentId: res1, description: 'Hyperlipidemia', diagnosedOn: '2020-03-08', isActive: true, recordedBy: doctor1Id },
      { diagnosisId: randomUUID(), residentId: res2, description: 'Type 2 Diabetes Mellitus', diagnosedOn: '2015-08-21', isActive: true, recordedBy: doctor1Id },
      { diagnosisId: randomUUID(), residentId: res3, description: 'Mild Persistent Bronchial Asthma', diagnosedOn: '2019-11-11', isActive: true, recordedBy: doctor1Id },
      { diagnosisId: randomUUID(), residentId: res4, description: 'Stable Coronary Artery Disease', diagnosedOn: '2021-04-02', isActive: true, recordedBy: doctor1Id },
      { diagnosisId: randomUUID(), residentId: res5, description: 'Essential Hypertension', diagnosedOn: '2017-01-19', isActive: true, recordedBy: doctor2Id },
    ],
    residentHistory: [
      { historyId: randomUUID(), residentId: res1, type: 'Vaccination', description: 'Seasonal Influenza Vaccine (Quadrivalent)', eventDate: '2026-10-05', recordedBy: doctor1Id },
      { historyId: randomUUID(), residentId: res2, type: 'Surgery', description: 'Right eye cataract phacoemulsification', eventDate: '2022-02-18', recordedBy: doctor1Id },
      { historyId: randomUUID(), residentId: res3, type: 'Vaccination', description: 'Pneumococcal PCV13 Booster', eventDate: '2025-11-12', recordedBy: doctor1Id },
    ],
    allergies: [
      {
        allergyId: '43000000-0000-4000-8000-000000000001',
        residentId: res1,
        medicineId: medAmoxicillin,
        substanceText: null,
        reaction: 'Anaphylactic bronchospasm and generalized urticaria',
        severity: 'Severe',
        recordedBy: doctor1Id,
        recordedAt: isoHoursAgo(480),
      },
      {
        allergyId: '43000000-0000-4000-8000-000000000002',
        residentId: res2,
        medicineId: medAspirin,
        substanceText: null,
        reaction: 'Mild epigastric discomfort and rash',
        severity: 'Mild',
        recordedBy: doctor1Id,
        recordedAt: isoHoursAgo(450),
      },
      {
        allergyId: '43000000-0000-4000-8000-000000000003',
        residentId: res5,
        medicineId: null,
        substanceText: 'Peanuts',
        reaction: 'Facial swelling and hives',
        severity: 'Moderate',
        recordedBy: doctor2Id,
        recordedAt: isoHoursAgo(400),
      },
    ],
    residentNotes: [
      {
        noteId: randomUUID(),
        residentId: res1,
        authorId: doctor1Id,
        noteType: 'Doctor visit',
        body: 'Morning BP stable at 132/82 mmHg. Continue current Amlodipine 5 mg and Atorvastatin 10 mg regimen. Review lipid panel next month.',
        createdAt: isoHoursAgo(26),
      },
      {
        noteId: randomUUID(),
        residentId: res2,
        authorId: doctor1Id,
        noteType: 'Doctor visit',
        body: 'Fasting glucose slightly elevated at 154 mg/dL. Monitor pre-breakfast readings for 5 days; reinforce evening walk.',
        createdAt: isoHoursAgo(18),
      },
    ],
    shiftHandoverNotes: [
      {
        noteId: randomUUID(),
        residentId: res1,
        windowId: winMorning,
        shiftDate: todayIso,
        authorId: caretaker1Id,
        body: 'Slept well, good appetite at breakfast. Evening Atorvastatin batch verified in Cabinet A.',
        createdAt: isoHoursAgo(2),
      },
      {
        noteId: randomUUID(),
        residentId: res2,
        windowId: winMorning,
        shiftDate: todayIso,
        authorId: caretaker1Id,
        body: 'Requested warm water before Metformin. Please check afternoon blood sugar before tea.',
        createdAt: isoHoursAgo(1),
      },
    ],
    residentDocuments: [
      {
        documentId: randomUUID(),
        residentId: res1,
        documentType: 'Lab result',
        storagePath: `resident-documents/${res1}/lipid-panel-2026-10.pdf`,
        fileName: 'Lipid_Panel_Oct2026.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 248320,
        uploadedBy: doctor1Id,
        uploadedAt: isoHoursAgo(72),
      },
      {
        documentId: randomUUID(),
        residentId: res2,
        documentType: 'Lab result',
        storagePath: `resident-documents/${res2}/hba1c-2026-11.pdf`,
        fileName: 'HbA1c_Nov2026.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 184100,
        uploadedBy: doctor1Id,
        uploadedAt: isoHoursAgo(48),
      },
    ],
    medicines: [
      {
        medicineId: medAmlodipine,
        name: 'Amlong 5',
        genericName: 'Amlodipine Besylate',
        form: 'Tablet',
        strength: '5 mg',
        stockUnit: 'tablet',
        manufacturer: 'Micro Labs',
        category: 'Antihypertensive',
        foodInstruction: 'With or without food',
        sideEffects: 'Mild ankle edema, dizziness on standing',
        storageCondition: 'Store below 25°C in a dry cabinet',
        isControlled: false,
        status: 'Active',
        approvalStatus: 'Approved',
        proposedBy: doctor1Id,
        approvedBy: admin1Id,
        createdAt: isoHoursAgo(500),
      },
      {
        medicineId: medMetformin,
        name: 'Glycomet 500 SR',
        genericName: 'Metformin Hydrochloride',
        form: 'Tablet',
        strength: '500 mg',
        stockUnit: 'tablet',
        manufacturer: 'USV Pharma',
        category: 'Antidiabetic',
        foodInstruction: 'Take immediately after meals',
        sideEffects: 'Mild nausea or GI upset initially',
        storageCondition: 'Room temperature, protect from moisture',
        isControlled: false,
        status: 'Active',
        approvalStatus: 'Approved',
        proposedBy: doctor1Id,
        approvedBy: admin1Id,
        createdAt: isoHoursAgo(500),
      },
      {
        medicineId: medAtorvastatin,
        name: 'Atorva 10',
        genericName: 'Atorvastatin Calcium',
        form: 'Tablet',
        strength: '10 mg',
        stockUnit: 'tablet',
        manufacturer: 'Zydus Cadila',
        category: 'Statin / Lipid-lowering',
        foodInstruction: 'Evening dose, avoid grapefruit',
        sideEffects: 'Muscle ache, mild fatigue',
        storageCondition: 'Store below 25°C',
        isControlled: false,
        status: 'Active',
        approvalStatus: 'Approved',
        proposedBy: doctor1Id,
        approvedBy: admin1Id,
        createdAt: isoHoursAgo(500),
      },
      {
        medicineId: medInsulin,
        name: 'Lantus SoloStar',
        genericName: 'Insulin Glargine',
        form: 'Injection',
        strength: '100 IU/mL',
        stockUnit: 'vial',
        manufacturer: 'Sanofi',
        category: 'Long-acting Insulin',
        foodInstruction: 'Subcutaneous injection at fixed evening time',
        sideEffects: 'Hypoglycemia, injection site redness',
        storageCondition: 'Refrigerate at 2°C – 8°C; do not freeze',
        isControlled: false,
        status: 'Active',
        approvalStatus: 'Approved',
        proposedBy: doctor1Id,
        approvedBy: admin1Id,
        createdAt: isoHoursAgo(500),
      },
      {
        medicineId: medAmoxicillin,
        name: 'Mox 500',
        genericName: 'Amoxicillin Trihydrate',
        form: 'Capsule',
        strength: '500 mg',
        stockUnit: 'capsule',
        manufacturer: 'Sun Pharma',
        category: 'Penicillin Antibiotic',
        foodInstruction: 'Take with a full glass of water',
        sideEffects: 'Diarrhea, hypersensitivity rash',
        storageCondition: 'Store below 25°C',
        isControlled: false,
        status: 'Active',
        approvalStatus: 'Approved',
        proposedBy: doctor2Id,
        approvedBy: admin1Id,
        createdAt: isoHoursAgo(480),
      },
      {
        medicineId: medAspirin,
        name: 'Ecosprin 75',
        genericName: 'Aspirin (Acetylsalicylic Acid)',
        form: 'Tablet',
        strength: '75 mg',
        stockUnit: 'tablet',
        manufacturer: 'USV Pharma',
        category: 'Antiplatelet',
        foodInstruction: 'Take after breakfast',
        sideEffects: 'Gastric irritation, bruising',
        storageCondition: 'Dry shelf below 25°C',
        isControlled: false,
        status: 'Active',
        approvalStatus: 'Approved',
        proposedBy: doctor1Id,
        approvedBy: admin1Id,
        createdAt: isoHoursAgo(480),
      },
      {
        medicineId: medSalbutamol,
        name: 'Asthalin Inhaler',
        genericName: 'Salbutamol Sulphate',
        form: 'Inhaler',
        strength: '100 mcg/actuation',
        stockUnit: 'inhaler',
        manufacturer: 'Cipla',
        category: 'Bronchodilator',
        foodInstruction: 'Shake well before inhalation; rinse mouth',
        sideEffects: 'Mild tremor, palpitations',
        storageCondition: 'Store below 30°C away from direct heat',
        isControlled: false,
        status: 'Active',
        approvalStatus: 'Approved',
        proposedBy: doctor1Id,
        approvedBy: admin1Id,
        createdAt: isoHoursAgo(460),
      },
      {
        medicineId: medLorazepam,
        name: 'Ativan 1',
        genericName: 'Lorazepam',
        form: 'Tablet',
        strength: '1 mg',
        stockUnit: 'tablet',
        manufacturer: 'Pfizer',
        category: 'Controlled Benzodiazepine',
        foodInstruction: 'Bedtime only if prescribed; fall-risk precaution',
        sideEffects: 'Sedation, unsteadiness',
        storageCondition: 'Locked controlled-drug box; dual-count log',
        isControlled: true,
        status: 'Active',
        approvalStatus: 'Approved',
        proposedBy: doctor2Id,
        approvedBy: admin1Id,
        createdAt: isoHoursAgo(450),
      },
      {
        medicineId: medDonepezilPending,
        name: 'Donep 5',
        genericName: 'Donepezil Hydrochloride',
        form: 'Tablet',
        strength: '5 mg',
        stockUnit: 'tablet',
        manufacturer: 'Alkem Laboratories',
        category: 'Cholinesterase Inhibitor',
        foodInstruction: 'Take at bedtime',
        sideEffects: 'Mild nausea, vivid dreams',
        storageCondition: 'Store below 25°C',
        isControlled: false,
        status: 'Active',
        approvalStatus: 'Pending',
        proposedBy: doctor1Id,
        approvedBy: null,
        createdAt: isoHoursAgo(12),
      },
    ],
    storageLocations: [
      { locationId: locCabinet, name: 'Main Dispensary Cabinet A', locationType: 'Cabinet', isLocked: true },
      { locationId: locShelf, name: 'Dispensary Shelf B (Oral Solids)', locationType: 'Shelf', isLocked: false },
      { locationId: locFridge, name: 'Cold Chain Fridge 1', locationType: 'Fridge', isLocked: true },
      { locationId: locControlled, name: 'Controlled Drug Vault Box', locationType: 'Locked controlled-drug box', isLocked: true },
    ],
    fridgeTemperatureLogs: [
      { logId: randomUUID(), locationId: locFridge, temperatureC: 4.2, recordedAt: isoHoursAgo(24), recordedBy: caretaker1Id },
      { logId: randomUUID(), locationId: locFridge, temperatureC: 4.5, recordedAt: isoHoursAgo(12), recordedBy: caretaker2Id },
      { logId: randomUUID(), locationId: locFridge, temperatureC: 4.1, recordedAt: isoHoursAgo(2), recordedBy: caretaker1Id },
    ],
    suppliers: [
      { supplierId: sup1, name: 'Sahyadri Medical Distributors', contactPerson: 'Ramesh Iyer', phone: '+91 22 2418 7790', email: 'orders@sahyadrimed.example.in' },
      { supplierId: sup2, name: 'Western Cold-Chain Pharma', contactPerson: 'Farida Merchant', phone: '+91 22 2681 3340', email: 'supply@westerncold.example.in' },
    ],
    inventoryItems: [
      { stockId: stockAmlo1, medicineId: medAmlodipine, batchNumber: 'AML-2604', supplierId: sup1, locationId: locCabinet, purchaseDate: isoOffsetDays(-90), unitCost: 3.4, expiryDate: isoOffsetDays(38), reorderLevel: 30 },
      { stockId: stockAmlo2, medicineId: medAmlodipine, batchNumber: 'AML-2611', supplierId: sup1, locationId: locCabinet, purchaseDate: isoOffsetDays(-15), unitCost: 3.5, expiryDate: isoOffsetDays(240), reorderLevel: 30 },
      { stockId: stockMet1, medicineId: medMetformin, batchNumber: 'MET-2607', supplierId: sup1, locationId: locShelf, purchaseDate: isoOffsetDays(-60), unitCost: 2.8, expiryDate: isoOffsetDays(180), reorderLevel: 40 },
      { stockId: stockAtor1, medicineId: medAtorvastatin, batchNumber: 'ATR-2605', supplierId: sup1, locationId: locShelf, purchaseDate: isoOffsetDays(-45), unitCost: 6.2, expiryDate: isoOffsetDays(210), reorderLevel: 25 },
      { stockId: stockIns1, medicineId: medInsulin, batchNumber: 'INS-2609', supplierId: sup2, locationId: locFridge, purchaseDate: isoOffsetDays(-30), unitCost: 420.0, expiryDate: isoOffsetDays(120), reorderLevel: 10 },
      { stockId: stockAsp1, medicineId: medAspirin, batchNumber: 'ASP-2602', supplierId: sup1, locationId: locShelf, purchaseDate: isoOffsetDays(-80), unitCost: 1.2, expiryDate: isoOffsetDays(150), reorderLevel: 30 },
      { stockId: stockSalb1, medicineId: medSalbutamol, batchNumber: 'SLB-2608', supplierId: sup1, locationId: locCabinet, purchaseDate: isoOffsetDays(-40), unitCost: 145.0, expiryDate: isoOffsetDays(190), reorderLevel: 5 },
      { stockId: stockLora1, medicineId: medLorazepam, batchNumber: 'LOR-2606', supplierId: sup1, locationId: locControlled, purchaseDate: isoOffsetDays(-50), unitCost: 8.5, expiryDate: isoOffsetDays(260), reorderLevel: 15 },
      // Expired batch to enforce business rule #8 (expired stock is never issued)
      { stockId: stockExpired, medicineId: medAspirin, batchNumber: 'ASP-2401-EXP', supplierId: sup1, locationId: locShelf, purchaseDate: isoOffsetDays(-400), unitCost: 1.1, expiryDate: isoOffsetDays(-12), reorderLevel: 10 },
    ],
    stockMovements: [
      { movementId: randomUUID(), stockId: stockAmlo1, movementType: 'Stock in', quantityChange: 45, reason: 'Initial dispensary receipt', doseEventId: null, approvalStatus: 'Not required', performedBy: admin1Id, approvedBy: null, createdAt: isoHoursAgo(400) },
      { movementId: randomUUID(), stockId: stockAmlo2, movementType: 'Stock in', quantityChange: 90, reason: 'Monthly restock PO', doseEventId: null, approvalStatus: 'Not required', performedBy: caretaker1Id, approvedBy: null, createdAt: isoHoursAgo(120) },
      { movementId: randomUUID(), stockId: stockMet1, movementType: 'Stock in', quantityChange: 120, reason: 'Monthly restock PO', doseEventId: null, approvalStatus: 'Not required', performedBy: caretaker1Id, approvedBy: null, createdAt: isoHoursAgo(240) },
      { movementId: randomUUID(), stockId: stockAtor1, movementType: 'Stock in', quantityChange: 60, reason: 'Monthly restock PO', doseEventId: null, approvalStatus: 'Not required', performedBy: caretaker1Id, approvedBy: null, createdAt: isoHoursAgo(240) },
      { movementId: randomUUID(), stockId: stockIns1, movementType: 'Stock in', quantityChange: 8, reason: 'Cold-chain delivery verified at 4.3°C', doseEventId: null, approvalStatus: 'Not required', performedBy: caretaker1Id, approvedBy: null, createdAt: isoHoursAgo(200) },
      { movementId: randomUUID(), stockId: stockAsp1, movementType: 'Stock in', quantityChange: 50, reason: 'Monthly restock PO', doseEventId: null, approvalStatus: 'Not required', performedBy: caretaker1Id, approvedBy: null, createdAt: isoHoursAgo(200) },
      { movementId: randomUUID(), stockId: stockSalb1, movementType: 'Stock in', quantityChange: 12, reason: 'Initial dispensary receipt', doseEventId: null, approvalStatus: 'Not required', performedBy: admin1Id, approvedBy: null, createdAt: isoHoursAgo(200) },
      { movementId: randomUUID(), stockId: stockLora1, movementType: 'Stock in', quantityChange: 30, reason: 'Controlled drug vault receipt', doseEventId: null, approvalStatus: 'Not required', performedBy: admin1Id, approvedBy: null, createdAt: isoHoursAgo(200) },
      { movementId: randomUUID(), stockId: stockExpired, movementType: 'Stock in', quantityChange: 14, reason: 'Older batch awaiting disposal approval', doseEventId: null, approvalStatus: 'Not required', performedBy: admin1Id, approvedBy: null, createdAt: isoHoursAgo(500) },
      // Caretaker-proposed disposal awaiting Admin approval
      { movementId: '58000000-0000-4000-8000-000000000001', stockId: stockExpired, movementType: 'Disposal', quantityChange: -14, reason: 'Expired batch ASP-2401-EXP quarantined for pharmacy disposal', doseEventId: null, approvalStatus: 'Pending', performedBy: caretaker1Id, approvedBy: null, createdAt: isoHoursAgo(4) },
      // Already taken dose movement for dose1
      { movementId: randomUUID(), stockId: stockAmlo1, movementType: 'Dose taken', quantityChange: -1, reason: 'Confirmed morning round dose', doseEventId: dose1, approvalStatus: 'Not required', performedBy: caretaker1Id, approvedBy: null, createdAt: isoHoursAgo(3) },
    ],
    purchaseOrders: [
      {
        poId: '59000000-0000-4000-8000-000000000001',
        supplierId: sup2,
        status: 'Awaiting approval',
        createdBy: admin2Id,
        approvedBy: null,
        createdAt: isoHoursAgo(8),
        approvedAt: null,
        lines: [
          { lineId: randomUUID(), medicineId: medInsulin, quantity: 15, unitCost: 420 },
        ],
      },
    ],
    prescriptions: [
      {
        prescriptionId: rx1,
        residentId: res1,
        medicineId: medAmlodipine,
        prescribedBy: doctor1Id,
        reasonDiagnosis: 'Essential Hypertension (Stage 2)',
        specialInstructions: 'Check sitting BP before administering if resident reports dizziness.',
        allergyOverrideReason: null,
        startDate: isoOffsetDays(-60),
        endDate: isoOffsetDays(60),
        status: 'Active',
        stopReason: null,
        stoppedAt: null,
        renewalReminderDays: 7,
        previousPrescriptionId: null,
      },
      {
        prescriptionId: rx2,
        residentId: res1,
        medicineId: medAtorvastatin,
        prescribedBy: doctor1Id,
        reasonDiagnosis: 'Hyperlipidemia',
        specialInstructions: 'Administer after dinner.',
        allergyOverrideReason: null,
        startDate: isoOffsetDays(-45),
        endDate: isoOffsetDays(5), // Nearing renewal queue!
        status: 'Active',
        stopReason: null,
        stoppedAt: null,
        renewalReminderDays: 7,
        previousPrescriptionId: null,
      },
      {
        prescriptionId: rx3,
        residentId: res2,
        medicineId: medMetformin,
        prescribedBy: doctor1Id,
        reasonDiagnosis: 'Type 2 Diabetes Mellitus',
        specialInstructions: 'Administer strictly after breakfast and dinner.',
        allergyOverrideReason: null,
        startDate: isoOffsetDays(-90),
        endDate: isoOffsetDays(90),
        status: 'Active',
        stopReason: null,
        stoppedAt: null,
        renewalReminderDays: 7,
        previousPrescriptionId: null,
      },
      {
        prescriptionId: rx4,
        residentId: res2,
        medicineId: medInsulin,
        prescribedBy: doctor1Id,
        reasonDiagnosis: 'Glycemic control - Type 2 Diabetes',
        specialInstructions: 'Rotate abdominal subcutaneous injection site daily.',
        allergyOverrideReason: null,
        startDate: isoOffsetDays(-30),
        endDate: isoOffsetDays(45),
        status: 'Active',
        stopReason: null,
        stoppedAt: null,
        renewalReminderDays: 7,
        previousPrescriptionId: null,
      },
      {
        prescriptionId: rx5,
        residentId: res3,
        medicineId: medSalbutamol,
        prescribedBy: doctor1Id,
        reasonDiagnosis: 'Mild Persistent Bronchial Asthma',
        specialInstructions: 'Use spacer device; rinse mouth after use.',
        allergyOverrideReason: null,
        startDate: isoOffsetDays(-20),
        endDate: isoOffsetDays(70),
        status: 'Active',
        stopReason: null,
        stoppedAt: null,
        renewalReminderDays: 7,
        previousPrescriptionId: null,
      },
      {
        prescriptionId: rx6,
        residentId: res4,
        medicineId: medAspirin,
        prescribedBy: doctor1Id,
        reasonDiagnosis: 'Secondary cardiovascular prophylaxis',
        specialInstructions: 'Administer after breakfast with water.',
        allergyOverrideReason: null,
        startDate: isoOffsetDays(-50),
        endDate: isoOffsetDays(4), // Renewal queue
        status: 'Active',
        stopReason: null,
        stoppedAt: null,
        renewalReminderDays: 7,
        previousPrescriptionId: null,
      },
      {
        prescriptionId: rx7,
        residentId: res5,
        medicineId: medAmlodipine,
        prescribedBy: doctor2Id,
        reasonDiagnosis: 'Essential Hypertension',
        specialInstructions: 'Morning dose with water.',
        allergyOverrideReason: null,
        startDate: isoOffsetDays(-40),
        endDate: isoOffsetDays(80),
        status: 'Active',
        stopReason: null,
        stoppedAt: null,
        renewalReminderDays: 7,
        previousPrescriptionId: null,
      },
    ],
    dosageSchedules: [
      {
        scheduleId: sch1,
        prescriptionId: rx1,
        doseAmount: 1,
        doseUnit: 'tablet',
        route: 'Oral',
        frequency: 'Once daily',
        intervalHours: null,
        isPrn: false,
        prnMinGapMinutes: null,
        prnMaxPerDay: null,
        effectiveFrom: isoOffsetDays(-60),
        effectiveTo: null,
        changedBy: doctor1Id,
        changeReason: 'Initial prescription schedule',
        times: [{ scheduleTimeId: randomUUID(), timeOfDay: '08:00', windowId: winMorning }],
      },
      {
        scheduleId: sch2,
        prescriptionId: rx2,
        doseAmount: 1,
        doseUnit: 'tablet',
        route: 'Oral',
        frequency: 'Once daily',
        intervalHours: null,
        isPrn: false,
        prnMinGapMinutes: null,
        prnMaxPerDay: null,
        effectiveFrom: isoOffsetDays(-45),
        effectiveTo: null,
        changedBy: doctor1Id,
        changeReason: 'Initial prescription schedule',
        times: [{ scheduleTimeId: randomUUID(), timeOfDay: '21:00', windowId: winNight }],
      },
      {
        scheduleId: sch3,
        prescriptionId: rx3,
        doseAmount: 1,
        doseUnit: 'tablet',
        route: 'Oral',
        frequency: 'Twice daily',
        intervalHours: null,
        isPrn: false,
        prnMinGapMinutes: null,
        prnMaxPerDay: null,
        effectiveFrom: isoOffsetDays(-90),
        effectiveTo: null,
        changedBy: doctor1Id,
        changeReason: 'Initial prescription schedule',
        times: [
          { scheduleTimeId: randomUUID(), timeOfDay: '08:30', windowId: winMorning },
          { scheduleTimeId: randomUUID(), timeOfDay: '20:30', windowId: winEvening },
        ],
      },
      {
        scheduleId: sch4,
        prescriptionId: rx4,
        doseAmount: 1,
        doseUnit: 'vial',
        route: 'Injection',
        frequency: 'Once daily',
        intervalHours: null,
        isPrn: false,
        prnMinGapMinutes: null,
        prnMaxPerDay: null,
        effectiveFrom: isoOffsetDays(-30),
        effectiveTo: null,
        changedBy: doctor1Id,
        changeReason: 'Initial basal insulin schedule',
        times: [{ scheduleTimeId: randomUUID(), timeOfDay: '21:30', windowId: winNight }],
      },
      {
        scheduleId: sch5,
        prescriptionId: rx5,
        doseAmount: 1,
        doseUnit: 'inhaler',
        route: 'Inhaled',
        frequency: 'PRN',
        intervalHours: null,
        isPrn: true,
        prnMinGapMinutes: 240,
        prnMaxPerDay: 4,
        effectiveFrom: isoOffsetDays(-20),
        effectiveTo: null,
        changedBy: doctor1Id,
        changeReason: 'PRN rescue bronchodilator',
        times: [{ scheduleTimeId: randomUUID(), timeOfDay: '14:00', windowId: winAfternoon }],
      },
      {
        scheduleId: sch6,
        prescriptionId: rx6,
        doseAmount: 1,
        doseUnit: 'tablet',
        route: 'Oral',
        frequency: 'Once daily',
        intervalHours: null,
        isPrn: false,
        prnMinGapMinutes: null,
        prnMaxPerDay: null,
        effectiveFrom: isoOffsetDays(-50),
        effectiveTo: null,
        changedBy: doctor1Id,
        changeReason: 'Initial prophylaxis',
        times: [{ scheduleTimeId: randomUUID(), timeOfDay: '09:00', windowId: winMorning }],
      },
      {
        scheduleId: sch7,
        prescriptionId: rx7,
        doseAmount: 1,
        doseUnit: 'tablet',
        route: 'Oral',
        frequency: 'Once daily',
        intervalHours: null,
        isPrn: false,
        prnMinGapMinutes: null,
        prnMaxPerDay: null,
        effectiveFrom: isoOffsetDays(-40),
        effectiveTo: null,
        changedBy: doctor2Id,
        changeReason: 'Initial schedule',
        times: [{ scheduleTimeId: randomUUID(), timeOfDay: '08:00', windowId: winMorning }],
      },
    ],
    doseEvents: [
      {
        doseEventId: dose1,
        scheduleId: sch1,
        scheduledAt: isoHoursAgo(4),
        status: 'Taken',
        administeredAt: isoHoursAgo(3.8),
        confirmedBy: caretaker1Id,
        reason: null,
        isManual: false,
        createdBy: admin1Id,
        undoUntil: null,
      },
      {
        doseEventId: dose2,
        scheduleId: sch3,
        scheduledAt: isoHoursAgo(2), // Overdue (> 60 min past scheduledAt)
        status: 'Pending',
        administeredAt: null,
        confirmedBy: null,
        reason: null,
        isManual: false,
        createdBy: admin1Id,
        undoUntil: null,
      },
      {
        doseEventId: dose3,
        scheduleId: sch6,
        scheduledAt: isoHoursAgo(0.25), // Due now
        status: 'Pending',
        administeredAt: null,
        confirmedBy: null,
        reason: null,
        isManual: false,
        createdBy: admin1Id,
        undoUntil: null,
      },
      {
        doseEventId: dose4,
        scheduleId: sch5,
        scheduledAt: new Date(Date.now() + 1 * 3600_000).toISOString(),
        status: 'Pending',
        administeredAt: null,
        confirmedBy: null,
        reason: null,
        isManual: false,
        createdBy: admin1Id,
        undoUntil: null,
      },
      {
        doseEventId: dose5,
        scheduleId: sch3,
        scheduledAt: new Date(Date.now() + 4 * 3600_000).toISOString(),
        status: 'Pending',
        administeredAt: null,
        confirmedBy: null,
        reason: null,
        isManual: false,
        createdBy: admin1Id,
        undoUntil: null,
      },
      {
        doseEventId: dose6,
        scheduleId: sch2,
        scheduledAt: new Date(Date.now() + 5 * 3600_000).toISOString(),
        status: 'Pending',
        administeredAt: null,
        confirmedBy: null,
        reason: null,
        isManual: false,
        createdBy: admin1Id,
        undoUntil: null,
      },
      {
        doseEventId: dose7,
        scheduleId: sch4,
        scheduledAt: new Date(Date.now() + 5.5 * 3600_000).toISOString(),
        status: 'Pending',
        administeredAt: null,
        confirmedBy: null,
        reason: null,
        isManual: false,
        createdBy: admin1Id,
        undoUntil: null,
      },
      {
        doseEventId: dose8,
        scheduleId: sch7,
        scheduledAt: isoTodayAt(8, 0),
        status: 'Pending',
        administeredAt: null,
        confirmedBy: null,
        reason: null,
        isManual: false,
        createdBy: admin1Id,
        undoUntil: null,
      },
    ],
    doseEventStatusLog: [
      {
        logId: randomUUID(),
        doseEventId: dose1,
        fromStatus: 'Pending',
        toStatus: 'Taken',
        changedBy: caretaker1Id,
        changedAt: isoHoursAgo(3.8),
        reason: 'Identity & allergy check confirmed',
      },
    ],
    vitalReadings: [
      { readingId: randomUUID(), residentId: res1, recordedAt: isoHoursAgo(72), recordedBy: caretaker1Id, bpSystolic: 138, bpDiastolic: 86, bloodSugar: 108, bloodSugarUnit: 'mg/dL', temperatureC: 36.6, pulseBpm: 74, spo2Percent: 98, weightKg: 58.2, notes: 'Morning check before breakfast' },
      { readingId: randomUUID(), residentId: res1, recordedAt: isoHoursAgo(48), recordedBy: caretaker1Id, bpSystolic: 134, bpDiastolic: 84, bloodSugar: 104, bloodSugarUnit: 'mg/dL', temperatureC: 36.7, pulseBpm: 72, spo2Percent: 98, weightKg: 58.1, notes: 'Resting comfortably' },
      { readingId: randomUUID(), residentId: res1, recordedAt: isoHoursAgo(24), recordedBy: caretaker1Id, bpSystolic: 132, bpDiastolic: 82, bloodSugar: 102, bloodSugarUnit: 'mg/dL', temperatureC: 36.5, pulseBpm: 71, spo2Percent: 99, weightKg: 58.0, notes: 'Stable after walk' },
      { readingId: randomUUID(), residentId: res2, recordedAt: isoHoursAgo(48), recordedBy: caretaker1Id, bpSystolic: 128, bpDiastolic: 80, bloodSugar: 162, bloodSugarUnit: 'mg/dL', temperatureC: 36.8, pulseBpm: 78, spo2Percent: 97, weightKg: 66.5, notes: 'Post-prandial sugar' },
      { readingId: randomUUID(), residentId: res2, recordedAt: isoHoursAgo(20), recordedBy: caretaker1Id, bpSystolic: 130, bpDiastolic: 80, bloodSugar: 154, bloodSugarUnit: 'mg/dL', temperatureC: 36.7, pulseBpm: 76, spo2Percent: 97, weightKg: 66.4, notes: 'Fasting sugar logged' },
      { readingId: randomUUID(), residentId: res3, recordedAt: isoHoursAgo(16), recordedBy: caretaker1Id, bpSystolic: 122, bpDiastolic: 76, bloodSugar: 98, bloodSugarUnit: 'mg/dL', temperatureC: 36.6, pulseBpm: 80, spo2Percent: 96, weightKg: 54.0, notes: 'Clear breath sounds' },
      { readingId: randomUUID(), residentId: res4, recordedAt: isoHoursAgo(10), recordedBy: caretaker1Id, bpSystolic: 136, bpDiastolic: 84, bloodSugar: 112, bloodSugarUnit: 'mg/dL', temperatureC: 36.7, pulseBpm: 68, spo2Percent: 98, weightKg: 70.2, notes: 'No chest discomfort' },
      { readingId: randomUUID(), residentId: res5, recordedAt: isoHoursAgo(8), recordedBy: caretaker2Id, bpSystolic: 140, bpDiastolic: 88, bloodSugar: 105, bloodSugarUnit: 'mg/dL', temperatureC: 36.6, pulseBpm: 75, spo2Percent: 98, weightKg: 59.5, notes: 'Morning vitals' },
    ],
    alerts: [
      {
        alertId: alert1,
        alertCode: 'OVERDUE_DOSE',
        priority: 'High',
        status: 'Open',
        residentId: res2,
        stockId: null,
        doseEventId: dose2,
        readingId: null,
        prescriptionId: rx3,
        message: 'Glycomet 500 SR (1 tablet) for Harishchandra Joshi is overdue past the 60-minute grace window.',
        createdAt: isoHoursAgo(1),
        dueBy: new Date(Date.now() + 15 * 60_000).toISOString(),
        escalatedTo: null,
      },
      {
        alertId: alert2,
        alertCode: 'LOW_STOCK',
        priority: 'High',
        status: 'Open',
        residentId: null,
        stockId: stockIns1,
        doseEventId: null,
        readingId: null,
        prescriptionId: null,
        message: 'Lantus SoloStar (Batch INS-2609) has 8 vials on hand, below reorder level of 10 vials.',
        createdAt: isoHoursAgo(6),
        dueBy: null,
        escalatedTo: admin1Id,
      },
      {
        alertId: alert3,
        alertCode: 'EXPIRY',
        priority: 'Medium',
        status: 'Acknowledged',
        residentId: null,
        stockId: stockAmlo1,
        doseEventId: null,
        readingId: null,
        prescriptionId: null,
        message: 'Amlong 5 (Batch AML-2604) expires within 60 days. Prioritised first under FEFO.',
        createdAt: isoHoursAgo(18),
        dueBy: null,
        escalatedTo: null,
      },
      {
        alertId: alert4,
        alertCode: 'PRESCRIPTION_ENDING',
        priority: 'Medium',
        status: 'Open',
        residentId: res1,
        stockId: null,
        doseEventId: null,
        readingId: null,
        prescriptionId: rx2,
        message: 'Atorva 10 prescription for Kamala Subramanian ends in 5 days. Review for renewal.',
        createdAt: isoHoursAgo(12),
        dueBy: null,
        escalatedTo: null,
      },
    ],
    alertActions: [
      {
        actionId: randomUUID(),
        alertId: alert3,
        userId: admin1Id,
        action: 'Acknowledged',
        note: 'Verified Batch AML-2611 already stocked as replacement; AML-2604 will finish before expiry.',
        createdAt: isoHoursAgo(14),
      },
    ],
    notifications: [
      {
        notificationId: randomUUID(),
        residentContactId: '42000000-0000-4000-8000-000000000002',
        userId: null,
        alertId: alert1,
        incidentId: null,
        channel: 'SMS',
        status: 'Queued',
        attempts: 0,
        lastError: null,
        sentAt: null,
        createdAt: isoHoursAgo(0.5),
      },
    ],
    emergencyIncidents: [
      {
        incidentId: inc1,
        residentId: res3,
        reportedBy: caretaker1Id,
        occurredAt: isoHoursAgo(36),
        description: 'Mild nocturnal wheezing episode in Room 103 Bed A; SpO2 dipped to 93%.',
        status: 'Closed',
      },
    ],
    incidentLogEntries: [
      {
        entryId: randomUUID(),
        incidentId: inc1,
        loggedBy: caretaker1Id,
        actionTime: isoHoursAgo(36),
        actionTaken: 'Positioned resident upright, administered prescribed PRN Asthalin inhaler via spacer, notified Dr. Ananya Desai.',
        outcome: 'Wheezing resolved within 10 minutes; SpO2 recovered to 97%. Family notified.',
        loggedAt: isoHoursAgo(35.8),
      },
    ],
    assistantConversations: [],
    assistantMessages: [],
    auditLog: [
      {
        auditId: 1,
        userId: admin1Id,
        action: 'UPDATE',
        tableName: 'system_settings',
        recordId: 'setup_completed',
        oldValues: { setup_completed: 'false' },
        newValues: { setup_completed: 'true' },
        createdAt: isoHoursAgo(480),
      },
      {
        auditId: 2,
        userId: doctor1Id,
        action: 'INSERT',
        tableName: 'medicine_catalogue',
        recordId: medDonepezilPending,
        oldValues: null,
        newValues: { name: 'Donep 5', approval_status: 'Pending' },
        createdAt: isoHoursAgo(12),
      },
      {
        auditId: 3,
        userId: caretaker1Id,
        action: 'INSERT',
        tableName: 'stock_movements',
        recordId: '58000000-0000-4000-8000-000000000001',
        oldValues: null,
        newValues: { movement_type: 'Disposal', quantity_change: -14, approval_status: 'Pending' },
        createdAt: isoHoursAgo(4),
      },
      {
        auditId: 4,
        userId: caretaker1Id,
        action: 'UPDATE',
        tableName: 'dose_events',
        recordId: dose1,
        oldValues: { status: 'Pending' },
        newValues: { status: 'Taken', batch: 'AML-2604' },
        createdAt: isoHoursAgo(3.8),
      },
    ],
    nextAuditId: 5,
  };
}
