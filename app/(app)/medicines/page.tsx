'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Lock, Pill, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Card, Input, Label, Select, Skeleton } from '@/components/ui/primitives';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiFetch } from '@/lib/api-client';
import type { MedicineForm, StockUnit } from '@/lib/types';

interface MedicineItem {
  medicineId: string;
  name: string;
  genericName: string;
  form: MedicineForm;
  strength: string;
  stockUnit: StockUnit;
  manufacturer: string;
  category: string;
  foodInstruction: string | null;
  storageCondition: string | null;
  isControlled: boolean;
  status: string;
  approvalStatus: string;
  proposedBy: string;
  proposedByName: string;
  approvedByName: string | null;
}

export default function MedicinesPage() {
  const { user, csrfToken } = useAuth();
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: '',
    genericName: '',
    form: 'Tablet' as MedicineForm,
    strength: '',
    stockUnit: 'tablet' as StockUnit,
    manufacturer: '',
    category: '',
    foodInstruction: '',
    storageCondition: 'Room temperature',
    isControlled: false,
  });

  const canPropose = user?.role === 'Doctor' || user?.role === 'Admin';
  const isAdmin = user?.role === 'Admin';

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/medicines', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setMedicines(d.medicines || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = medicines.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.genericName.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    );
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { ok, data } = await apiFetch('/api/medicines', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify(form),
      });
      if (!ok) {
        toast.error(data.error || 'Failed to save medicine.');
        return;
      }
      toast.success(
        isAdmin
          ? 'Medicine added and approved in facility catalogue.'
          : 'Medicine proposed for Admin approval.'
      );
      setShowAdd(false);
      setForm({
        name: '',
        genericName: '',
        form: 'Tablet',
        strength: '',
        stockUnit: 'tablet',
        manufacturer: '',
        category: '',
        foodInstruction: '',
        storageCondition: 'Room temperature',
        isControlled: false,
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleReview(medicineId: string, action: 'approve' | 'reject' | 'discontinue' | 'reactivate') {
    setBusy(true);
    try {
      const { ok, data } = await apiFetch('/api/medicines', {
        method: 'PATCH',
        csrfToken,
        body: JSON.stringify({ medicineId, action }),
      });
      if (!ok) {
        toast.error(data.error || 'Action failed.');
        return;
      }
      toast.success(`Medicine updated (${action}).`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--cm-text)]">
            Medicine Catalogue
          </h1>
          <p className="text-[15px] text-[var(--cm-muted)] mt-0.5">
            Master list of approved facility medicines with locked stock units and controlled-substance flags.
          </p>
        </div>
        {canPropose && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            {isAdmin ? 'Add Medicine' : 'Propose Medicine'}
          </Button>
        )}
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="h-4 w-4 text-[var(--cm-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by brand name, generic name, or therapeutic category..."
            className="pl-10"
          />
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-24" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Pill className="h-8 w-8 text-[var(--cm-muted)] mx-auto mb-2" />
          <p className="text-[16px] font-semibold">No matching medicines found</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((med) => (
            <Card key={med.medicineId}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[17px] font-semibold text-[var(--cm-text)]">
                      {med.name} <span className="text-[var(--cm-muted)] font-normal">({med.strength})</span>
                    </h2>
                    <StatusBadge
                      tone={
                        med.approvalStatus === 'Approved'
                          ? 'success'
                          : med.approvalStatus === 'Pending'
                            ? 'warning'
                            : 'danger'
                      }
                      label={med.approvalStatus}
                    />
                    {med.status === 'Discontinued' && <StatusBadge tone="neutral" label="Discontinued" />}
                    {med.isControlled && (
                      <StatusBadge tone="warning" label="Controlled Drug" icon={Lock} />
                    )}
                  </div>
                  <p className="text-[14px] text-[var(--cm-muted)]">
                    Generic: <strong className="text-[var(--cm-text)]">{med.genericName}</strong> · {med.form} · Unit:{' '}
                    <code className="font-mono text-[var(--cm-text)]">{med.stockUnit}</code> · {med.category}
                  </p>
                  <p className="text-[13px] text-[var(--cm-muted)]">
                    {med.manufacturer}
                    {med.foodInstruction ? ` · Food: ${med.foodInstruction}` : ''}
                    {med.storageCondition ? ` · Storage: ${med.storageCondition}` : ''}
                  </p>
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {med.approvalStatus === 'Pending' && (
                      <>
                        <Button
                          size="sm"
                          disabled={busy || med.proposedBy === user?.userId}
                          onClick={() => void handleReview(med.medicineId, 'approve')}
                        >
                          <Check className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={busy || med.proposedBy === user?.userId}
                          onClick={() => void handleReview(med.medicineId, 'reject')}
                        >
                          <X className="h-4 w-4" />
                          Reject
                        </Button>
                      </>
                    )}
                    {med.approvalStatus === 'Approved' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void handleReview(
                            med.medicineId,
                            med.status === 'Active' ? 'discontinue' : 'reactivate'
                          )
                        }
                      >
                        {med.status === 'Active' ? 'Discontinue' : 'Reactivate'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent
          title={isAdmin ? 'Add Medicine to Catalogue' : 'Propose New Medicine'}
          description="Stock unit locks the dosing unit across all prescriptions and inventory deductions."
        >
          <form onSubmit={handleCreate} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="medName">Brand / Display Name</Label>
                <Input id="medName" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="genName">Generic Name</Label>
                <Input id="genName" required value={form.genericName} onChange={(e) => setForm({ ...form, genericName: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="medForm">Form</Label>
                <Select
                  id="medForm"
                  value={form.form}
                  onChange={(e) => setForm({ ...form, form: e.target.value as MedicineForm })}
                >
                  {['Tablet', 'Syrup', 'Injection', 'Capsule', 'Cream', 'Inhaler'].map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="strength">Strength</Label>
                <Input id="strength" required placeholder="500 mg" value={form.strength} onChange={(e) => setForm({ ...form, strength: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="stockUnit">Stock Unit</Label>
                <Select
                  id="stockUnit"
                  value={form.stockUnit}
                  onChange={(e) => setForm({ ...form, stockUnit: e.target.value as StockUnit })}
                >
                  {['tablet', 'capsule', 'ml', 'vial', 'sachet', 'tube', 'inhaler'].map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input id="manufacturer" required value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Input id="category" required placeholder="Cardiology" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="food">Food Instruction</Label>
                <Input id="food" placeholder="After breakfast" value={form.foodInstruction} onChange={(e) => setForm({ ...form, foodInstruction: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="storage">Storage Condition</Label>
                <Input id="storage" value={form.storageCondition} onChange={(e) => setForm({ ...form, storageCondition: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={form.isControlled}
                onChange={(e) => setForm({ ...form, isControlled: e.target.checked })}
                className="h-5 w-5 accent-[var(--cm-primary)]"
              />
              <span className="text-[14px] font-medium">Controlled substance (requires locked drug box)</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving...' : isAdmin ? 'Add & Approve' : 'Submit Proposal'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
