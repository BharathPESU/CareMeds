'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Lock,
  PauseCircle,
  Printer,
  RotateCcw,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Card, Input, Label, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { DoseStatusBadge, StatusBadge } from '@/components/ui/status-badge';
import { apiFetch } from '@/lib/api-client';
import { formatDateTime } from '@/lib/time';

interface RoundItem {
  doseEventId: string;
  scheduledAt: string;
  status: string;
  administeredAt: string | null;
  reason: string | null;
  overdue: boolean;
  canUndo: boolean;
  residentId: string;
  residentName: string;
  residentBloodGroup: string;
  roomLabel: string;
  allergies: { label: string; severity: string; reaction: string }[];
  allergyStatus: string;
  medicineName: string;
  medicineGeneric: string;
  medicineStrength: string;
  foodInstruction: string | null;
  isControlled: boolean;
  doseAmount: number;
  doseUnit: string;
  route: string;
  specialInstructions: string | null;
  confirmedByName: string | null;
  availableStock: number;
  nextBatchNumber: string | null;
  nextBatchExpiry: string | null;
}

export default function RoundsPage() {
  const { csrfToken } = useAuth();
  const [rounds, setRounds] = useState<RoundItem[]>([]);
  const [canAdminister, setCanAdminister] = useState(false);
  const [undoWindowMinutes, setUndoWindowMinutes] = useState(5);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Taken confirmation (Identity & Allergy Check modal)
  const [takenTarget, setTakenTarget] = useState<RoundItem | null>(null);
  const [identityChecked, setIdentityChecked] = useState(false);

  // Refused / Missed / Held modal
  const [exceptionTarget, setExceptionTarget] = useState<{
    item: RoundItem;
    action: 'Refused' | 'Missed' | 'Held';
  } | null>(null);
  const [exceptionReason, setExceptionReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/rounds', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setRounds(data.rounds || []);
        setCanAdminister(Boolean(data.canAdminister));
        setUndoWindowMinutes(Number(data.undoWindowMinutes || 5));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return rounds.filter((r) => {
      if (statusFilter === 'OVERDUE' && !(r.overdue && r.status === 'Pending')) return false;
      if (statusFilter !== 'ALL' && statusFilter !== 'OVERDUE' && r.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.residentName.toLowerCase().includes(q) ||
          r.medicineName.toLowerCase().includes(q) ||
          r.roomLabel.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rounds, search, statusFilter]);

  async function handleUndo(doseEventId: string) {
    setBusy(true);
    try {
      const { ok, data } = await apiFetch('/api/rounds', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify({ doseEventId, action: 'Undo' }),
      });
      if (!ok) {
        toast.error(data.error || 'Could not undo dose status.');
        return;
      }
      toast.success('Dose reverted to Pending and stock restored.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmTaken() {
    if (!takenTarget || !identityChecked) return;
    setBusy(true);
    try {
      const targetId = takenTarget.doseEventId;
      const { ok, data } = await apiFetch<{ batchUsed?: string }>('/api/rounds', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify({
          doseEventId: targetId,
          action: 'Taken',
          identityVerified: true,
        }),
      });
      if (!ok) {
        toast.error(data.error || 'Could not record Taken.');
        return;
      }
      setTakenTarget(null);
      setIdentityChecked(false);
      await load();
      toast.success(
        `Dose marked Taken${data.batchUsed ? ` · FEFO Batch ${data.batchUsed}` : ''}`,
        {
          description: `You can undo this confirmation within ${undoWindowMinutes} minutes.`,
          action: {
            label: 'Undo',
            onClick: () => {
              void handleUndo(targetId);
            },
          },
        }
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmException(e: React.FormEvent) {
    e.preventDefault();
    if (!exceptionTarget) return;
    setBusy(true);
    try {
      const targetId = exceptionTarget.item.doseEventId;
      const action = exceptionTarget.action;
      const { ok, data } = await apiFetch('/api/rounds', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify({
          doseEventId: targetId,
          action,
          reason: exceptionReason.trim(),
        }),
      });
      if (!ok) {
        toast.error(data.error || `Could not mark dose ${action}.`);
        return;
      }
      setExceptionTarget(null);
      setExceptionReason('');
      await load();
      toast.success(`Dose recorded as ${action}`, {
        action: {
          label: 'Undo',
          onClick: () => {
            void handleUndo(targetId);
          },
        },
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--cm-text)]">
            Today’s Medication Rounds
          </h1>
          <p className="text-[15px] text-[var(--cm-muted)] mt-0.5">
            {canAdminister
              ? 'Verify resident identity & allergies before confirming each dose. Stock deducts automatically via FEFO.'
              : 'Read-only oversight of scheduled medication rounds.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print">
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print Round Sheet
          </Button>
          <a href="/api/exports/pdf?dataset=rounds" download>
            <Button variant="secondary">
              <Download className="h-4 w-4" />
              PDF Sheet
            </Button>
          </a>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="h-4 w-4 text-[var(--cm-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search resident name, room, or medicine..."
              className="pl-10"
              aria-label="Search medication rounds"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by dose status"
          >
            <option value="ALL">All statuses ({rounds.length})</option>
            <option value="Pending">Pending</option>
            <option value="OVERDUE">Overdue only</option>
            <option value="Taken">Taken</option>
            <option value="Refused">Refused</option>
            <option value="Missed">Missed</option>
            <option value="Held">Held</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-32" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Clock className="h-8 w-8 text-[var(--cm-muted)] mx-auto mb-2" />
          <h2 className="text-[18px] font-semibold">No matching medication rounds</h2>
          <p className="text-[14px] text-[var(--cm-muted)] mt-1">
            Adjust your filter or search query to see other scheduled doses.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const hasSevere = item.allergies.some((a) => a.severity === 'Severe');
            return (
              <Card
                key={item.doseEventId}
                className={
                  item.overdue && item.status === 'Pending'
                    ? 'border-[var(--cm-danger)]/50 bg-[var(--cm-danger-bg)]/20'
                    : undefined
                }
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[14px] font-semibold tabular-nums text-[var(--cm-text)] bg-[var(--cm-surface-subtle)] px-2.5 py-1 rounded-[8px]">
                        {formatDateTime(item.scheduledAt)}
                      </span>
                      <DoseStatusBadge status={item.status} overdue={item.overdue} />
                      {item.isControlled && (
                        <StatusBadge tone="warning" label="Controlled" icon={Lock} />
                      )}
                      {hasSevere && (
                        <StatusBadge tone="danger" label="Severe Allergy" icon={ShieldAlert} />
                      )}
                    </div>

                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <Link
                        href={`/residents/${item.residentId}`}
                        className="text-[18px] font-semibold text-[var(--cm-text)] hover:text-[var(--cm-primary)]"
                      >
                        {item.residentName}
                      </Link>
                      <span className="text-[14px] text-[var(--cm-muted)]">{item.roomLabel}</span>
                    </div>

                    <p className="text-[15px] text-[var(--cm-text)]">
                      <strong>{item.medicineName}</strong> ({item.medicineStrength}) —{' '}
                      <span className="tabular-nums font-semibold">
                        {item.doseAmount} {item.doseUnit}
                      </span>{' '}
                      · {item.route}
                    </p>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--cm-muted)]">
                      {item.foodInstruction && <span>Food: {item.foodInstruction}</span>}
                      {item.specialInstructions && <span>Note: {item.specialInstructions}</span>}
                      <span className="tabular-nums">
                        Non-expired stock: <strong>{item.availableStock}</strong> {item.doseUnit}
                        {item.nextBatchNumber ? ` (FEFO: ${item.nextBatchNumber})` : ''}
                      </span>
                    </div>

                    {item.reason && (
                      <p className="text-[13px] text-[var(--cm-warning)] font-medium">
                        Recorded reason: {item.reason}
                      </p>
                    )}
                    {item.confirmedByName && (
                      <p className="text-[13px] text-[var(--cm-muted)]">
                        Confirmed by {item.confirmedByName}
                        {item.administeredAt ? ` at ${formatDateTime(item.administeredAt)}` : ''}
                      </p>
                    )}
                  </div>

                  {/* Caretaker action controls */}
                  {canAdminister && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
                      {item.status === 'Pending' ? (
                        <>
                          <Button
                            onClick={() => {
                              setTakenTarget(item);
                              setIdentityChecked(false);
                            }}
                            disabled={busy}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Give &amp; Confirm
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setExceptionTarget({ item, action: 'Refused' });
                              setExceptionReason('');
                            }}
                            disabled={busy}
                          >
                            <XCircle className="h-4 w-4" />
                            Refused
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setExceptionTarget({ item, action: 'Held' });
                              setExceptionReason('');
                            }}
                            disabled={busy}
                          >
                            <PauseCircle className="h-4 w-4" />
                            Held
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => {
                              setExceptionTarget({ item, action: 'Missed' });
                              setExceptionReason('');
                            }}
                            disabled={busy}
                          >
                            <AlertTriangle className="h-4 w-4" />
                            Missed
                          </Button>
                        </>
                      ) : item.canUndo ? (
                        <Button
                          variant="secondary"
                          onClick={() => void handleUndo(item.doseEventId)}
                          disabled={busy}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Undo ({undoWindowMinutes}m window)
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Identity & Allergy Confirmation Dialog */}
      <Dialog open={Boolean(takenTarget)} onOpenChange={(o) => !o && setTakenTarget(null)}>
        <DialogContent
          title="Identity & Allergy Safety Check"
          description="Confirm the resident’s details and known allergies before recording this dose as Taken."
        >
          {takenTarget && (
            <div className="space-y-4">
              <div className="rounded-[16px] bg-[var(--cm-surface-subtle)] p-4 space-y-1.5">
                <p className="text-[18px] font-bold text-[var(--cm-text)]">{takenTarget.residentName}</p>
                <p className="text-[14px] text-[var(--cm-muted)]">
                  {takenTarget.roomLabel} · Blood Group:{' '}
                  <strong className="text-[var(--cm-text)]">{takenTarget.residentBloodGroup}</strong>
                </p>
                <p className="text-[15px] font-semibold text-[var(--cm-primary)] pt-1">
                  {takenTarget.medicineName} ({takenTarget.medicineStrength}) — {takenTarget.doseAmount}{' '}
                  {takenTarget.doseUnit} ({takenTarget.route})
                </p>
                {takenTarget.nextBatchNumber && (
                  <p className="text-[13px] text-[var(--cm-muted)]">
                    FEFO deduction batch: <code className="font-mono">{takenTarget.nextBatchNumber}</code> (exp {takenTarget.nextBatchExpiry})
                  </p>
                )}
              </div>

              <div className="rounded-[16px] border border-[var(--cm-danger)]/35 bg-[var(--cm-danger-bg)]/45 p-4 space-y-2">
                <p className="text-[14px] font-semibold text-[var(--cm-danger)] flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  Recorded Allergies ({takenTarget.allergyStatus})
                </p>
                {takenTarget.allergies.length === 0 ? (
                  <p className="text-[14px] text-[var(--cm-text)]">No recorded drug or substance allergies.</p>
                ) : (
                  <ul className="space-y-1 text-[14px]">
                    {takenTarget.allergies.map((a, idx) => (
                      <li key={idx} className="text-[var(--cm-text)]">
                        <strong>{a.label}</strong> ({a.severity}) — {a.reaction}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <label className="flex items-start gap-3 rounded-[14px] border border-[var(--cm-border)] p-3.5 cursor-pointer min-h-[48px]">
                <input
                  type="checkbox"
                  checked={identityChecked}
                  onChange={(e) => setIdentityChecked(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-[var(--cm-primary)]"
                />
                <span className="text-[14px] font-medium text-[var(--cm-text)]">
                  I have verified {takenTarget.residentName}’s identity, room/bed, allergies, and right dose before administration.
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setTakenTarget(null)}>
                  Cancel
                </Button>
                <Button disabled={!identityChecked || busy} onClick={() => void handleConfirmTaken()}>
                  <CheckCircle2 className="h-4 w-4" />
                  {busy ? 'Recording...' : 'Confirm Dose Taken'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refused / Missed / Held Reason Dialog */}
      <Dialog open={Boolean(exceptionTarget)} onOpenChange={(o) => !o && setExceptionTarget(null)}>
        <DialogContent
          title={exceptionTarget ? `Mark Dose as ${exceptionTarget.action}` : 'Record Exception'}
          description="A clear clinical or care reason is required whenever a dose is not taken."
        >
          {exceptionTarget && (
            <form onSubmit={handleConfirmException} className="space-y-4">
              <div className="rounded-[14px] bg-[var(--cm-surface-subtle)] p-3.5 text-[14px]">
                <strong>{exceptionTarget.item.residentName}</strong> · {exceptionTarget.item.medicineName} (
                {exceptionTarget.item.doseAmount} {exceptionTarget.item.doseUnit})
              </div>
              <div>
                <Label htmlFor="exceptionReason">Reason ({exceptionTarget.action})</Label>
                <Textarea
                  id="exceptionReason"
                  required
                  minLength={3}
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  placeholder="Describe why the dose was refused, held, or missed..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setExceptionTarget(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={exceptionTarget.action === 'Missed' ? 'danger' : 'primary'}
                  disabled={busy}
                >
                  {busy ? 'Saving...' : `Confirm ${exceptionTarget.action}`}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
