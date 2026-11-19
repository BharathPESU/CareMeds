'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  FileText,
  PauseCircle,
  Plus,
  RefreshCw,
  ShieldAlert,
  StopCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Card, Input, Label, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiFetch } from '@/lib/api-client';
import { formatDate } from '@/lib/time';
import type { DoseFrequency, DoseRoute, StockUnit } from '@/lib/types';

interface RxItem {
  prescriptionId: string;
  residentId: string;
  residentName: string;
  medicineName: string;
  medicineStrength: string;
  stockUnit: StockUnit;
  prescribedByName: string;
  reasonDiagnosis: string;
  specialInstructions: string | null;
  allergyOverrideReason: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  stopReason: string | null;
  daysLeft: number | null;
  needsRenewal: boolean;
  schedules: { scheduleId: string; doseAmount: number; doseUnit: string; frequency: string; route: string }[];
}

interface ResidentOption {
  residentId: string;
  fullName: string;
  allergies: { medicineId: string | null; substanceText: string | null; severity: string; reaction: string }[];
}

interface MedicineOption {
  medicineId: string;
  name: string;
  genericName: string;
  strength: string;
  stockUnit: StockUnit;
}

export default function PrescriptionsPage() {
  const { user, csrfToken } = useAuth();
  const [prescriptions, setPrescriptions] = useState<RxItem[]>([]);
  const [residents, setResidents] = useState<ResidentOption[]>([]);
  const [medicines, setMedicines] = useState<MedicineOption[]>([]);
  const [doseWindows, setDoseWindows] = useState<{ windowId: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState<'all' | 'renewals'>('all');

  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    residentId: '',
    medicineId: '',
    reasonDiagnosis: '',
    specialInstructions: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    doseAmount: '1',
    route: 'Oral' as DoseRoute,
    frequency: 'Once daily' as DoseFrequency,
    timeOfDay: '09:00',
    windowId: '',
    allergyOverrideReason: '',
  });

  const [stopModal, setStopModal] = useState<{ rx: RxItem; nextStatus: 'Stopped' | 'On hold' } | null>(null);
  const [stopReason, setStopReason] = useState('');

  const isDoctor = user?.role === 'Doctor';

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/prescriptions', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setPrescriptions(d.prescriptions || []);
        setResidents(d.residents || []);
        setMedicines(d.approvedMedicines || []);
        setDoseWindows(d.doseWindows || []);
        if (d.doseWindows?.[0] && !form.windowId) {
          setForm((prev) => ({ ...prev, windowId: d.doseWindows[0].windowId }));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [form.windowId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedMedicine = useMemo(
    () => medicines.find((m) => m.medicineId === form.medicineId) || null,
    [form.medicineId, medicines]
  );

  const selectedResident = useMemo(
    () => residents.find((r) => r.residentId === form.residentId) || null,
    [form.residentId, residents]
  );

  // Real-time client-side preview of the server-enforced Allergy Safety Rule
  const matchingAllergy = useMemo(() => {
    if (!selectedResident || !selectedMedicine) return null;
    return (
      selectedResident.allergies.find((a) => {
        if (a.medicineId && a.medicineId === selectedMedicine.medicineId) return true;
        if (a.substanceText) {
          const s = a.substanceText.toLowerCase();
          return (
            selectedMedicine.name.toLowerCase().includes(s) ||
            selectedMedicine.genericName.toLowerCase().includes(s)
          );
        }
        return false;
      }) || null
    );
  }, [selectedMedicine, selectedResident]);

  const isSevereAllergyBlocked = matchingAllergy?.severity === 'Severe';
  const needsAllergyOverride =
    matchingAllergy !== null && (matchingAllergy.severity === 'Mild' || matchingAllergy.severity === 'Moderate');

  const renewalQueue = useMemo(() => prescriptions.filter((p) => p.needsRenewal), [prescriptions]);
  const visible = viewTab === 'renewals' ? renewalQueue : prescriptions;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMedicine) return;
    setBusy(true);
    try {
      const { ok, data } = await apiFetch<{ duplicateWarning?: string | null }>('/api/prescriptions', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify({
          residentId: form.residentId,
          medicineId: form.medicineId,
          reasonDiagnosis: form.reasonDiagnosis,
          specialInstructions: form.specialInstructions || null,
          startDate: form.startDate,
          endDate: form.endDate || null,
          doseAmount: Number(form.doseAmount),
          doseUnit: selectedMedicine.stockUnit,
          route: form.route,
          frequency: form.frequency,
          isPrn: form.frequency === 'PRN',
          times: form.frequency === 'PRN' ? [] : [{ timeOfDay: form.timeOfDay, windowId: form.windowId }],
          allergyOverrideReason: form.allergyOverrideReason || null,
        }),
      });
      if (!ok) {
        toast.error(data.error || 'Could not create prescription.');
        return;
      }
      toast.success('Prescription created and next dose scheduled.');
      if (data.duplicateWarning) {
        toast.warning(data.duplicateWarning);
      }
      setShowCreate(false);
      setForm((prev) => ({
        ...prev,
        medicineId: '',
        reasonDiagnosis: '',
        specialInstructions: '',
        endDate: '',
        allergyOverrideReason: '',
      }));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleRenew(prescriptionId: string) {
    setBusy(true);
    try {
      const { ok, data } = await apiFetch('/api/prescriptions', {
        method: 'PATCH',
        csrfToken,
        body: JSON.stringify({ prescriptionId, operation: 'renew', extendDays: 30 }),
      });
      if (!ok) {
        toast.error(data.error || 'Renewal failed.');
        return;
      }
      toast.success('Prescription renewed for 30 additional days.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(e: React.FormEvent) {
    e.preventDefault();
    if (!stopModal) return;
    setBusy(true);
    try {
      const { ok, data } = await apiFetch('/api/prescriptions', {
        method: 'PATCH',
        csrfToken,
        body: JSON.stringify({
          prescriptionId: stopModal.rx.prescriptionId,
          status: stopModal.nextStatus,
          reason: stopReason,
        }),
      });
      if (!ok) {
        toast.error(data.error || 'Status update failed.');
        return;
      }
      toast.success(`Prescription marked ${stopModal.nextStatus}.`);
      setStopModal(null);
      setStopReason('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--cm-text)]">Prescriptions</h1>
          <p className="text-[15px] text-[var(--cm-muted)] mt-0.5">
            {isDoctor
              ? 'Create, hold, stop, or renew prescriptions with real-time allergy safety checks and locked dosing units.'
              : 'Read-only view of scoped resident prescriptions and renewal timelines.'}
          </p>
        </div>
        {isDoctor && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New Prescription
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant={viewTab === 'all' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setViewTab('all')}
        >
          All Prescriptions ({prescriptions.length})
        </Button>
        <Button
          variant={viewTab === 'renewals' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setViewTab('renewals')}
        >
          Renewal Queue ({renewalQueue.length})
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-28" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card className="p-10 text-center">
          <FileText className="h-8 w-8 text-[var(--cm-muted)] mx-auto mb-2" />
          <p className="text-[16px] font-semibold">No prescriptions in this view</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((rx) => (
            <Card key={rx.prescriptionId}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[18px] font-semibold text-[var(--cm-text)]">
                      {rx.residentName} — {rx.medicineName} ({rx.medicineStrength})
                    </h2>
                    <StatusBadge
                      tone={
                        rx.status === 'Active'
                          ? 'success'
                          : rx.status === 'On hold'
                            ? 'warning'
                            : 'neutral'
                      }
                      label={rx.status}
                    />
                    {rx.needsRenewal && (
                      <StatusBadge
                        tone="warning"
                        label={`Renewal in ${rx.daysLeft}d`}
                        icon={RefreshCw}
                      />
                    )}
                  </div>
                  <p className="text-[14px] text-[var(--cm-muted)]">
                    Diagnosis: <strong className="text-[var(--cm-text)]">{rx.reasonDiagnosis}</strong> · Prescribed by{' '}
                    {rx.prescribedByName}
                  </p>
                  {rx.schedules.map((s) => (
                    <p key={s.scheduleId} className="text-[14px] font-medium">
                      {s.doseAmount} {s.doseUnit} · {s.route} · {s.frequency}
                    </p>
                  ))}
                  <p className="text-[13px] text-[var(--cm-muted)] tabular-nums">
                    {formatDate(rx.startDate)} → {rx.endDate ? formatDate(rx.endDate) : 'Ongoing'}
                    {rx.specialInstructions ? ` · ${rx.specialInstructions}` : ''}
                  </p>
                  {rx.allergyOverrideReason && (
                    <p className="text-[13px] text-[var(--cm-warning)] font-medium">
                      Mild/Moderate allergy override: {rx.allergyOverrideReason}
                    </p>
                  )}
                  {rx.stopReason && (
                    <p className="text-[13px] text-[var(--cm-muted)]">Reason: {rx.stopReason}</p>
                  )}
                </div>

                {isDoctor && rx.status === 'Active' && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {rx.endDate && (
                      <Button variant="secondary" size="sm" disabled={busy} onClick={() => void handleRenew(rx.prescriptionId)}>
                        <RefreshCw className="h-4 w-4" />
                        Renew +30d
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setStopModal({ rx, nextStatus: 'On hold' });
                        setStopReason('');
                      }}
                    >
                      <PauseCircle className="h-4 w-4" />
                      Hold
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setStopModal({ rx, nextStatus: 'Stopped' });
                        setStopReason('');
                      }}
                    >
                      <StopCircle className="h-4 w-4" />
                      Stop
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* New Prescription Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent
          title="New Resident Prescription"
          description="Only Approved catalogue medicines can be prescribed. Dose unit locks automatically to stock unit."
          className="max-w-xl"
        >
          <form onSubmit={handleCreate} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="rxResident">Resident</Label>
                <Select
                  id="rxResident"
                  required
                  value={form.residentId}
                  onChange={(e) => setForm({ ...form, residentId: e.target.value })}
                >
                  <option value="">Select resident...</option>
                  {residents.map((r) => (
                    <option key={r.residentId} value={r.residentId}>
                      {r.fullName}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="rxMedicine">Approved Medicine</Label>
                <Select
                  id="rxMedicine"
                  required
                  value={form.medicineId}
                  onChange={(e) => setForm({ ...form, medicineId: e.target.value })}
                >
                  <option value="">Select medicine...</option>
                  {medicines.map((m) => (
                    <option key={m.medicineId} value={m.medicineId}>
                      {m.name} ({m.strength}) [{m.stockUnit}]
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {isSevereAllergyBlocked && matchingAllergy && (
              <div
                role="alert"
                className="rounded-[14px] border border-[var(--cm-danger)] bg-[var(--cm-danger-bg)] text-[var(--cm-danger)] p-4 flex items-start gap-2.5"
              >
                <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-[14px]">
                  <p className="font-bold">Prescription Blocked — Severe Allergy Detected</p>
                  <p className="mt-0.5">
                    {selectedResident?.fullName} has a recorded <strong>Severe</strong> allergy matching{' '}
                    {selectedMedicine?.name} (Reaction: {matchingAllergy.reaction}). Prescribing is blocked unless the allergy is formally downgraded with clinical justification.
                  </p>
                </div>
              </div>
            )}

            {needsAllergyOverride && matchingAllergy && (
              <div className="rounded-[14px] border border-[var(--cm-warning)] bg-[var(--cm-warning-bg)] text-[var(--cm-warning)] p-4 space-y-2.5">
                <div className="flex items-start gap-2 text-[14px]">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">
                      {matchingAllergy.severity} Allergy Warning — Clinical Override Required
                    </p>
                    <p>Reaction: {matchingAllergy.reaction}. Enter a clinical override reason to proceed.</p>
                  </div>
                </div>
                <Input
                  required
                  minLength={5}
                  value={form.allergyOverrideReason}
                  onChange={(e) => setForm({ ...form, allergyOverrideReason: e.target.value })}
                  placeholder="Document clinical justification for overriding this allergy..."
                  className="bg-[var(--cm-surface)] text-[var(--cm-text)]"
                />
              </div>
            )}

            <div>
              <Label htmlFor="rxDiagnosis">Diagnosis / Clinical Reason</Label>
              <Input
                id="rxDiagnosis"
                required
                value={form.reasonDiagnosis}
                onChange={(e) => setForm({ ...form, reasonDiagnosis: e.target.value })}
                placeholder="e.g., Stage 2 hypertension maintenance"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="doseAmount">Dose Amount</Label>
                <Input
                  id="doseAmount"
                  type="number"
                  step="0.5"
                  min="0.5"
                  required
                  value={form.doseAmount}
                  onChange={(e) => setForm({ ...form, doseAmount: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="doseUnitLocked">Dose Unit (Locked)</Label>
                <Input
                  id="doseUnitLocked"
                  readOnly
                  disabled
                  value={selectedMedicine ? selectedMedicine.stockUnit : 'Select medicine'}
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="rxRoute">Route</Label>
                <Select
                  id="rxRoute"
                  value={form.route}
                  onChange={(e) => setForm({ ...form, route: e.target.value as DoseRoute })}
                >
                  {['Oral', 'Injection', 'Topical', 'Inhaled'].map((rt) => (
                    <option key={rt} value={rt}>{rt}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="rxFreq">Frequency</Label>
                <Select
                  id="rxFreq"
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value as DoseFrequency })}
                >
                  {['Once daily', 'Twice daily', 'Weekly', 'Every X hours', 'PRN'].map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="rxWindow">Dose Window</Label>
                <Select
                  id="rxWindow"
                  value={form.windowId}
                  disabled={form.frequency === 'PRN'}
                  onChange={(e) => setForm({ ...form, windowId: e.target.value })}
                >
                  {doseWindows.map((w) => (
                    <option key={w.windowId} value={w.windowId}>{w.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="rxTime">Scheduled Time</Label>
                <Input
                  id="rxTime"
                  type="time"
                  disabled={form.frequency === 'PRN'}
                  value={form.timeOfDay}
                  onChange={(e) => setForm({ ...form, timeOfDay: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date (optional)</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="specialInstructions">Special Administration Instructions</Label>
              <Textarea
                id="specialInstructions"
                value={form.specialInstructions}
                onChange={(e) => setForm({ ...form, specialInstructions: e.target.value })}
                placeholder="e.g., Give with warm water after breakfast"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || isSevereAllergyBlocked}>
                {busy ? 'Creating...' : 'Create Prescription'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Hold / Stop Reason Modal */}
      <Dialog open={Boolean(stopModal)} onOpenChange={(o) => !o && setStopModal(null)}>
        <DialogContent
          title={stopModal ? `Mark Prescription ${stopModal.nextStatus}` : 'Update Prescription'}
          description="Provide a clinical reason for the audit log."
        >
          <form onSubmit={handleStatusChange} className="space-y-4">
            <div>
              <Label htmlFor="stopReason">Clinical Reason</Label>
              <Textarea
                id="stopReason"
                required
                minLength={3}
                value={stopReason}
                onChange={(e) => setStopReason(e.target.value)}
                placeholder="Document clinical reason..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setStopModal(null)}>
                Cancel
              </Button>
              <Button type="submit" variant={stopModal?.nextStatus === 'Stopped' ? 'danger' : 'primary'} disabled={busy}>
                Confirm
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
