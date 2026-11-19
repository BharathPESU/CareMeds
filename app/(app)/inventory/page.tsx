'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Lock,
  Package,
  Plus,
  ShoppingCart,
  Thermometer,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Card, Input, Label, Select, Skeleton } from '@/components/ui/primitives';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiFetch } from '@/lib/api-client';
import { formatDate, formatDateTime } from '@/lib/time';

interface InventoryBatch {
  stockId: string;
  medicineId: string;
  medicineName: string;
  medicineStrength: string;
  stockUnit: string;
  isControlled: boolean;
  batchNumber: string;
  locationName: string;
  locationType: string;
  supplierName: string;
  expiryDate: string;
  reorderLevel: number;
  quantityOnHand: number;
  daysToExpiry: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
  isLowStock: boolean;
}

interface StockMovementItem {
  movementId: string;
  stockId: string;
  batchNumber: string;
  medicineName: string;
  stockUnit: string;
  movementType: string;
  quantityChange: number;
  reason: string | null;
  approvalStatus: string;
  performedBy: string;
  performedByName: string;
  approvedByName: string | null;
  createdAt: string;
}

interface InventoryResponse {
  items: InventoryBatch[];
  movements: StockMovementItem[];
  pendingMovements: StockMovementItem[];
  storageLocations: { locationId: string; name: string; locationType: string }[];
  fridgeLogs: { logId: string; locationName: string; temperatureC: number; recordedAt: string; recordedByName: string }[];
  suppliers: { supplierId: string; name: string }[];
  purchaseOrders: {
    poId: string;
    supplierName: string;
    status: string;
    createdBy: string;
    createdByName: string;
    createdAt: string;
    lines: { lineId: string; medicineName: string; quantity: number; unitCost: number }[];
  }[];
  medicines: { medicineId: string; name: string; strength: string; stockUnit: string }[];
}

export default function InventoryPage() {
  const { user, csrfToken } = useAuth();
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'stock' | 'approvals' | 'fridge' | 'po'>('stock');
  const [busy, setBusy] = useState(false);

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchForm, setBatchForm] = useState({
    medicineId: '',
    batchNumber: '',
    supplierId: '',
    locationId: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    unitCost: '4.50',
    expiryDate: '',
    reorderLevel: '20',
    initialQuantity: '60',
  });

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveForm, setMoveForm] = useState({
    stockId: '',
    movementType: 'Adjustment',
    quantityChange: '-5',
    reason: '',
  });

  const [fridgeForm, setFridgeForm] = useState({ locationId: '', temperatureC: '4.2' });
  const [poForm, setPoForm] = useState({ supplierId: '', medicineId: '', quantity: '100', unitCost: '4.00' });

  const isAdmin = user?.role === 'Admin';
  const canEditStock = user?.role === 'Admin' || user?.role === 'Caretaker';

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory', { cache: 'no-store' });
      if (res.ok) {
        const d = (await res.json()) as InventoryResponse;
        setData(d);
        const firstFridge = d.storageLocations.find((l) => l.locationType === 'Fridge');
        if (firstFridge && !fridgeForm.locationId) {
          setFridgeForm((prev) => ({ ...prev, locationId: firstFridge.locationId }));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [fridgeForm.locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleNewBatch(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { ok, data: resp } = await apiFetch('/api/inventory', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify({
          operation: 'new_batch',
          ...batchForm,
          unitCost: Number(batchForm.unitCost),
          reorderLevel: Number(batchForm.reorderLevel),
          initialQuantity: Number(batchForm.initialQuantity),
        }),
      });
      if (!ok) {
        toast.error(resp.error || 'Could not receive stock batch.');
        return;
      }
      toast.success('New stock batch received.');
      setShowBatchModal(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleMovement(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { ok, data: resp } = await apiFetch('/api/inventory', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify({
          operation: 'movement',
          stockId: moveForm.stockId,
          movementType: moveForm.movementType,
          quantityChange: Number(moveForm.quantityChange),
          reason: moveForm.reason,
        }),
      });
      if (!ok) {
        toast.error(resp.error || 'Could not record stock movement.');
        return;
      }
      toast.success(
        ['Adjustment', 'Disposal', 'Damage'].includes(moveForm.movementType)
          ? 'Movement submitted for Administrator approval.'
          : 'Stock movement recorded.'
      );
      setShowMoveModal(false);
      setMoveForm({ stockId: '', movementType: 'Adjustment', quantityChange: '-5', reason: '' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleReviewMovement(movementId: string, decision: 'approve' | 'reject') {
    setBusy(true);
    try {
      const { ok, data: resp } = await apiFetch('/api/inventory', {
        method: 'PATCH',
        csrfToken,
        body: JSON.stringify({ operation: 'review_movement', movementId, decision }),
      });
      if (!ok) {
        toast.error(resp.error || 'Review failed.');
        return;
      }
      toast.success(`Stock movement ${decision === 'approve' ? 'approved' : 'rejected'}.`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleFridgeLog(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { ok, data: resp } = await apiFetch('/api/inventory', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify({
          operation: 'fridge_temp',
          locationId: fridgeForm.locationId,
          temperatureC: Number(fridgeForm.temperatureC),
        }),
      });
      if (!ok) {
        toast.error(resp.error || 'Could not log temperature.');
        return;
      }
      toast.success('Fridge temperature recorded.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePo(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { ok, data: resp } = await apiFetch('/api/inventory', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify({
          operation: 'create_po',
          ...poForm,
          quantity: Number(poForm.quantity),
          unitCost: Number(poForm.unitCost),
        }),
      });
      if (!ok) {
        toast.error(resp.error || 'Could not create purchase order.');
        return;
      }
      toast.success('Purchase order created (Awaiting approval by another Admin).');
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const fridges = data.storageLocations.filter((l) => l.locationType === 'Fridge');

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--cm-text)]">
            Medicine Inventory
          </h1>
          <p className="text-[15px] text-[var(--cm-muted)] mt-0.5">
            FEFO batch tracking with ledger-calculated stock on hand, dual-control approvals, and fridge temperature logs.
          </p>
        </div>
        {canEditStock && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setShowMoveModal(true)}>
              Record Movement
            </Button>
            <Button onClick={() => setShowBatchModal(true)}>
              <Plus className="h-4 w-4" />
              Receive Batch
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <Button variant={tab === 'stock' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('stock')}>
          <Package className="h-4 w-4" />
          Stock Batches ({data.items.length})
        </Button>
        <Button variant={tab === 'approvals' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('approvals')}>
          <AlertTriangle className="h-4 w-4" />
          Pending Approvals ({data.pendingMovements.length})
        </Button>
        <Button variant={tab === 'fridge' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('fridge')}>
          <Thermometer className="h-4 w-4" />
          Fridge Temp Log ({data.fridgeLogs.length})
        </Button>
        {isAdmin && (
          <Button variant={tab === 'po' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('po')}>
            <ShoppingCart className="h-4 w-4" />
            Purchase Orders ({data.purchaseOrders.length})
          </Button>
        )}
      </div>

      {tab === 'stock' && (
        <div className="space-y-3">
          {data.items.map((item) => (
            <Card
              key={item.stockId}
              className={item.isExpired ? 'border-[var(--cm-danger)]/50 bg-[var(--cm-danger-bg)]/20' : undefined}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[17px] font-semibold">
                      {item.medicineName} ({item.medicineStrength})
                    </h2>
                    <code className="font-mono text-[13px] bg-[var(--cm-surface-subtle)] px-2 py-0.5 rounded-[6px]">
                      Batch {item.batchNumber}
                    </code>
                    {item.isControlled && <StatusBadge tone="warning" label="Controlled" icon={Lock} />}
                    {item.isExpired && <StatusBadge tone="danger" label="Expired — Blocked" />}
                    {item.isExpiringSoon && (
                      <StatusBadge tone="warning" label={`Expires in ${item.daysToExpiry}d`} />
                    )}
                    {item.isLowStock && <StatusBadge tone="danger" label="Low Stock" />}
                  </div>
                  <p className="text-[14px] text-[var(--cm-muted)]">
                    Location: {item.locationName} ({item.locationType}) · Supplier: {item.supplierName}
                  </p>
                  <p className="text-[13px] text-[var(--cm-muted)] tabular-nums">
                    Expires {formatDate(item.expiryDate)} · Reorder level: {item.reorderLevel} {item.stockUnit}
                  </p>
                </div>

                <div className="text-left lg:text-right shrink-0">
                  <p className="text-[28px] font-bold tabular-nums text-[var(--cm-text)]">
                    {item.quantityOnHand}{' '}
                    <span className="text-[15px] font-normal text-[var(--cm-muted)]">{item.stockUnit}</span>
                  </p>
                  <p className="text-[12px] text-[var(--cm-muted)]">Calculated from ledger</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'approvals' && (
        <div className="space-y-4">
          <Card className="space-y-3">
            <h2 className="text-[18px] font-semibold">Pending Disposals, Adjustments &amp; Damage Write-Offs</h2>
            <p className="text-[14px] text-[var(--cm-muted)]">
              Pending movements do not affect stock on hand until approved by an Administrator other than the person who proposed them.
            </p>
            {data.pendingMovements.length === 0 ? (
              <div className="rounded-[12px] bg-[var(--cm-surface-subtle)] p-6 text-center text-[14px] text-[var(--cm-muted)]">
                No stock movements awaiting approval.
              </div>
            ) : (
              <div className="space-y-3">
                {data.pendingMovements.map((m) => {
                  const isSelf = m.performedBy === user?.userId;
                  return (
                    <div
                      key={m.movementId}
                      className="rounded-[14px] border border-[var(--cm-border)] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone="warning" label={m.movementType} />
                          <span className="font-semibold text-[16px]">
                            {m.medicineName} (Batch {m.batchNumber})
                          </span>
                          <span className="font-mono font-bold tabular-nums">
                            {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange} {m.stockUnit}
                          </span>
                        </div>
                        <p className="text-[14px] text-[var(--cm-text)]">Reason: {m.reason}</p>
                        <p className="text-[13px] text-[var(--cm-muted)] tabular-nums">
                          Proposed by {m.performedByName} on {formatDateTime(m.createdAt)}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            disabled={busy || isSelf}
                            title={isSelf ? 'Cannot self-approve your own stock proposal' : undefined}
                            onClick={() => void handleReviewMovement(m.movementId, 'approve')}
                          >
                            <Check className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={busy || isSelf}
                            onClick={() => void handleReviewMovement(m.movementId, 'reject')}
                          >
                            <X className="h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="text-[18px] font-semibold">Recent Stock Ledger</h2>
            <div className="divide-y divide-[var(--cm-border)] text-[14px]">
              {data.movements.slice(0, 15).map((m) => (
                <div key={m.movementId} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold">{m.medicineName}</span> ({m.batchNumber}) · {m.movementType}{' '}
                    <span className="font-mono font-semibold tabular-nums">
                      {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange} {m.stockUnit}
                    </span>
                    <p className="text-[13px] text-[var(--cm-muted)]">
                      {m.performedByName} · {m.reason || 'Recorded'}
                    </p>
                  </div>
                  <StatusBadge
                    tone={
                      m.approvalStatus === 'Approved' || m.approvalStatus === 'Not required'
                        ? 'success'
                        : m.approvalStatus === 'Pending'
                          ? 'warning'
                          : 'danger'
                    }
                    label={m.approvalStatus}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'fridge' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {canEditStock && (
            <Card>
              <h2 className="text-[18px] font-semibold mb-3">Log Cold-Storage Temperature</h2>
              <form onSubmit={handleFridgeLog} className="space-y-3.5">
                <div>
                  <Label htmlFor="fridgeLoc">Fridge Unit</Label>
                  <Select
                    id="fridgeLoc"
                    required
                    value={fridgeForm.locationId}
                    onChange={(e) => setFridgeForm({ ...fridgeForm, locationId: e.target.value })}
                  >
                    {fridges.map((f) => (
                      <option key={f.locationId} value={f.locationId}>
                        {f.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="fridgeTemp">Temperature (°C — target 2.0 to 8.0°C)</Label>
                  <Input
                    id="fridgeTemp"
                    type="number"
                    step="0.1"
                    required
                    value={fridgeForm.temperatureC}
                    onChange={(e) => setFridgeForm({ ...fridgeForm, temperatureC: e.target.value })}
                  />
                </div>
                <Button type="submit" disabled={busy}>
                  <Thermometer className="h-4 w-4" />
                  Record Reading
                </Button>
              </form>
            </Card>
          )}
          <Card className="space-y-3">
            <h2 className="text-[18px] font-semibold">Recent Fridge Readings</h2>
            <div className="divide-y divide-[var(--cm-border)]">
              {data.fridgeLogs.map((l) => {
                const outOfRange = l.temperatureC < 2 || l.temperatureC > 8;
                return (
                  <div key={l.logId} className="py-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[15px] font-semibold">{l.locationName}</p>
                      <p className="text-[13px] text-[var(--cm-muted)] tabular-nums">
                        {formatDateTime(l.recordedAt)} · {l.recordedByName}
                      </p>
                    </div>
                    <StatusBadge
                      tone={outOfRange ? 'danger' : 'success'}
                      label={`${l.temperatureC.toFixed(1)}°C`}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {tab === 'po' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <h2 className="text-[18px] font-semibold mb-3">Create Purchase Order</h2>
            <form onSubmit={handleCreatePo} className="space-y-3.5">
              <div>
                <Label htmlFor="poSupplier">Supplier</Label>
                <Select
                  id="poSupplier"
                  required
                  value={poForm.supplierId}
                  onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })}
                >
                  <option value="">Select supplier...</option>
                  {data.suppliers.map((s) => (
                    <option key={s.supplierId} value={s.supplierId}>{s.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="poMed">Medicine</Label>
                <Select
                  id="poMed"
                  required
                  value={poForm.medicineId}
                  onChange={(e) => setPoForm({ ...poForm, medicineId: e.target.value })}
                >
                  <option value="">Select medicine...</option>
                  {data.medicines.map((m) => (
                    <option key={m.medicineId} value={m.medicineId}>
                      {m.name} ({m.strength})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="poQty">Quantity</Label>
                  <Input id="poQty" type="number" min="1" required value={poForm.quantity} onChange={(e) => setPoForm({ ...poForm, quantity: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="poCost">Unit Cost</Label>
                  <Input id="poCost" type="number" step="0.01" min="0" required value={poForm.unitCost} onChange={(e) => setPoForm({ ...poForm, unitCost: e.target.value })} />
                </div>
              </div>
              <Button type="submit" disabled={busy}>Submit Purchase Order</Button>
            </form>
          </Card>
          <Card className="space-y-3">
            <h2 className="text-[18px] font-semibold">Purchase Orders</h2>
            {data.purchaseOrders.length === 0 ? (
              <p className="text-[14px] text-[var(--cm-muted)]">No purchase orders created yet.</p>
            ) : (
              data.purchaseOrders.map((po) => (
                <div key={po.poId} className="rounded-[12px] border border-[var(--cm-border)] p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{po.supplierName}</span>
                    <StatusBadge tone={po.status === 'Approved' ? 'success' : 'warning'} label={po.status} />
                  </div>
                  {po.lines.map((line) => (
                    <p key={line.lineId} className="text-[14px] text-[var(--cm-muted)] tabular-nums">
                      {line.medicineName} × {line.quantity} (@ {line.unitCost})
                    </p>
                  ))}
                  <p className="text-[12px] text-[var(--cm-muted)]">Created by {po.createdByName}</p>
                </div>
              ))
            )}
          </Card>
        </div>
      )}

      {/* Receive Batch Dialog */}
      <Dialog open={showBatchModal} onOpenChange={setShowBatchModal}>
        <DialogContent title="Receive New Stock Batch" description="Creates a new batch and logs an initial Stock in ledger entry.">
          <form onSubmit={handleNewBatch} className="space-y-3.5">
            <div>
              <Label htmlFor="bMed">Medicine</Label>
              <Select id="bMed" required value={batchForm.medicineId} onChange={(e) => setBatchForm({ ...batchForm, medicineId: e.target.value })}>
                <option value="">Select medicine...</option>
                {data.medicines.map((m) => (
                  <option key={m.medicineId} value={m.medicineId}>
                    {m.name} ({m.strength}) [{m.stockUnit}]
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="bNum">Batch Number</Label>
                <Input id="bNum" required value={batchForm.batchNumber} onChange={(e) => setBatchForm({ ...batchForm, batchNumber: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="bExp">Expiry Date</Label>
                <Input id="bExp" type="date" required value={batchForm.expiryDate} onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="bSup">Supplier</Label>
                <Select id="bSup" required value={batchForm.supplierId} onChange={(e) => setBatchForm({ ...batchForm, supplierId: e.target.value })}>
                  <option value="">Select supplier...</option>
                  {data.suppliers.map((s) => (
                    <option key={s.supplierId} value={s.supplierId}>{s.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="bLoc">Storage Location</Label>
                <Select id="bLoc" required value={batchForm.locationId} onChange={(e) => setBatchForm({ ...batchForm, locationId: e.target.value })}>
                  <option value="">Select location...</option>
                  {data.storageLocations.map((l) => (
                    <option key={l.locationId} value={l.locationId}>{l.name}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="bQty">Initial Qty</Label>
                <Input id="bQty" type="number" min="1" required value={batchForm.initialQuantity} onChange={(e) => setBatchForm({ ...batchForm, initialQuantity: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="bReorder">Reorder Level</Label>
                <Input id="bReorder" type="number" min="0" required value={batchForm.reorderLevel} onChange={(e) => setBatchForm({ ...batchForm, reorderLevel: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="bCost">Unit Cost</Label>
                <Input id="bCost" type="number" step="0.01" min="0" required value={batchForm.unitCost} onChange={(e) => setBatchForm({ ...batchForm, unitCost: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowBatchModal(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>Receive Stock</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock Movement Dialog */}
      <Dialog open={showMoveModal} onOpenChange={setShowMoveModal}>
        <DialogContent
          title="Record Stock Movement"
          description="Adjustments, disposals, and damage write-offs enter Pending status until approved by another Administrator."
        >
          <form onSubmit={handleMovement} className="space-y-3.5">
            <div>
              <Label htmlFor="mBatch">Stock Batch</Label>
              <Select id="mBatch" required value={moveForm.stockId} onChange={(e) => setMoveForm({ ...moveForm, stockId: e.target.value })}>
                <option value="">Select batch...</option>
                {data.items.map((i) => (
                  <option key={i.stockId} value={i.stockId}>
                    {i.medicineName} — Batch {i.batchNumber} (On hand: {i.quantityOnHand} {i.stockUnit})
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="mType">Movement Type</Label>
                <Select id="mType" value={moveForm.movementType} onChange={(e) => setMoveForm({ ...moveForm, movementType: e.target.value })}>
                  <option value="Stock in">Stock in (+)</option>
                  <option value="Return">Return (+)</option>
                  <option value="Adjustment">Adjustment (Requires approval)</option>
                  <option value="Disposal">Disposal (Requires approval)</option>
                  <option value="Damage">Damage (Requires approval)</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="mQty">Quantity Change (negative for deduction)</Label>
                <Input id="mQty" type="number" required value={moveForm.quantityChange} onChange={(e) => setMoveForm({ ...moveForm, quantityChange: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="mReason">Reason</Label>
              <Input id="mReason" required minLength={3} value={moveForm.reason} onChange={(e) => setMoveForm({ ...moveForm, reason: e.target.value })} placeholder="e.g., Expired blister pack disposal" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowMoveModal(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>Submit Movement</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
