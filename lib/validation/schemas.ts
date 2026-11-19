import { z } from 'zod';

export const loginSchema = z.object({
  role: z.enum(['Admin', 'Doctor', 'Caretaker']).optional(),
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().trim().optional(),
  recoveryCode: z.string().trim().optional(),
});

export const setupAdminSchema = z.object({
  setupToken: z.string().trim().min(1, 'Setup token is required'),
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(60)
    .regex(/^[a-z0-9._-]+$/i, 'Use letters, numbers, dots, underscores, or hyphens'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(12, 'New password must be at least 12 characters'),
});

export const createUserSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  role: z.enum(['Doctor', 'Caretaker']),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(60)
    .regex(/^[a-z0-9._-]+$/i, 'Use letters, numbers, dots, underscores, or hyphens')
    .optional()
    .or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
});

export const createResidentSchema = z.object({
  fullName: z.string().trim().min(2, 'Resident name is required').max(120),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD date format'),
  gender: z.enum(['Female', 'Male', 'Other']),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']),
  bedId: z.string().nullable().optional(),
  admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD date format'),
  dietNotes: z.string().max(500).optional().nullable(),
  assignedDoctorId: z.string().nullable().optional(),
  assignedCaretakerId: z.string().nullable().optional(),
  allergyStatus: z.enum(['Unknown', 'None known', 'Recorded']).default('Unknown'),
});

export const archiveResidentSchema = z.object({
  reason: z.string().trim().min(5, 'Archive reason must be at least 5 characters').max(500),
});

export const createAllergySchema = z
  .object({
    residentId: z.string().min(1),
    medicineId: z.string().nullable().optional(),
    substanceText: z.string().trim().max(120).nullable().optional(),
    reaction: z.string().trim().min(2, 'Reaction description is required').max(300),
    severity: z.enum(['Mild', 'Moderate', 'Severe']),
  })
  .refine(
    (d) => (Boolean(d.medicineId) && !d.substanceText) || (!d.medicineId && Boolean(d.substanceText)),
    { message: 'Specify either a medicine from the catalogue or a substance name, not both.' }
  );

export const createMedicineSchema = z.object({
  name: z.string().trim().min(2).max(120),
  genericName: z.string().trim().min(2).max(120),
  form: z.enum(['Tablet', 'Syrup', 'Injection', 'Capsule', 'Cream', 'Inhaler']),
  strength: z.string().trim().min(1).max(60),
  stockUnit: z.enum(['tablet', 'capsule', 'ml', 'vial', 'sachet', 'tube', 'inhaler']),
  manufacturer: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(80),
  foodInstruction: z.string().trim().max(240).optional().nullable(),
  sideEffects: z.string().trim().max(400).optional().nullable(),
  storageCondition: z.string().trim().max(240).optional().nullable(),
  isControlled: z.boolean().default(false),
});

export const createPrescriptionSchema = z.object({
  residentId: z.string().min(1, 'Select a resident'),
  medicineId: z.string().min(1, 'Select an approved medicine'),
  reasonDiagnosis: z.string().trim().min(2, 'Diagnosis or clinical reason is required').max(300),
  specialInstructions: z.string().trim().max(500).optional().nullable(),
  allergyOverrideReason: z.string().trim().max(400).optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal('')),
  renewalReminderDays: z.coerce.number().int().min(1).max(60).default(7),
  doseAmount: z.coerce.number().positive('Dose amount must be positive'),
  doseUnit: z.enum(['tablet', 'capsule', 'ml', 'vial', 'sachet', 'tube', 'inhaler']),
  route: z.enum(['Oral', 'Injection', 'Topical', 'Inhaled']),
  frequency: z.enum(['Once daily', 'Twice daily', 'Weekly', 'Every X hours', 'PRN']),
  intervalHours: z.coerce.number().int().min(1).max(168).optional().nullable(),
  isPrn: z.boolean().default(false),
  prnMinGapMinutes: z.coerce.number().int().min(15).max(1440).optional().nullable(),
  prnMaxPerDay: z.coerce.number().int().min(1).max(12).optional().nullable(),
  times: z
    .array(
      z.object({
        timeOfDay: z.string().regex(/^\d{2}:\d{2}$/),
        windowId: z.string().min(1),
      })
    )
    .default([]),
});

export const doseActionSchema = z
  .object({
    doseEventId: z.string().min(1),
    action: z.enum(['Taken', 'Refused', 'Missed', 'Held', 'Undo']),
    reason: z.string().trim().max(400).optional().nullable(),
    identityVerified: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.action === 'Taken' ||
      d.action === 'Undo' ||
      (typeof d.reason === 'string' && d.reason.trim().length >= 3),
    { message: 'A reason (at least 3 characters) is required for Refused, Missed, or Held doses.' }
  );

export const stockMovementSchema = z.object({
  stockId: z.string().min(1),
  movementType: z.enum(['Stock in', 'Adjustment', 'Return', 'Disposal', 'Damage']),
  quantityChange: z.coerce.number().int().refine((n) => n !== 0, 'Quantity change cannot be zero'),
  reason: z.string().trim().min(3, 'Provide a reason for this stock movement').max(400),
});

export const createStockBatchSchema = z.object({
  medicineId: z.string().min(1),
  batchNumber: z.string().trim().min(2).max(60),
  supplierId: z.string().min(1),
  locationId: z.string().min(1),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  unitCost: z.coerce.number().nonnegative(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reorderLevel: z.coerce.number().int().min(0).default(20),
  initialQuantity: z.coerce.number().int().positive('Initial quantity must be positive'),
});

export const fridgeTempSchema = z.object({
  locationId: z.string().min(1),
  temperatureC: z.coerce.number().min(-20).max(40),
});

export const vitalReadingSchema = z.object({
  residentId: z.string().min(1, 'Select a resident'),
  bpSystolic: z.coerce.number().int().min(50).max(260).optional().nullable(),
  bpDiastolic: z.coerce.number().int().min(30).max(160).optional().nullable(),
  bloodSugar: z.coerce.number().min(20).max(600).optional().nullable(),
  bloodSugarUnit: z.enum(['mg/dL', 'mmol/L']).default('mg/dL'),
  temperatureC: z.coerce.number().min(32).max(43).optional().nullable(),
  pulseBpm: z.coerce.number().int().min(30).max(220).optional().nullable(),
  spo2Percent: z.coerce.number().int().min(50).max(100).optional().nullable(),
  weightKg: z.coerce.number().min(20).max(250).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const alertActionSchema = z
  .object({
    alertId: z.string().min(1),
    action: z.enum(['Acknowledged', 'Resolved', 'Note']),
    note: z.string().trim().max(500).default(''),
  })
  .refine((d) => d.action !== 'Resolved' || d.note.trim().length >= 3, {
    message: 'Resolving an alert requires a note of at least 3 characters.',
  });

export const emergencyIncidentSchema = z.object({
  residentId: z.string().min(1),
  description: z.string().trim().min(5, 'Describe the emergency event').max(1000),
});

export const incidentLogEntrySchema = z.object({
  incidentId: z.string().min(1),
  actionTaken: z.string().trim().min(3).max(500),
  outcome: z.string().trim().min(2).max(500),
});

export const handoverNoteSchema = z.object({
  residentId: z.string().min(1),
  windowId: z.string().min(1),
  body: z.string().trim().min(3, 'Enter handover note').max(1000),
});

export const residentNoteSchema = z.object({
  residentId: z.string().min(1),
  noteType: z.enum(['Doctor visit', 'General']),
  body: z.string().trim().min(3, 'Enter note text').max(2000),
});

export const assistantQuerySchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().trim().min(2, 'Enter a question').max(2000),
});
