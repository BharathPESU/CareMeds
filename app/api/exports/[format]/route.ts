import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/session';
import { buildGenericCsv } from '@/lib/exports/csv';
import { buildExcelBuffer } from '@/lib/exports/excel';
import { buildPdfReportBuffer } from '@/lib/exports/pdf';
import { filterScopedResidents } from '@/lib/permissions/scope';
import { computeStockQuantity } from '@/lib/services/stock';
import { loadStore } from '@/lib/store/repository';
import { formatDateTime } from '@/lib/time';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ format: string }> }
) {
  const auth = await requireApiAuth('reports.view');
  if (!auth.ok) return auth.response;

  const { format } = await context.params;
  const dataset = req.nextUrl.searchParams.get('dataset') || 'rounds';
  const store = loadStore();
  const scopedResidents = filterScopedResidents(
    { userId: auth.ctx.user.userId, role: auth.ctx.user.role },
    store.residents,
    store.careAssignments
  );
  const scopedIds = new Set(scopedResidents.map((r) => r.residentId));

  let title = 'Medication Rounds Report';
  let headers: string[] = [];
  let rows: string[][] = [];

  if (dataset === 'rounds' || dataset === 'adherence') {
    title = dataset === 'rounds' ? 'Daily Medication Administration Record' : 'Medication Adherence Report';
    headers = ['Scheduled Time', 'Resident', 'Medicine', 'Dose', 'Status', 'Confirmed By', 'Reason'];
    rows = store.doseEvents
      .map((ev) => {
        const sch = store.dosageSchedules.find((s) => s.scheduleId === ev.scheduleId);
        const rx = sch ? store.prescriptions.find((p) => p.prescriptionId === sch.prescriptionId) : null;
        if (!rx || !scopedIds.has(rx.residentId)) return null;
        const res = store.residents.find((r) => r.residentId === rx.residentId);
        const med = store.medicines.find((m) => m.medicineId === rx.medicineId);
        const staff = ev.confirmedBy
          ? store.users.find((u) => u.userId === ev.confirmedBy)?.fullName || ''
          : '';
        return [
          formatDateTime(ev.scheduledAt),
          res?.fullName || '',
          med ? `${med.name} (${med.strength})` : '',
          sch ? `${sch.doseAmount} ${sch.doseUnit}` : '',
          ev.status,
          staff,
          ev.reason || '',
        ];
      })
      .filter((r): r is string[] => r !== null);
  } else if (dataset === 'vitals') {
    title = 'Resident Vital Readings Report';
    headers = ['Recorded At', 'Resident', 'BP (mmHg)', 'Blood Sugar', 'Temp (°C)', 'Pulse (bpm)', 'SpO2 (%)', 'Weight (kg)'];
    rows = store.vitalReadings
      .filter((v) => scopedIds.has(v.residentId))
      .map((v) => {
        const res = store.residents.find((r) => r.residentId === v.residentId);
        return [
          formatDateTime(v.recordedAt),
          res?.fullName || '',
          v.bpSystolic && v.bpDiastolic ? `${v.bpSystolic}/${v.bpDiastolic}` : '—',
          v.bloodSugar != null ? `${v.bloodSugar} ${v.bloodSugarUnit}` : '—',
          v.temperatureC != null ? String(v.temperatureC) : '—',
          v.pulseBpm != null ? String(v.pulseBpm) : '—',
          v.spo2Percent != null ? String(v.spo2Percent) : '—',
          v.weightKg != null ? String(v.weightKg) : '—',
        ];
      });
  } else if (dataset === 'inventory') {
    title = 'Medicine Inventory & Batch Expiry Report';
    headers = ['Medicine', 'Batch', 'Expiry Date', 'Quantity On Hand', 'Unit', 'Reorder Level', 'Storage Location'];
    rows = store.inventoryItems.map((item) => {
      const med = store.medicines.find((m) => m.medicineId === item.medicineId);
      const loc = store.storageLocations.find((l) => l.locationId === item.locationId);
      const qty = computeStockQuantity(item.stockId, store.stockMovements);
      return [
        med ? `${med.name} (${med.strength})` : '',
        item.batchNumber,
        item.expiryDate,
        String(qty),
        med?.stockUnit || '',
        String(item.reorderLevel),
        loc?.name || '',
      ];
    });
  } else {
    return NextResponse.json({ error: 'Unsupported export dataset' }, { status: 400 });
  }

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    const csv = buildGenericCsv(headers, rows);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="caremeds-${dataset}-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (format === 'excel') {
    const columns = headers.map((h, idx) => ({ header: h, key: `c${idx}`, width: 22 }));
    const objects = rows.map((r) => {
      const obj: Record<string, string> = {};
      r.forEach((v, idx) => {
        obj[`c${idx}`] = v;
      });
      return obj;
    });
    const buffer = await buildExcelBuffer(title, columns, objects);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="caremeds-${dataset}-${stamp}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (format === 'pdf') {
    const pdfBytes = await buildPdfReportBuffer({
      title,
      subtitle: `Role: ${auth.ctx.user.role} (${auth.ctx.user.fullName})`,
      facilityName: store.facility.name,
      generatedAt: formatDateTime(new Date().toISOString()),
      headers,
      rows,
    });
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="caremeds-${dataset}-${stamp}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.json({ error: 'Unsupported format. Use csv, excel, or pdf.' }, { status: 400 });
}
