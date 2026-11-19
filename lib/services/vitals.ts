import type { VitalReadingRecord, VitalTypeRecord } from '../types';

export interface AbnormalVitalFlag {
  code: VitalTypeRecord['code'];
  name: string;
  value: number;
  unit: string;
  minNormal: number | null;
  maxNormal: number | null;
  direction: 'low' | 'high';
}

/**
 * Evaluates a vital reading against facility vital_types thresholds.
 * Null thresholds mean the alert for that vital is disabled.
 */
export function evaluateVitalAbnormalities(
  reading: Pick<
    VitalReadingRecord,
    'bpSystolic' | 'bpDiastolic' | 'bloodSugar' | 'temperatureC' | 'pulseBpm' | 'spo2Percent' | 'weightKg'
  >,
  vitalTypes: VitalTypeRecord[]
): AbnormalVitalFlag[] {
  const valueByCode: Partial<Record<VitalTypeRecord['code'], number | null>> = {
    BP_SYSTOLIC: reading.bpSystolic,
    BP_DIASTOLIC: reading.bpDiastolic,
    BLOOD_SUGAR: reading.bloodSugar,
    TEMPERATURE: reading.temperatureC,
    PULSE: reading.pulseBpm,
    SPO2: reading.spo2Percent,
    WEIGHT: reading.weightKg,
  };

  const flags: AbnormalVitalFlag[] = [];

  for (const vt of vitalTypes) {
    const val = valueByCode[vt.code];
    if (val === null || val === undefined) continue;
    if (vt.minNormal !== null && val < vt.minNormal) {
      flags.push({
        code: vt.code,
        name: vt.name,
        value: val,
        unit: vt.unit,
        minNormal: vt.minNormal,
        maxNormal: vt.maxNormal,
        direction: 'low',
      });
    } else if (vt.maxNormal !== null && val > vt.maxNormal) {
      flags.push({
        code: vt.code,
        name: vt.name,
        value: val,
        unit: vt.unit,
        minNormal: vt.minNormal,
        maxNormal: vt.maxNormal,
        direction: 'high',
      });
    }
  }

  return flags;
}
