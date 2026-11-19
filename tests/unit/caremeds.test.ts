import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  validatePasswordRules,
  generateTemporaryPassword,
  generateUsername,
} from '../../lib/auth/password';
import {
  createTotpSecret,
  generateCurrentTotpCode,
  verifyTotpCode,
} from '../../lib/auth/totp';
import {
  encryptSecret,
  decryptSecret,
  deriveCsrfToken,
  sha256Hex,
} from '../../lib/crypto';
import {
  generateRecoveryCodes,
  findMatchingUnusedRecoveryCode,
} from '../../lib/auth/recovery-codes';
import {
  checkIpRateLimit,
  resetIpRateLimitForTests,
  evaluateFailedAttempt,
} from '../../lib/auth/lockout';
import { can } from '../../lib/permissions/permissions';
import {
  canAccessResident,
  canCaretakerAdministerDose,
  canDoctorManageResident,
} from '../../lib/permissions/scope';
import {
  checkPrescriptionAllergy,
  checkDoseUnitMatchesMedicine,
  hasOverlappingSchedule,
} from '../../lib/services/dosing';
import {
  computeStockQuantity,
  selectFefoBatchForDose,
  canApproveStockMovement,
} from '../../lib/services/stock';
import { evaluateVitalAbnormalities } from '../../lib/services/vitals';
import { buildCredentialCsv } from '../../lib/exports/csv';
import { checkAssistantGuardrails } from '../../lib/assistant/guardrails';
import { calculateAge, canUndoDose, isDoseOverdue } from '../../lib/time';
import type {
  AllergyRecord,
  CareAssignmentRecord,
  DosageScheduleRecord,
  InventoryItemRecord,
  MedicineRecord,
  ResidentRecord,
  StockMovementRecord,
  VitalTypeRecord,
} from '../../lib/types';

test('Argon2id password hashing, verification, policy, and username generation', () => {
  const hash = hashPassword('StrongCareMeds#2026');
  assert.ok(hash.startsWith('$argon2id$'));
  assert.equal(verifyPassword('StrongCareMeds#2026', hash), true);
  assert.equal(verifyPassword('WrongPassword#2026', hash), false);

  assert.equal(validatePasswordRules('short', 'priya.nair').valid, false);
  assert.equal(validatePasswordRules('priya.nair12', 'priya.nair12').valid, false);
  assert.equal(
    validatePasswordRules('TempPass123456', 'priya.nair', 'TempPass123456').valid,
    false
  );
  assert.equal(
    validatePasswordRules('NewSecurePass#2026', 'priya.nair', 'TempPass123456').valid,
    true
  );

  const temp = generateTemporaryPassword(16);
  assert.equal(temp.length, 16);

  assert.equal(generateUsername('Ananya Desai', []), 'ananya.desai');
  const suffixed = generateUsername('Ananya Desai', ['ananya.desai']);
  assert.match(suffixed, /^ananya\.desai\d{3}$/);
});

test('AES-256-GCM encryption and RFC 6238 TOTP with 1-step tolerance', () => {
  const secret = createTotpSecret();
  const encrypted = encryptSecret(secret);
  assert.notEqual(encrypted, secret);
  assert.equal(decryptSecret(encrypted), secret);

  const code = generateCurrentTotpCode(secret);
  assert.match(code, /^\d{6}$/);
  assert.equal(verifyTotpCode(code, secret), true);
  assert.equal(verifyTotpCode('000000', secret), false);

  const csrf1 = deriveCsrfToken(sha256Hex('token-a'));
  const csrf2 = deriveCsrfToken(sha256Hex('token-b'));
  assert.notEqual(csrf1, csrf2);
});

test('Single-use MFA recovery codes', () => {
  const { plainCodes, hashes } = generateRecoveryCodes(10);
  assert.equal(plainCodes.length, 10);
  assert.equal(hashes.length, 10);

  const records = hashes.map((h, i) => ({
    codeId: `code-${i}`,
    userId: 'u1',
    codeHash: h,
    usedAt: null as string | null,
    createdAt: new Date().toISOString(),
  }));

  const matched = findMatchingUnusedRecoveryCode(records, plainCodes[3]);
  assert.ok(matched);
  matched.usedAt = new Date().toISOString();
  assert.equal(findMatchingUnusedRecoveryCode(records, plainCodes[3]), null);
});

test('Lockout after 5 failures and 20-attempts/15-min IP rate limit', () => {
  assert.deepEqual(evaluateFailedAttempt(3, 5), { nextFailedCount: 4, shouldLock: false });
  assert.deepEqual(evaluateFailedAttempt(4, 5), { nextFailedCount: 5, shouldLock: true });

  resetIpRateLimitForTests('192.0.2.10');
  const baseTime = 1_700_000_000_000;
  for (let i = 0; i < 20; i++) {
    assert.equal(checkIpRateLimit('192.0.2.10', baseTime + i * 1000).allowed, true);
  }
  const blocked = checkIpRateLimit('192.0.2.10', baseTime + 21_000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
});

test('RBAC permission matrix and role resident scoping', () => {
  assert.equal(can('Admin', 'dose.confirm'), false);
  assert.equal(can('Admin', 'prescription.create'), false);
  assert.equal(can('Admin', 'user.create'), true);
  assert.equal(can('Doctor', 'prescription.create'), true);
  assert.equal(can('Doctor', 'dose.confirm'), false);
  assert.equal(can('Caretaker', 'dose.confirm'), true);
  assert.equal(can('Caretaker', 'stock.approve_adjustment'), false);

  const resident: ResidentRecord = {
    residentId: 'r1',
    fullName: 'Test Resident',
    photoPath: null,
    dateOfBirth: '1945-01-01',
    gender: 'Female',
    bloodGroup: 'O+',
    bedId: null,
    admissionDate: '2025-01-01',
    dietNotes: null,
    assignedDoctorId: 'doc-1',
    status: 'Active',
    archivedAt: null,
    archiveReason: null,
    allergyStatus: 'None known',
    createdBy: 'adm-1',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  const assignments: CareAssignmentRecord[] = [
    {
      assignmentId: 'a1',
      caretakerId: 'ct-1',
      residentId: 'r1',
      assignedBy: 'doc-1',
      assignedAt: '2025-01-01T00:00:00Z',
      endedAt: null,
      endedBy: null,
    },
    {
      assignmentId: 'a2',
      caretakerId: 'ct-2',
      residentId: 'r1',
      assignedBy: 'doc-1',
      assignedAt: '2025-01-01T00:00:00Z',
      endedAt: '2025-02-01T00:00:00Z',
      endedBy: 'doc-1',
    },
  ];

  assert.equal(canAccessResident({ userId: 'adm-1', role: 'Admin' }, resident, assignments), true);
  assert.equal(canAccessResident({ userId: 'doc-1', role: 'Doctor' }, resident, assignments), true);
  assert.equal(canAccessResident({ userId: 'doc-2', role: 'Doctor' }, resident, assignments), false);
  assert.equal(canDoctorManageResident({ userId: 'doc-1', role: 'Doctor' }, resident), true);
  assert.equal(canCaretakerAdministerDose({ userId: 'ct-1', role: 'Caretaker' }, 'r1', assignments), true);
  assert.equal(canCaretakerAdministerDose({ userId: 'ct-2', role: 'Caretaker' }, 'r1', assignments), false);
});

test('Allergy checks (Severe blocks, Mild requires override), stock unit match, and schedule overlap', () => {
  const medAmox: MedicineRecord = {
    medicineId: 'm-amox',
    name: 'Mox 500',
    genericName: 'Amoxicillin',
    form: 'Capsule',
    strength: '500 mg',
    stockUnit: 'capsule',
    manufacturer: 'Sun',
    category: 'Antibiotic',
    foodInstruction: null,
    sideEffects: null,
    storageCondition: null,
    isControlled: false,
    status: 'Active',
    approvalStatus: 'Approved',
    proposedBy: 'doc-1',
    approvedBy: 'adm-1',
    createdAt: '2025-01-01T00:00:00Z',
  };

  const severeAllergy: AllergyRecord = {
    allergyId: 'al-1',
    residentId: 'r1',
    medicineId: 'm-amox',
    substanceText: null,
    reaction: 'Anaphylaxis',
    severity: 'Severe',
    recordedBy: 'doc-1',
    recordedAt: '2025-01-01T00:00:00Z',
  };

  const mildAllergy: AllergyRecord = {
    ...severeAllergy,
    severity: 'Mild',
    reaction: 'Mild rash',
  };

  assert.equal(checkPrescriptionAllergy([severeAllergy], medAmox).status, 'BlockedSevere');
  assert.equal(checkPrescriptionAllergy([mildAllergy], medAmox).status, 'WarningOverrideRequired');
  assert.equal(checkPrescriptionAllergy([], medAmox).status, 'Clear');

  assert.equal(checkDoseUnitMatchesMedicine('capsule', medAmox).valid, true);
  assert.equal(checkDoseUnitMatchesMedicine('tablet', medAmox).valid, false);

  const schedules: DosageScheduleRecord[] = [
    {
      scheduleId: 's1',
      prescriptionId: 'rx1',
      doseAmount: 1,
      doseUnit: 'capsule',
      route: 'Oral',
      frequency: 'Once daily',
      intervalHours: null,
      isPrn: false,
      prnMinGapMinutes: null,
      prnMaxPerDay: null,
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-06-30',
      changedBy: 'doc-1',
      changeReason: null,
      times: [],
    },
  ];
  assert.equal(hasOverlappingSchedule(schedules, '2026-06-15', '2026-12-31'), true);
  assert.equal(hasOverlappingSchedule(schedules, '2026-07-01', '2026-12-31'), false);
});

test('FEFO stock selection skips expired batches, ignores Pending adjustments, and prevents self-approval', () => {
  const items: InventoryItemRecord[] = [
    { stockId: 'expired', medicineId: 'm1', batchNumber: 'B0', supplierId: 's1', locationId: 'l1', purchaseDate: '2025-01-01', unitCost: 1, expiryDate: '2026-11-01', reorderLevel: 5 },
    { stockId: 'later', medicineId: 'm1', batchNumber: 'B2', supplierId: 's1', locationId: 'l1', purchaseDate: '2026-01-01', unitCost: 1, expiryDate: '2027-06-01', reorderLevel: 5 },
    { stockId: 'sooner', medicineId: 'm1', batchNumber: 'B1', supplierId: 's1', locationId: 'l1', purchaseDate: '2026-01-01', unitCost: 1, expiryDate: '2027-01-01', reorderLevel: 5 },
  ];

  const movements: StockMovementRecord[] = [
    { movementId: 'mv1', stockId: 'expired', movementType: 'Stock in', quantityChange: 50, reason: null, doseEventId: null, approvalStatus: 'Not required', performedBy: 'u1', approvedBy: null, createdAt: '2026-01-01T00:00:00Z' },
    { movementId: 'mv2', stockId: 'sooner', movementType: 'Stock in', quantityChange: 10, reason: null, doseEventId: null, approvalStatus: 'Not required', performedBy: 'u1', approvedBy: null, createdAt: '2026-01-01T00:00:00Z' },
    { movementId: 'mv3', stockId: 'sooner', movementType: 'Adjustment', quantityChange: -9, reason: 'Pending check', doseEventId: null, approvalStatus: 'Pending', performedBy: 'u2', approvedBy: null, createdAt: '2026-01-02T00:00:00Z' },
    { movementId: 'mv4', stockId: 'later', movementType: 'Stock in', quantityChange: 25, reason: null, doseEventId: null, approvalStatus: 'Not required', performedBy: 'u1', approvedBy: null, createdAt: '2026-01-01T00:00:00Z' },
  ];

  // Pending movement (-9) MUST NOT count toward quantity on hand
  assert.equal(computeStockQuantity('sooner', movements), 10);

  const selected = selectFefoBatchForDose('m1', 2, '2026-11-19', items, movements);
  assert.equal(selected.batch?.stockId, 'sooner');
  assert.equal(selected.totalAvailableNonExpired, 35);

  // Self-approval blocked
  assert.equal(canApproveStockMovement(movements[2], 'u2').allowed, false);
  assert.equal(canApproveStockMovement(movements[2], 'adm-1').allowed, true);
});

test('Vital threshold evaluation stays off when thresholds are null and flags out-of-range when set', () => {
  const nullTypes: VitalTypeRecord[] = [
    { vitalTypeId: 'v1', code: 'BP_SYSTOLIC', name: 'BP Systolic', unit: 'mmHg', minNormal: null, maxNormal: null },
  ];
  assert.equal(
    evaluateVitalAbnormalities(
      { bpSystolic: 190, bpDiastolic: 110, bloodSugar: null, temperatureC: null, pulseBpm: null, spo2Percent: null, weightKg: null },
      nullTypes
    ).length,
    0
  );

  const configuredTypes: VitalTypeRecord[] = [
    { vitalTypeId: 'v1', code: 'BP_SYSTOLIC', name: 'BP Systolic', unit: 'mmHg', minNormal: 90, maxNormal: 140 },
    { vitalTypeId: 'v2', code: 'SPO2', name: 'SpO2', unit: '%', minNormal: 94, maxNormal: 100 },
  ];
  const flags = evaluateVitalAbnormalities(
    { bpSystolic: 165, bpDiastolic: 90, bloodSugar: null, temperatureC: null, pulseBpm: null, spo2Percent: 91, weightKg: null },
    configuredTypes
  );
  assert.equal(flags.length, 2);
  assert.equal(flags[0].direction, 'high');
  assert.equal(flags[1].direction, 'low');
});

test('Credential CSV format, Care Assistant zero-PII guardrails, and time utilities', () => {
  const csv = buildCredentialCsv({
    fullName: 'Dr. Ananya Desai',
    role: 'Doctor',
    username: 'ananya.desai',
    temporaryPassword: 'Temp#1234567890!',
    expiresOn: '2026-11-26',
    facility: 'Shanti Niketan Senior Care',
  });
  assert.ok(csv.startsWith('full_name,role,username,temporary_password,expires_on,facility\n'));
  assert.ok(csv.includes('ananya.desai'));

  assert.equal(
    checkAssistantGuardrails('What are common side effects of Amlodipine?', ['Kamala Subramanian']).allowed,
    true
  );
  assert.equal(
    checkAssistantGuardrails('Should Kamala Subramanian take more Amlodipine?', ['Kamala Subramanian']).allowed,
    false
  );
  assert.equal(
    checkAssistantGuardrails('Resident in Room 101 has a cough', []).allowed,
    false
  );

  assert.equal(calculateAge('1943-04-12', new Date('2026-11-19T00:00:00Z')), 83);
  assert.equal(
    isDoseOverdue('2026-11-19T08:00:00Z', 'Pending', 60, new Date('2026-11-19T09:05:00Z')),
    true
  );
  assert.equal(
    canUndoDose('2026-11-19T09:10:00Z', 'ct-1', 'ct-1', new Date('2026-11-19T09:08:00Z')),
    true
  );
  assert.equal(
    canUndoDose('2026-11-19T09:10:00Z', 'ct-1', 'ct-2', new Date('2026-11-19T09:08:00Z')),
    false
  );
});
