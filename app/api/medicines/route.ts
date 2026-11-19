import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/session';
import { can } from '@/lib/permissions/permissions';
import { appendAuditLog, loadStore, persistStore } from '@/lib/store/repository';
import { createMedicineSchema } from '@/lib/validation/schemas';

export async function GET() {
  const auth = await requireApiAuth('medicine.view');
  if (!auth.ok) return auth.response;

  const store = loadStore();
  const medicines = store.medicines.map((m) => ({
    ...m,
    proposedByName: store.users.find((u) => u.userId === m.proposedBy)?.fullName || 'Staff',
    approvedByName: m.approvedBy
      ? store.users.find((u) => u.userId === m.approvedBy)?.fullName || null
      : null,
  }));

  return NextResponse.json({ medicines });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth('medicine.view');
  if (!auth.ok) return auth.response;

  const role = auth.ctx.user.role;
  if (!can(role, 'medicine.propose') && !can(role, 'medicine.approve')) {
    return NextResponse.json({ error: 'Only Doctors or Administrators can add/propose medicines.' }, { status: 403 });
  }

  const parsed = createMedicineSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid medicine details' }, { status: 400 });
  }

  const store = loadStore();
  const nowIso = new Date().toISOString();
  const medicineId = randomUUID();
  const isAdmin = role === 'Admin';

  const record = {
    medicineId,
    ...parsed.data,
    foodInstruction: parsed.data.foodInstruction || null,
    sideEffects: parsed.data.sideEffects || null,
    storageCondition: parsed.data.storageCondition || null,
    status: 'Active' as const,
    // Doctors propose -> Pending; Admins adding directly -> Approved
    approvalStatus: (isAdmin ? 'Approved' : 'Pending') as 'Approved' | 'Pending',
    proposedBy: auth.ctx.user.userId,
    approvedBy: isAdmin ? auth.ctx.user.userId : null,
    createdAt: nowIso,
  };

  store.medicines.unshift(record);
  appendAuditLog(store, {
    userId: auth.ctx.user.userId,
    action: 'INSERT',
    tableName: 'medicine_catalogue',
    recordId: medicineId,
    newValues: { name: record.name, stock_unit: record.stockUnit, approval_status: record.approvalStatus },
  });
  persistStore(store);

  return NextResponse.json({ ok: true, medicine: record }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiAuth('medicine.approve');
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const store = loadStore();
  const med = store.medicines.find((m) => m.medicineId === body.medicineId);
  if (!med) return NextResponse.json({ error: 'Medicine not found' }, { status: 404 });

  if (body.action === 'approve' || body.action === 'reject') {
    if (med.proposedBy === auth.ctx.user.userId) {
      return NextResponse.json(
        { error: 'You cannot approve or reject your own medicine proposal.' },
        { status: 403 }
      );
    }
    const oldApproval = med.approvalStatus;
    med.approvalStatus = body.action === 'approve' ? 'Approved' : 'Rejected';
    med.approvedBy = auth.ctx.user.userId;
    appendAuditLog(store, {
      userId: auth.ctx.user.userId,
      action: 'UPDATE',
      tableName: 'medicine_catalogue',
      recordId: med.medicineId,
      oldValues: { approval_status: oldApproval },
      newValues: { approval_status: med.approvalStatus },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, medicine: med });
  }

  if (body.action === 'discontinue' || body.action === 'reactivate') {
    const oldStatus = med.status;
    med.status = body.action === 'discontinue' ? 'Discontinued' : 'Active';
    appendAuditLog(store, {
      userId: auth.ctx.user.userId,
      action: 'UPDATE',
      tableName: 'medicine_catalogue',
      recordId: med.medicineId,
      oldValues: { status: oldStatus },
      newValues: { status: med.status },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, medicine: med });
  }

  return NextResponse.json({ error: 'Unknown medicine action' }, { status: 400 });
}
