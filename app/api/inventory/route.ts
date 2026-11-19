import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/session';
import { can } from '@/lib/permissions/permissions';
import { canApproveStockMovement, computeStockQuantity } from '@/lib/services/stock';
import { appendAuditLog, loadStore, persistStore } from '@/lib/store/repository';
import { daysUntilDate } from '@/lib/time';
import {
  createStockBatchSchema,
  fridgeTempSchema,
  stockMovementSchema,
} from '@/lib/validation/schemas';

export async function GET() {
  const auth = await requireApiAuth('stock.view');
  if (!auth.ok) return auth.response;

  const store = loadStore();
  const expiryWarningDays = Number(store.systemSettings.expiry_warning_days || '60');

  const items = store.inventoryItems
    .map((item) => {
      const med = store.medicines.find((m) => m.medicineId === item.medicineId);
      const loc = store.storageLocations.find((l) => l.locationId === item.locationId);
      const sup = store.suppliers.find((s) => s.supplierId === item.supplierId);
      const quantityOnHand = computeStockQuantity(item.stockId, store.stockMovements);
      const daysToExpiry = daysUntilDate(item.expiryDate);

      return {
        ...item,
        medicineName: med?.name || 'Unknown',
        medicineStrength: med?.strength || '',
        stockUnit: med?.stockUnit || 'unit',
        isControlled: med?.isControlled || false,
        locationName: loc?.name || 'Unknown',
        locationType: loc?.locationType || 'Cabinet',
        supplierName: sup?.name || 'Unknown',
        quantityOnHand,
        daysToExpiry,
        isExpired: daysToExpiry <= 0,
        isExpiringSoon: daysToExpiry > 0 && daysToExpiry <= expiryWarningDays,
        isLowStock: daysToExpiry > 0 && quantityOnHand <= item.reorderLevel,
      };
    })
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  const movements = store.stockMovements
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 60)
    .map((m) => {
      const item = store.inventoryItems.find((i) => i.stockId === m.stockId);
      const med = item ? store.medicines.find((md) => md.medicineId === item.medicineId) : null;
      return {
        ...m,
        batchNumber: item?.batchNumber || '',
        medicineName: med?.name || '',
        stockUnit: med?.stockUnit || '',
        performedByName: store.users.find((u) => u.userId === m.performedBy)?.fullName || 'Staff',
        approvedByName: m.approvedBy
          ? store.users.find((u) => u.userId === m.approvedBy)?.fullName || null
          : null,
      };
    });

  const fridgeLogs = store.fridgeTemperatureLogs
    .slice()
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, 20)
    .map((l) => ({
      ...l,
      locationName:
        store.storageLocations.find((loc) => loc.locationId === l.locationId)?.name || 'Fridge',
      recordedByName: store.users.find((u) => u.userId === l.recordedBy)?.fullName || 'Staff',
    }));

  const purchaseOrders = store.purchaseOrders.map((po) => ({
    ...po,
    supplierName: store.suppliers.find((s) => s.supplierId === po.supplierId)?.name || 'Supplier',
    createdByName: store.users.find((u) => u.userId === po.createdBy)?.fullName || 'Admin',
    approvedByName: po.approvedBy
      ? store.users.find((u) => u.userId === po.approvedBy)?.fullName || null
      : null,
    lines: po.lines.map((line) => ({
      ...line,
      medicineName:
        store.medicines.find((m) => m.medicineId === line.medicineId)?.name || 'Medicine',
    })),
  }));

  return NextResponse.json({
    items,
    movements,
    pendingMovements: movements.filter((m) => m.approvalStatus === 'Pending'),
    storageLocations: store.storageLocations,
    fridgeLogs,
    suppliers: store.suppliers,
    purchaseOrders,
    medicines: store.medicines.filter((m) => m.approvalStatus === 'Approved'),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth('stock.view');
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const store = loadStore();
  const role = auth.ctx.user.role;
  const userId = auth.ctx.user.userId;
  const nowIso = new Date().toISOString();

  // 1. Log fridge temperature (Caretaker or Admin)
  if (body.operation === 'fridge_temp') {
    if (!can(role, 'stock.receive_return')) {
      return NextResponse.json({ error: 'You do not have permission to record fridge temperatures.' }, { status: 403 });
    }
    const parsed = fridgeTempSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid temperature' }, { status: 400 });
    }
    const loc = store.storageLocations.find((l) => l.locationId === parsed.data.locationId);
    if (!loc || loc.locationType !== 'Fridge') {
      return NextResponse.json({ error: 'Selected storage location must be a Fridge.' }, { status: 400 });
    }
    const log = {
      logId: randomUUID(),
      locationId: loc.locationId,
      temperatureC: parsed.data.temperatureC,
      recordedAt: nowIso,
      recordedBy: userId,
    };
    store.fridgeTemperatureLogs.unshift(log);
    persistStore(store);
    return NextResponse.json({ ok: true, log }, { status: 201 });
  }

  // 2. Create new stock batch + initial Stock in movement
  if (body.operation === 'new_batch') {
    if (!can(role, 'stock.receive_return')) {
      return NextResponse.json({ error: 'You do not have permission to receive stock.' }, { status: 403 });
    }
    const parsed = createStockBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid batch fields' }, { status: 400 });
    }
    const dup = store.inventoryItems.some(
      (i) => i.medicineId === parsed.data.medicineId && i.batchNumber === parsed.data.batchNumber
    );
    if (dup) {
      return NextResponse.json({ error: 'A batch with this medicine and batch number already exists.' }, { status: 409 });
    }

    const stockId = randomUUID();
    const item = {
      stockId,
      medicineId: parsed.data.medicineId,
      batchNumber: parsed.data.batchNumber,
      supplierId: parsed.data.supplierId,
      locationId: parsed.data.locationId,
      purchaseDate: parsed.data.purchaseDate,
      unitCost: parsed.data.unitCost,
      expiryDate: parsed.data.expiryDate,
      reorderLevel: parsed.data.reorderLevel,
    };
    const moveId = randomUUID();
    store.inventoryItems.push(item);
    store.stockMovements.push({
      movementId: moveId,
      stockId,
      movementType: 'Stock in',
      quantityChange: parsed.data.initialQuantity,
      reason: `Batch ${parsed.data.batchNumber} received`,
      doseEventId: null,
      approvalStatus: 'Not required',
      performedBy: userId,
      approvedBy: null,
      createdAt: nowIso,
    });
    appendAuditLog(store, {
      userId,
      action: 'INSERT',
      tableName: 'stock_movements',
      recordId: moveId,
      newValues: { batch: item.batchNumber, movement_type: 'Stock in', quantity_change: parsed.data.initialQuantity },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, item }, { status: 201 });
  }

  // 3. Record stock movement (Stock in / Return immediate; Adjustment / Disposal / Damage proposed as Pending by Caretakers)
  if (body.operation === 'movement') {
    const parsed = stockMovementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid stock movement' }, { status: 400 });
    }
    const { stockId, movementType, quantityChange, reason } = parsed.data;
    const item = store.inventoryItems.find((i) => i.stockId === stockId);
    if (!item) return NextResponse.json({ error: 'Inventory batch not found' }, { status: 404 });

    const needsApproval =
      movementType === 'Adjustment' || movementType === 'Disposal' || movementType === 'Damage';

    if (needsApproval && !can(role, 'stock.propose_adjustment') && !can(role, 'stock.approve_adjustment')) {
      return NextResponse.json({ error: 'Not permitted to propose stock adjustments.' }, { status: 403 });
    }
    if (!needsApproval && !can(role, 'stock.receive_return')) {
      return NextResponse.json({ error: 'Not permitted to record stock receipts or returns.' }, { status: 403 });
    }

    const currentQty = computeStockQuantity(stockId, store.stockMovements);
    if (!needsApproval && currentQty + quantityChange < 0) {
      return NextResponse.json({ error: 'Stock quantity cannot go negative.' }, { status: 400 });
    }

    const moveId = randomUUID();
    const movement = {
      movementId: moveId,
      stockId,
      movementType,
      quantityChange,
      reason,
      doseEventId: null,
      // Adjustments, disposals, and damage write-offs ALWAYS start Pending and require a DIFFERENT Admin to approve
      approvalStatus: (needsApproval ? 'Pending' : 'Not required') as 'Pending' | 'Not required',
      performedBy: userId,
      approvedBy: null,
      createdAt: nowIso,
    };
    store.stockMovements.push(movement);
    appendAuditLog(store, {
      userId,
      action: 'INSERT',
      tableName: 'stock_movements',
      recordId: moveId,
      newValues: {
        stock_id: stockId,
        movement_type: movementType,
        quantity_change: quantityChange,
        approval_status: movement.approvalStatus,
      },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, movement }, { status: 201 });
  }

  // 4. Create Purchase Order (Admin only)
  if (body.operation === 'create_po') {
    if (!can(role, 'po.manage')) {
      return NextResponse.json({ error: 'Only Administrators can create purchase orders.' }, { status: 403 });
    }
    const { supplierId, medicineId, quantity, unitCost } = body;
    if (!supplierId || !medicineId || Number(quantity) <= 0) {
      return NextResponse.json({ error: 'Select supplier, medicine, and positive quantity.' }, { status: 400 });
    }
    const po = {
      poId: randomUUID(),
      supplierId,
      status: 'Awaiting approval' as const,
      createdBy: userId,
      approvedBy: null,
      createdAt: nowIso,
      approvedAt: null,
      lines: [
        {
          lineId: randomUUID(),
          medicineId,
          quantity: Number(quantity),
          unitCost: Number(unitCost || 0),
        },
      ],
    };
    store.purchaseOrders.unshift(po);
    persistStore(store);
    return NextResponse.json({ ok: true, purchaseOrder: po }, { status: 201 });
  }

  return NextResponse.json({ error: 'Unknown inventory operation' }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiAuth('stock.approve_adjustment');
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const store = loadStore();
  const userId = auth.ctx.user.userId;
  const nowIso = new Date().toISOString();

  if (body.operation === 'review_movement') {
    const movement = store.stockMovements.find((m) => m.movementId === body.movementId);
    if (!movement) return NextResponse.json({ error: 'Stock movement not found' }, { status: 404 });

    const check = canApproveStockMovement(movement, userId);
    if (!check.allowed) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }

    const decision = body.decision === 'approve' ? 'Approved' : 'Rejected';
    if (decision === 'Approved') {
      const currentQty = computeStockQuantity(movement.stockId, store.stockMovements);
      if (currentQty + movement.quantityChange < 0) {
        return NextResponse.json(
          { error: 'Approving this movement would cause negative stock quantity.' },
          { status: 409 }
        );
      }
    }

    movement.approvalStatus = decision;
    movement.approvedBy = userId;
    appendAuditLog(store, {
      userId,
      action: 'UPDATE',
      tableName: 'stock_movements',
      recordId: movement.movementId,
      oldValues: { approval_status: 'Pending' },
      newValues: { approval_status: decision, approved_by: userId },
    });
    persistStore(store);
    return NextResponse.json({ ok: true, movement });
  }

  if (body.operation === 'approve_po') {
    const po = store.purchaseOrders.find((p) => p.poId === body.poId);
    if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    if (po.createdBy === userId) {
      return NextResponse.json({ error: 'You cannot approve your own purchase order.' }, { status: 403 });
    }
    po.status = body.decision === 'cancel' ? 'Cancelled' : 'Approved';
    po.approvedBy = userId;
    po.approvedAt = nowIso;
    persistStore(store);
    return NextResponse.json({ ok: true, purchaseOrder: po });
  }

  return NextResponse.json({ error: 'Unknown review operation' }, { status: 400 });
}
