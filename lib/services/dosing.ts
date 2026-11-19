import type {
  AllergyRecord,
  DosageScheduleRecord,
  MedicineRecord,
  PrescriptionRecord,
} from '../types';

export interface AllergyCheckOutcome {
  status: 'Clear' | 'WarningOverrideRequired' | 'BlockedSevere';
  matchingAllergy: AllergyRecord | null;
  message?: string;
}

export function checkPrescriptionAllergy(
  residentAllergies: AllergyRecord[],
  medicine: MedicineRecord
): AllergyCheckOutcome {
  const medNameLower = medicine.name.toLowerCase();
  const genericLower = medicine.genericName.toLowerCase();

  const match =
    residentAllergies.find((a) => {
      if (a.medicineId && a.medicineId === medicine.medicineId) return true;
      if (a.substanceText) {
        const sub = a.substanceText.trim().toLowerCase();
        if (sub && (medNameLower.includes(sub) || genericLower.includes(sub))) {
          return true;
        }
      }
      return false;
    }) || null;

  if (!match) {
    return { status: 'Clear', matchingAllergy: null };
  }

  if (match.severity === 'Severe') {
    return {
      status: 'BlockedSevere',
      matchingAllergy: match,
      message: `Prescribing blocked: resident has a Severe allergy (${match.reaction}). A doctor must review and update or downgrade the allergy record before prescribing.`,
    };
  }

  return {
    status: 'WarningOverrideRequired',
    matchingAllergy: match,
    message: `Allergy warning (${match.severity}): ${match.reaction}. Enter an allergy override reason to proceed.`,
  };
}

export function checkDoseUnitMatchesMedicine(
  doseUnit: string,
  medicine: MedicineRecord
): { valid: boolean; error?: string } {
  if (doseUnit !== medicine.stockUnit) {
    return {
      valid: false,
      error: `Dose unit (${doseUnit}) must match the medicine's stock unit (${medicine.stockUnit}). Update the medicine catalogue record if needed; unit conversions are not permitted.`,
    };
  }
  return { valid: true };
}

export function checkDuplicateActivePrescription(
  residentId: string,
  medicineId: string,
  existingPrescriptions: PrescriptionRecord[]
): PrescriptionRecord | null {
  return (
    existingPrescriptions.find(
      (p) =>
        p.residentId === residentId &&
        p.medicineId === medicineId &&
        (p.status === 'Active' || p.status === 'On hold')
    ) || null
  );
}

export function doDateRangesOverlap(
  aStart: string,
  aEnd: string | null,
  bStart: string,
  bEnd: string | null
): boolean {
  const aEndEff = aEnd ?? '9999-12-31';
  const bEndEff = bEnd ?? '9999-12-31';
  return aStart <= bEndEff && bStart <= aEndEff;
}

export function hasOverlappingSchedule(
  existingSchedules: DosageScheduleRecord[],
  effectiveFrom: string,
  effectiveTo: string | null
): boolean {
  return existingSchedules.some((s) =>
    doDateRangesOverlap(s.effectiveFrom, s.effectiveTo, effectiveFrom, effectiveTo)
  );
}
