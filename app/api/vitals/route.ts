import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/session';
import { canAccessResident, filterScopedResidents } from '@/lib/permissions/scope';
import { evaluateVitalAbnormalities } from '@/lib/services/vitals';
import { loadStore, persistStore, queueAlertIfNotActive } from '@/lib/store/repository';
import { vitalReadingSchema } from '@/lib/validation/schemas';

export async function GET() {
  const auth = await requireApiAuth('vitals.view');
  if (!auth.ok) return auth.response;

  const store = loadStore();
  const actor = { userId: auth.ctx.user.userId, role: auth.ctx.user.role };
  const scopedResidents = filterScopedResidents(actor, store.residents, store.careAssignments).filter(
    (r) => r.status === 'Active'
  );
  const scopedIds = new Set(scopedResidents.map((r) => r.residentId));

  const readings = store.vitalReadings
    .filter((v) => scopedIds.has(v.residentId))
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .map((v) => {
      const resident = store.residents.find((r) => r.residentId === v.residentId);
      const recorder = store.users.find((u) => u.userId === v.recordedBy);
      const abnormalFlags = evaluateVitalAbnormalities(v, store.vitalTypes);
      return {
        ...v,
        residentName: resident?.fullName || 'Unknown',
        recordedByName: recorder?.fullName || 'Staff',
        abnormalFlags,
      };
    });

  return NextResponse.json({
    readings,
    vitalTypes: store.vitalTypes,
    residents: scopedResidents.map((r) => ({ residentId: r.residentId, fullName: r.fullName })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth('vitals.record');
  if (!auth.ok) return auth.response;

  const parsed = vitalReadingSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid vital reading' },
      { status: 400 }
    );
  }

  const store = loadStore();
  const resident = store.residents.find((r) => r.residentId === parsed.data.residentId);
  if (!resident) return NextResponse.json({ error: 'Resident not found' }, { status: 404 });

  if (
    !canAccessResident(
      { userId: auth.ctx.user.userId, role: auth.ctx.user.role },
      resident,
      store.careAssignments
    )
  ) {
    return NextResponse.json({ error: 'Forbidden: resident outside your scope' }, { status: 403 });
  }

  const reading = {
    readingId: randomUUID(),
    residentId: resident.residentId,
    recordedAt: new Date().toISOString(),
    recordedBy: auth.ctx.user.userId,
    bpSystolic: parsed.data.bpSystolic ?? null,
    bpDiastolic: parsed.data.bpDiastolic ?? null,
    bloodSugar: parsed.data.bloodSugar ?? null,
    bloodSugarUnit: parsed.data.bloodSugarUnit,
    temperatureC: parsed.data.temperatureC ?? null,
    pulseBpm: parsed.data.pulseBpm ?? null,
    spo2Percent: parsed.data.spo2Percent ?? null,
    weightKg: parsed.data.weightKg ?? null,
    notes: parsed.data.notes || null,
  };

  store.vitalReadings.unshift(reading);

  // Abnormal vital alerts fire ONLY when facility doctor has configured thresholds
  const abnormalFlags = evaluateVitalAbnormalities(reading, store.vitalTypes);
  if (abnormalFlags.length > 0) {
    const summary = abnormalFlags
      .map((f) => `${f.name}: ${f.value} ${f.unit} (${f.direction})`)
      .join('; ');
    queueAlertIfNotActive(store, {
      alertCode: 'ABNORMAL_VITAL',
      priority: 'High',
      residentId: resident.residentId,
      readingId: reading.readingId,
      message: `Out-of-range vitals recorded for ${resident.fullName}: ${summary}`,
    });
  }

  persistStore(store);
  return NextResponse.json({ ok: true, reading, abnormalFlags }, { status: 201 });
}
