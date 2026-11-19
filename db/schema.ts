import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  date,
  inet,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ============================================================================
// 1. ACCESS, ROLES, USERS, SESSIONS, SETTINGS & AUDIT
// ============================================================================

export const roles = pgTable(
  'roles',
  {
    roleId: uuid('role_id').defaultRandom().primaryKey(),
    name: text('name').notNull().unique(),
  },
  (table) => [check('roles_name_chk', sql`${table.name} IN ('Admin', 'Caretaker', 'Doctor')`)]
);

export const permissions = pgTable('permissions', {
  permissionId: uuid('permission_id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.roleId, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.permissionId, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]
);

export const users = pgTable('users', {
  userId: uuid('user_id').defaultRandom().primaryKey(),
  fullName: text('full_name').notNull(),
  username: text('username').notNull().unique(),
  email: text('email'),
  phone: text('phone'),
  roleId: uuid('role_id')
    .notNull()
    .references(() => roles.roleId),
  passwordHash: text('password_hash').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  tempPasswordExpiresAt: timestamp('temp_password_expires_at', { withTimezone: true }),
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  isLocked: boolean('is_locked').notNull().default(false),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  mfaEnabled: boolean('mfa_enabled').notNull().default(false),
  mfaSecretEncrypted: text('mfa_secret_encrypted'),
  mfaEnrolledAt: timestamp('mfa_enrolled_at', { withTimezone: true }),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
  deactivatedBy: uuid('deactivated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  sessionId: uuid('session_id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.userId, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const mfaRecoveryCodes = pgTable('mfa_recovery_codes', {
  codeId: uuid('code_id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.userId, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userPreferences = pgTable(
  'user_preferences',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.userId, { onDelete: 'cascade' }),
    themeKey: text('theme_key').notNull().default('clinical-calm'),
    colorMode: text('color_mode').notNull().default('system'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'user_preferences_theme_chk',
      sql`${table.themeKey} IN ('clinical-calm', 'warm-care', 'modern-indigo')`
    ),
    check(
      'user_preferences_mode_chk',
      sql`${table.colorMode} IN ('light', 'dark', 'system')`
    ),
  ]
);

export const credentialExports = pgTable('credential_exports', {
  exportId: uuid('export_id').defaultRandom().primaryKey(),
  targetUserId: uuid('target_user_id')
    .notNull()
    .references(() => users.userId),
  exportedBy: uuid('exported_by')
    .notNull()
    .references(() => users.userId),
  exportedAt: timestamp('exported_at', { withTimezone: true }).notNull().defaultNow(),
});

export const loginHistory = pgTable('login_history', {
  loginId: uuid('login_id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.userId),
  attemptedUsername: text('attempted_username').notNull(),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
  succeeded: boolean('succeeded').notNull(),
  ipAddress: inet('ip_address'),
});

export const systemSettings = pgTable('system_settings', {
  settingKey: text('setting_key').primaryKey(),
  settingValue: text('setting_value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.userId),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const facility = pgTable('facility', {
  facilityId: uuid('facility_id').defaultRandom().primaryKey(),
  singletonKey: text('singleton_key').notNull().unique().default('primary'),
  name: text('name').notNull(),
  address: text('address').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  registrationNo: text('registration_no').notNull(),
});

export const doseTimeWindows = pgTable('dose_time_windows', {
  windowId: uuid('window_id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
});

export const vitalTypes = pgTable('vital_types', {
  vitalTypeId: uuid('vital_type_id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  minNormal: numeric('min_normal'),
  maxNormal: numeric('max_normal'),
});

export const auditLog = pgTable('audit_log', {
  auditId: bigserial('audit_id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').references(() => users.userId),
  action: text('action').notNull(),
  tableName: text('table_name').notNull(),
  recordId: text('record_id').notNull(),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 2. RESIDENTS, ROOMS, BEDS, ASSIGNMENTS, CONTACTS, HISTORY, ALLERGIES
// ============================================================================

export const rooms = pgTable('rooms', {
  roomId: uuid('room_id').defaultRandom().primaryKey(),
  roomCode: text('room_code').notNull().unique(),
  wingOrFloor: text('wing_or_floor').notNull(),
});

export const beds = pgTable(
  'beds',
  {
    bedId: uuid('bed_id').defaultRandom().primaryKey(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.roomId),
    bedCode: text('bed_code').notNull(),
  },
  (table) => [uniqueIndex('beds_room_code_uq').on(table.roomId, table.bedCode)]
);

export const residents = pgTable(
  'residents',
  {
    residentId: uuid('resident_id').defaultRandom().primaryKey(),
    fullName: text('full_name').notNull(),
    photoPath: text('photo_path'),
    dateOfBirth: date('date_of_birth').notNull(),
    gender: text('gender').notNull(),
    bloodGroup: text('blood_group').notNull(),
    bedId: uuid('bed_id')
      .unique()
      .references(() => beds.bedId),
    admissionDate: date('admission_date').notNull(),
    dietNotes: text('diet_notes'),
    assignedDoctorId: uuid('assigned_doctor_id').references(() => users.userId),
    status: text('status').notNull().default('Active'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    archiveReason: text('archive_reason'),
    allergyStatus: text('allergy_status').notNull().default('Unknown'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.userId),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('residents_status_chk', sql`${table.status} IN ('Active', 'Discharged', 'Archived')`),
    check(
      'residents_allergy_status_chk',
      sql`${table.allergyStatus} IN ('Unknown', 'None known', 'Recorded')`
    ),
  ]
);

export const careAssignments = pgTable(
  'care_assignments',
  {
    assignmentId: uuid('assignment_id').defaultRandom().primaryKey(),
    caretakerId: uuid('caretaker_id')
      .notNull()
      .references(() => users.userId),
    residentId: uuid('resident_id')
      .notNull()
      .references(() => residents.residentId),
    assignedBy: uuid('assigned_by')
      .notNull()
      .references(() => users.userId),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endedBy: uuid('ended_by').references(() => users.userId),
  },
  (table) => [
    uniqueIndex('care_assignments_active_uq')
      .on(table.caretakerId, table.residentId)
      .where(sql`${table.endedAt} IS NULL`),
  ]
);

export const residentContacts = pgTable(
  'resident_contacts',
  {
    contactId: uuid('contact_id').defaultRandom().primaryKey(),
    residentId: uuid('resident_id')
      .notNull()
      .references(() => residents.residentId),
    fullName: text('full_name').notNull(),
    relationship: text('relationship').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    isPrimary: boolean('is_primary').notNull().default(false),
    receivesNotifications: boolean('receives_notifications').notNull().default(false),
  },
  (table) => [
    uniqueIndex('resident_contacts_primary_uq')
      .on(table.residentId)
      .where(sql`${table.isPrimary} = true`),
  ]
);

export const residentDiagnoses = pgTable('resident_diagnoses', {
  diagnosisId: uuid('diagnosis_id').defaultRandom().primaryKey(),
  residentId: uuid('resident_id')
    .notNull()
    .references(() => residents.residentId),
  description: text('description').notNull(),
  diagnosedOn: date('diagnosed_on').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  recordedBy: uuid('recorded_by')
    .notNull()
    .references(() => users.userId),
});

export const residentHistory = pgTable(
  'resident_history',
  {
    historyId: uuid('history_id').defaultRandom().primaryKey(),
    residentId: uuid('resident_id')
      .notNull()
      .references(() => residents.residentId),
    type: text('type').notNull(),
    description: text('description').notNull(),
    eventDate: date('event_date').notNull(),
    recordedBy: uuid('recorded_by')
      .notNull()
      .references(() => users.userId),
  },
  (table) => [
    check(
      'resident_history_type_chk',
      sql`${table.type} IN ('Past illness', 'Surgery', 'Vaccination')`
    ),
  ]
);

// ============================================================================
// 3. MEDICINES, STORAGE & FRIDGE LOGS
// ============================================================================

export const medicineCatalogue = pgTable(
  'medicine_catalogue',
  {
    medicineId: uuid('medicine_id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    genericName: text('generic_name').notNull(),
    form: text('form').notNull(),
    strength: text('strength').notNull(),
    stockUnit: text('stock_unit').notNull(),
    manufacturer: text('manufacturer').notNull(),
    category: text('category').notNull(),
    foodInstruction: text('food_instruction'),
    sideEffects: text('side_effects'),
    storageCondition: text('storage_condition'),
    isControlled: boolean('is_controlled').notNull().default(false),
    status: text('status').notNull().default('Active'),
    approvalStatus: text('approval_status').notNull().default('Pending'),
    proposedBy: uuid('proposed_by')
      .notNull()
      .references(() => users.userId),
    approvedBy: uuid('approved_by').references(() => users.userId),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'medicine_form_chk',
      sql`${table.form} IN ('Tablet', 'Syrup', 'Injection', 'Capsule', 'Cream', 'Inhaler')`
    ),
    check(
      'medicine_stock_unit_chk',
      sql`${table.stockUnit} IN ('tablet', 'capsule', 'ml', 'vial', 'sachet', 'tube', 'inhaler')`
    ),
    check('medicine_status_chk', sql`${table.status} IN ('Active', 'Discontinued')`),
    check(
      'medicine_approval_chk',
      sql`${table.approvalStatus} IN ('Pending', 'Approved', 'Rejected')`
    ),
  ]
);

export const allergies = pgTable(
  'allergies',
  {
    allergyId: uuid('allergy_id').defaultRandom().primaryKey(),
    residentId: uuid('resident_id')
      .notNull()
      .references(() => residents.residentId),
    medicineId: uuid('medicine_id').references(() => medicineCatalogue.medicineId),
    substanceText: text('substance_text'),
    reaction: text('reaction').notNull(),
    severity: text('severity').notNull(),
    recordedBy: uuid('recorded_by')
      .notNull()
      .references(() => users.userId),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('allergies_severity_chk', sql`${table.severity} IN ('Mild', 'Moderate', 'Severe')`),
    check(
      'allergies_target_xor_chk',
      sql`(${table.medicineId} IS NOT NULL AND ${table.substanceText} IS NULL) OR (${table.medicineId} IS NULL AND ${table.substanceText} IS NOT NULL)`
    ),
    uniqueIndex('allergies_resident_medicine_uq')
      .on(table.residentId, table.medicineId)
      .where(sql`${table.medicineId} IS NOT NULL`),
  ]
);

export const residentNotes = pgTable(
  'resident_notes',
  {
    noteId: uuid('note_id').defaultRandom().primaryKey(),
    residentId: uuid('resident_id')
      .notNull()
      .references(() => residents.residentId),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.userId),
    noteType: text('note_type').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('resident_notes_type_chk', sql`${table.noteType} IN ('Doctor visit', 'General')`)]
);

export const shiftHandoverNotes = pgTable('shift_handover_notes', {
  noteId: uuid('note_id').defaultRandom().primaryKey(),
  residentId: uuid('resident_id')
    .notNull()
    .references(() => residents.residentId),
  windowId: uuid('window_id')
    .notNull()
    .references(() => doseTimeWindows.windowId),
  shiftDate: date('shift_date').notNull(),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.userId),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const residentDocuments = pgTable(
  'resident_documents',
  {
    documentId: uuid('document_id').defaultRandom().primaryKey(),
    residentId: uuid('resident_id')
      .notNull()
      .references(() => residents.residentId),
    documentType: text('document_type').notNull(),
    storagePath: text('storage_path').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.userId),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'resident_documents_type_chk',
      sql`${table.documentType} IN ('Lab result', 'Visit letter', 'Other')`
    ),
    check(
      'resident_documents_mime_chk',
      sql`${table.mimeType} IN ('application/pdf', 'image/jpeg', 'image/png')`
    ),
    check('resident_documents_size_chk', sql`${table.sizeBytes} > 0 AND ${table.sizeBytes} <= 10485760`),
  ]
);

export const storageLocations = pgTable(
  'storage_locations',
  {
    locationId: uuid('location_id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    locationType: text('location_type').notNull(),
    isLocked: boolean('is_locked').notNull().default(false),
  },
  (table) => [
    check(
      'storage_locations_type_chk',
      sql`${table.locationType} IN ('Cabinet', 'Shelf', 'Fridge', 'Locked controlled-drug box')`
    ),
  ]
);

export const fridgeTemperatureLogs = pgTable('fridge_temperature_logs', {
  logId: uuid('log_id').defaultRandom().primaryKey(),
  locationId: uuid('location_id')
    .notNull()
    .references(() => storageLocations.locationId),
  temperatureC: numeric('temperature_c', { precision: 4, scale: 1 }).notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  recordedBy: uuid('recorded_by')
    .notNull()
    .references(() => users.userId),
});

// ============================================================================
// 4. PRESCRIPTIONS, DOSAGE SCHEDULES & DOSE ADMINISTRATION
// ============================================================================

export const prescriptions = pgTable(
  'prescriptions',
  {
    prescriptionId: uuid('prescription_id').defaultRandom().primaryKey(),
    residentId: uuid('resident_id')
      .notNull()
      .references(() => residents.residentId),
    medicineId: uuid('medicine_id')
      .notNull()
      .references(() => medicineCatalogue.medicineId),
    prescribedBy: uuid('prescribed_by')
      .notNull()
      .references(() => users.userId),
    reasonDiagnosis: text('reason_diagnosis').notNull(),
    specialInstructions: text('special_instructions'),
    allergyOverrideReason: text('allergy_override_reason'),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    status: text('status').notNull().default('Active'),
    stopReason: text('stop_reason'),
    stoppedAt: timestamp('stopped_at', { withTimezone: true }),
    renewalReminderDays: integer('renewal_reminder_days').notNull().default(7),
    previousPrescriptionId: uuid('previous_prescription_id'),
  },
  (table) => [
    check(
      'prescriptions_status_chk',
      sql`${table.status} IN ('Active', 'Completed', 'Stopped', 'On hold')`
    ),
    check(
      'prescriptions_dates_chk',
      sql`${table.endDate} IS NULL OR ${table.endDate} >= ${table.startDate}`
    ),
  ]
);

export const prescriptionAttachments = pgTable(
  'prescription_attachments',
  {
    attachmentId: uuid('attachment_id').defaultRandom().primaryKey(),
    prescriptionId: uuid('prescription_id')
      .notNull()
      .references(() => prescriptions.prescriptionId),
    storagePath: text('storage_path').notNull(),
    fileType: text('file_type').notNull(),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.userId),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('prescription_attachments_type_chk', sql`${table.fileType} IN ('Image', 'PDF')`)]
);

export const dosageSchedules = pgTable(
  'dosage_schedules',
  {
    scheduleId: uuid('schedule_id').defaultRandom().primaryKey(),
    prescriptionId: uuid('prescription_id')
      .notNull()
      .references(() => prescriptions.prescriptionId),
    doseAmount: numeric('dose_amount').notNull(),
    doseUnit: text('dose_unit').notNull(),
    route: text('route').notNull(),
    frequency: text('frequency').notNull(),
    intervalHours: integer('interval_hours'),
    isPrn: boolean('is_prn').notNull().default(false),
    prnMinGapMinutes: integer('prn_min_gap_minutes'),
    prnMaxPerDay: integer('prn_max_per_day'),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    changedBy: uuid('changed_by')
      .notNull()
      .references(() => users.userId),
    changeReason: text('change_reason'),
  },
  (table) => [
    check('dosage_route_chk', sql`${table.route} IN ('Oral', 'Injection', 'Topical', 'Inhaled')`),
    check(
      'dosage_frequency_chk',
      sql`${table.frequency} IN ('Once daily', 'Twice daily', 'Weekly', 'Every X hours', 'PRN')`
    ),
  ]
);

export const scheduleTimes = pgTable(
  'schedule_times',
  {
    scheduleTimeId: uuid('schedule_time_id').defaultRandom().primaryKey(),
    scheduleId: uuid('schedule_id')
      .notNull()
      .references(() => dosageSchedules.scheduleId, { onDelete: 'cascade' }),
    timeOfDay: time('time_of_day').notNull(),
    windowId: uuid('window_id')
      .notNull()
      .references(() => doseTimeWindows.windowId),
  },
  (table) => [uniqueIndex('schedule_times_uq').on(table.scheduleId, table.timeOfDay)]
);

export const doseEvents = pgTable(
  'dose_events',
  {
    doseEventId: uuid('dose_event_id').defaultRandom().primaryKey(),
    scheduleId: uuid('schedule_id')
      .notNull()
      .references(() => dosageSchedules.scheduleId),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('Pending'),
    administeredAt: timestamp('administered_at', { withTimezone: true }),
    confirmedBy: uuid('confirmed_by').references(() => users.userId),
    reason: text('reason'),
    isManual: boolean('is_manual').notNull().default(false),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.userId),
    undoUntil: timestamp('undo_until', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('dose_events_schedule_time_uq').on(table.scheduleId, table.scheduledAt),
    check(
      'dose_events_status_chk',
      sql`${table.status} IN ('Pending', 'Taken', 'Refused', 'Missed', 'Held')`
    ),
    check(
      'dose_events_taken_req_chk',
      sql`${table.status} <> 'Taken' OR (${table.administeredAt} IS NOT NULL AND ${table.confirmedBy} IS NOT NULL)`
    ),
    check(
      'dose_events_reason_req_chk',
      sql`${table.status} NOT IN ('Refused', 'Missed', 'Held') OR (${table.reason} IS NOT NULL AND length(trim(${table.reason})) > 0)`
    ),
  ]
);

export const doseEventStatusLog = pgTable('dose_event_status_log', {
  logId: uuid('log_id').defaultRandom().primaryKey(),
  doseEventId: uuid('dose_event_id')
    .notNull()
    .references(() => doseEvents.doseEventId),
  fromStatus: text('from_status').notNull(),
  toStatus: text('to_status').notNull(),
  changedBy: uuid('changed_by')
    .notNull()
    .references(() => users.userId),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  reason: text('reason'),
});

// ============================================================================
// 5. INVENTORY, STOCK MOVEMENTS & PURCHASE ORDERS
// ============================================================================

export const suppliers = pgTable('suppliers', {
  supplierId: uuid('supplier_id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  contactPerson: text('contact_person').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
});

export const inventoryItems = pgTable(
  'inventory_items',
  {
    stockId: uuid('stock_id').defaultRandom().primaryKey(),
    medicineId: uuid('medicine_id')
      .notNull()
      .references(() => medicineCatalogue.medicineId),
    batchNumber: text('batch_number').notNull(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.supplierId),
    locationId: uuid('location_id')
      .notNull()
      .references(() => storageLocations.locationId),
    purchaseDate: date('purchase_date').notNull(),
    unitCost: numeric('unit_cost').notNull(),
    expiryDate: date('expiry_date').notNull(),
    reorderLevel: integer('reorder_level').notNull().default(20),
  },
  (table) => [uniqueIndex('inventory_items_med_batch_uq').on(table.medicineId, table.batchNumber)]
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    movementId: uuid('movement_id').defaultRandom().primaryKey(),
    stockId: uuid('stock_id')
      .notNull()
      .references(() => inventoryItems.stockId),
    movementType: text('movement_type').notNull(),
    quantityChange: integer('quantity_change').notNull(),
    reason: text('reason'),
    doseEventId: uuid('dose_event_id').references(() => doseEvents.doseEventId),
    approvalStatus: text('approval_status').notNull().default('Not required'),
    performedBy: uuid('performed_by')
      .notNull()
      .references(() => users.userId),
    approvedBy: uuid('approved_by').references(() => users.userId),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'stock_movements_type_chk',
      sql`${table.movementType} IN ('Stock in', 'Dose taken', 'Adjustment', 'Return', 'Disposal', 'Damage')`
    ),
    check('stock_movements_nonzero_chk', sql`${table.quantityChange} <> 0`),
    check(
      'stock_movements_approval_chk',
      sql`${table.approvalStatus} IN ('Not required', 'Pending', 'Approved', 'Rejected')`
    ),
    check(
      'stock_movements_no_self_approve_chk',
      sql`${table.approvedBy} IS NULL OR ${table.approvedBy} <> ${table.performedBy}`
    ),
    uniqueIndex('stock_movements_dose_taken_uq')
      .on(table.doseEventId)
      .where(sql`${table.movementType} = 'Dose taken'`),
  ]
);

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    poId: uuid('po_id').defaultRandom().primaryKey(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.supplierId),
    status: text('status').notNull().default('Draft'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.userId),
    approvedBy: uuid('approved_by').references(() => users.userId),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'purchase_orders_status_chk',
      sql`${table.status} IN ('Draft', 'Awaiting approval', 'Approved', 'Ordered', 'Received', 'Cancelled')`
    ),
    check(
      'purchase_orders_no_self_approve_chk',
      sql`${table.approvedBy} IS NULL OR ${table.approvedBy} <> ${table.createdBy}`
    ),
  ]
);

export const purchaseOrderLines = pgTable(
  'purchase_order_lines',
  {
    lineId: uuid('line_id').defaultRandom().primaryKey(),
    poId: uuid('po_id')
      .notNull()
      .references(() => purchaseOrders.poId, { onDelete: 'cascade' }),
    medicineId: uuid('medicine_id')
      .notNull()
      .references(() => medicineCatalogue.medicineId),
    quantity: integer('quantity').notNull(),
    unitCost: numeric('unit_cost').notNull(),
  },
  (table) => [uniqueIndex('purchase_order_lines_uq').on(table.poId, table.medicineId)]
);

// ============================================================================
// 6. VITALS, ALERTS, NOTIFICATIONS, EMERGENCY & CARE ASSISTANT
// ============================================================================

export const vitalReadings = pgTable(
  'vital_readings',
  {
    readingId: uuid('reading_id').defaultRandom().primaryKey(),
    residentId: uuid('resident_id')
      .notNull()
      .references(() => residents.residentId),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    recordedBy: uuid('recorded_by')
      .notNull()
      .references(() => users.userId),
    bpSystolic: integer('bp_systolic'),
    bpDiastolic: integer('bp_diastolic'),
    bloodSugar: numeric('blood_sugar'),
    bloodSugarUnit: text('blood_sugar_unit').default('mg/dL'),
    temperatureC: numeric('temperature_c', { precision: 4, scale: 1 }),
    pulseBpm: integer('pulse_bpm'),
    spo2Percent: integer('spo2_percent'),
    weightKg: numeric('weight_kg'),
    notes: text('notes'),
  },
  (table) => [
    check(
      'vital_readings_bs_unit_chk',
      sql`${table.bloodSugarUnit} IS NULL OR ${table.bloodSugarUnit} IN ('mg/dL', 'mmol/L')`
    ),
  ]
);

export const alertTypes = pgTable(
  'alert_types',
  {
    alertTypeId: uuid('alert_type_id').defaultRandom().primaryKey(),
    code: text('code').notNull().unique(),
    defaultPriority: text('default_priority').notNull(),
  },
  (table) => [
    check(
      'alert_types_code_chk',
      sql`${table.code} IN ('LOW_STOCK', 'EXPIRY', 'MISSED_DOSE', 'OVERDUE_DOSE', 'ABNORMAL_VITAL', 'PRESCRIPTION_ENDING')`
    ),
    check('alert_types_priority_chk', sql`${table.defaultPriority} IN ('High', 'Medium', 'Low')`),
  ]
);

export const alerts = pgTable(
  'alerts',
  {
    alertId: uuid('alert_id').defaultRandom().primaryKey(),
    alertTypeId: uuid('alert_type_id')
      .notNull()
      .references(() => alertTypes.alertTypeId),
    priority: text('priority').notNull(),
    status: text('status').notNull().default('Open'),
    residentId: uuid('resident_id').references(() => residents.residentId),
    stockId: uuid('stock_id').references(() => inventoryItems.stockId),
    doseEventId: uuid('dose_event_id').references(() => doseEvents.doseEventId),
    readingId: uuid('reading_id').references(() => vitalReadings.readingId),
    prescriptionId: uuid('prescription_id').references(() => prescriptions.prescriptionId),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    dueBy: timestamp('due_by', { withTimezone: true }),
    escalatedTo: uuid('escalated_to').references(() => users.userId),
  },
  (table) => [
    check('alerts_priority_chk', sql`${table.priority} IN ('High', 'Medium', 'Low')`),
    check(
      'alerts_status_chk',
      sql`${table.status} IN ('Open', 'Acknowledged', 'Resolved', 'Escalated')`
    ),
  ]
);

export const alertActions = pgTable(
  'alert_actions',
  {
    actionId: uuid('action_id').defaultRandom().primaryKey(),
    alertId: uuid('alert_id')
      .notNull()
      .references(() => alerts.alertId),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.userId),
    action: text('action').notNull(),
    note: text('note').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'alert_actions_type_chk',
      sql`${table.action} IN ('Acknowledged', 'Resolved', 'Escalated', 'Note')`
    ),
    check(
      'alert_actions_resolve_note_chk',
      sql`${table.action} <> 'Resolved' OR length(trim(${table.note})) > 0`
    ),
  ]
);

export const emergencyIncidents = pgTable(
  'emergency_incidents',
  {
    incidentId: uuid('incident_id').defaultRandom().primaryKey(),
    residentId: uuid('resident_id')
      .notNull()
      .references(() => residents.residentId),
    reportedBy: uuid('reported_by')
      .notNull()
      .references(() => users.userId),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    description: text('description').notNull(),
    status: text('status').notNull().default('Open'),
  },
  (table) => [check('emergency_incidents_status_chk', sql`${table.status} IN ('Open', 'Closed')`)]
);

export const incidentLogEntries = pgTable('incident_log_entries', {
  entryId: uuid('entry_id').defaultRandom().primaryKey(),
  incidentId: uuid('incident_id')
    .notNull()
    .references(() => emergencyIncidents.incidentId),
  loggedBy: uuid('logged_by')
    .notNull()
    .references(() => users.userId),
  actionTime: timestamp('action_time', { withTimezone: true }).notNull(),
  actionTaken: text('action_taken').notNull(),
  outcome: text('outcome').notNull(),
  loggedAt: timestamp('logged_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable(
  'notifications',
  {
    notificationId: uuid('notification_id').defaultRandom().primaryKey(),
    residentContactId: uuid('resident_contact_id').references(() => residentContacts.contactId),
    userId: uuid('user_id').references(() => users.userId),
    alertId: uuid('alert_id').references(() => alerts.alertId),
    incidentId: uuid('incident_id').references(() => emergencyIncidents.incidentId),
    channel: text('channel').notNull(),
    status: text('status').notNull().default('Queued'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (table) => [
    check('notifications_channel_chk', sql`${table.channel} IN ('SMS', 'Email')`),
    check('notifications_status_chk', sql`${table.status} IN ('Queued', 'Sent', 'Failed')`),
    check(
      'notifications_single_recipient_chk',
      sql`(${table.residentContactId} IS NOT NULL AND ${table.userId} IS NULL) OR (${table.residentContactId} IS NULL AND ${table.userId} IS NOT NULL)`
    ),
  ]
);

export const assistantConversations = pgTable('assistant_conversations', {
  conversationId: uuid('conversation_id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.userId, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  title: text('title').notNull(),
});

export const assistantMessages = pgTable(
  'assistant_messages',
  {
    messageId: uuid('message_id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => assistantConversations.conversationId, { onDelete: 'cascade' }),
    sender: text('sender').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('assistant_messages_sender_chk', sql`${table.sender} IN ('User', 'Assistant')`)]
);
