'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Phone, Plus, ShieldAlert, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Card, Input, Label, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiFetch } from '@/lib/api-client';
import { formatDateTime } from '@/lib/time';

interface EmergencyProfile {
  residentId: string;
  fullName: string;
  age: number;
  bloodGroup: string;
  roomLabel: string;
  allergyStatus: string;
  allergies: { label: string; severity: string; reaction: string }[];
  conditions: string[];
  doctor: { fullName: string; phone: string | null } | null;
  contacts: { contactId: string; fullName: string; relationship: string; phone: string; isPrimary: boolean }[];
}

interface IncidentItem {
  incidentId: string;
  residentId: string;
  residentName: string;
  reportedByName: string;
  occurredAt: string;
  description: string;
  status: 'Open' | 'Closed';
  entries: {
    entryId: string;
    loggedByName: string;
    actionTime: string;
    actionTaken: string;
    outcome: string;
  }[];
}

export default function EmergencyPage() {
  const { csrfToken } = useAuth();
  const [profiles, setProfiles] = useState<EmergencyProfile[]>([]);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [showNewIncident, setShowNewIncident] = useState(false);
  const [incidentDesc, setIncidentDesc] = useState('');

  const [entryTarget, setEntryTarget] = useState<IncidentItem | null>(null);
  const [actionTaken, setActionTaken] = useState('');
  const [outcome, setOutcome] = useState('');
  const [closeIncident, setCloseIncident] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/emergency', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setProfiles(d.residentProfiles || []);
        setIncidents(d.incidents || []);
        setCanManage(Boolean(d.canManage));
        if (d.residentProfiles?.[0] && !selectedId) {
          setSelectedId(d.residentProfiles[0].residentId);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeProfile = profiles.find((p) => p.residentId === selectedId) || profiles[0] || null;

  async function handleTriggerIncident(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProfile) return;
    setBusy(true);
    try {
      const { ok, data } = await apiFetch('/api/emergency', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify({ residentId: activeProfile.residentId, description: incidentDesc }),
      });
      if (!ok) {
        toast.error(data.error || 'Could not log incident.');
        return;
      }
      toast.success('Emergency incident logged and family/doctor notifications queued.');
      setShowNewIncident(false);
      setIncidentDesc('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!entryTarget) return;
    setBusy(true);
    try {
      const { ok, data } = await apiFetch('/api/emergency', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify({
          operation: 'add_entry',
          incidentId: entryTarget.incidentId,
          actionTaken,
          outcome,
          closeIncident,
        }),
      });
      if (!ok) {
        toast.error(data.error || 'Could not append log entry.');
        return;
      }
      toast.success(closeIncident ? 'Action logged and incident closed.' : 'Action logged to incident timeline.');
      setEntryTarget(null);
      setActionTaken('');
      setOutcome('');
      setCloseIncident(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[20px] border border-[var(--cm-danger)]/40 bg-[var(--cm-danger-bg)]/50 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-[14px] bg-[var(--cm-danger)] text-white flex items-center justify-center shrink-0">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-[24px] font-bold text-[var(--cm-danger)]">Emergency Response Hub</h1>
            <p className="text-[14px] text-[var(--cm-text)] mt-0.5">
              Instant access to allergies, blood group, active conditions, and click-to-call doctor and family contacts.
            </p>
          </div>
        </div>
        {canManage && activeProfile && (
          <Button variant="danger" size="lg" onClick={() => setShowNewIncident(true)}>
            <Plus className="h-5 w-5" />
            Trigger Emergency Log
          </Button>
        )}
      </div>

      {/* Resident Quick Selector & Critical Card */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Label htmlFor="emResident" className="mb-0 text-[16px] font-semibold">
            Select Resident
          </Label>
          <Select
            id="emResident"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="sm:max-w-sm"
          >
            {profiles.map((p) => (
              <option key={p.residentId} value={p.residentId}>
                {p.fullName} — {p.roomLabel}
              </option>
            ))}
          </Select>
        </div>

        {activeProfile && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
            <div className="rounded-[16px] bg-[var(--cm-surface-subtle)] p-4 space-y-3">
              <div>
                <h2 className="text-[22px] font-bold">{activeProfile.fullName}</h2>
                <p className="text-[15px] text-[var(--cm-muted)] tabular-nums">
                  {activeProfile.age} yrs · {activeProfile.roomLabel} · Blood Group{' '}
                  <strong className="text-[var(--cm-danger)] text-[17px]">{activeProfile.bloodGroup}</strong>
                </p>
              </div>
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--cm-danger)] mb-1">
                  Allergies ({activeProfile.allergyStatus})
                </p>
                {activeProfile.allergies.length === 0 ? (
                  <p className="text-[14px]">No recorded allergies.</p>
                ) : (
                  <ul className="space-y-1 text-[14px]">
                    {activeProfile.allergies.map((a, i) => (
                      <li key={i}>
                        <strong>{a.label}</strong> ({a.severity}) — {a.reaction}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--cm-muted)] mb-1">
                  Active Conditions
                </p>
                <p className="text-[14px]">
                  {activeProfile.conditions.length > 0
                    ? activeProfile.conditions.join(' · ')
                    : 'No active diagnoses listed.'}
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-[14px] font-semibold uppercase tracking-wide text-[var(--cm-muted)]">
                Direct Click-to-Call Contacts
              </p>
              {activeProfile.doctor && (
                <div className="rounded-[14px] border border-[var(--cm-primary)]/40 bg-[var(--cm-surface)] p-3.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-semibold inline-flex items-center gap-1.5">
                      <Stethoscope className="h-4 w-4 text-[var(--cm-primary)]" />
                      {activeProfile.doctor.fullName}
                    </p>
                    <p className="text-[13px] text-[var(--cm-muted)]">Assigned Facility Doctor</p>
                  </div>
                  {activeProfile.doctor.phone && (
                    <a href={`tel:${activeProfile.doctor.phone}`}>
                      <Button size="sm">
                        <Phone className="h-4 w-4" />
                        Call {activeProfile.doctor.phone}
                      </Button>
                    </a>
                  )}
                </div>
              )}
              {activeProfile.contacts.map((c) => (
                <div
                  key={c.contactId}
                  className="rounded-[14px] border border-[var(--cm-border)] bg-[var(--cm-surface)] p-3.5 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-[15px] font-semibold">
                      {c.fullName}{' '}
                      <span className="text-[13px] font-normal text-[var(--cm-muted)]">({c.relationship})</span>
                    </p>
                    {c.isPrimary && <p className="text-[12px] text-[var(--cm-primary)] font-medium">Primary Family Contact</p>}
                  </div>
                  <a href={`tel:${c.phone}`}>
                    <Button variant="secondary" size="sm">
                      <Phone className="h-4 w-4" />
                      {c.phone}
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Emergency Incidents & Append-Only Action Logs */}
      <Card className="space-y-4">
        <h2 className="text-[20px] font-semibold">Emergency Incident Timeline</h2>
        {incidents.length === 0 ? (
          <p className="text-[14px] text-[var(--cm-muted)]">No emergency incidents recorded.</p>
        ) : (
          <div className="space-y-4">
            {incidents.map((inc) => (
              <div key={inc.incidentId} className="rounded-[16px] border border-[var(--cm-border)] p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[17px] font-semibold">{inc.residentName}</h3>
                      <StatusBadge
                        tone={inc.status === 'Open' ? 'danger' : 'success'}
                        label={inc.status}
                      />
                    </div>
                    <p className="text-[14px] text-[var(--cm-text)] mt-1">{inc.description}</p>
                    <p className="text-[13px] text-[var(--cm-muted)] tabular-nums mt-0.5">
                      Reported {formatDateTime(inc.occurredAt)} by {inc.reportedByName}
                    </p>
                  </div>
                  {canManage && inc.status === 'Open' && (
                    <Button size="sm" variant="secondary" onClick={() => setEntryTarget(inc)}>
                      <Plus className="h-4 w-4" />
                      Log Action
                    </Button>
                  )}
                </div>

                {inc.entries.length > 0 && (
                  <div className="pl-3 border-l-2 border-[var(--cm-primary)]/40 space-y-2">
                    {inc.entries.map((entry) => (
                      <div key={entry.entryId} className="text-[14px]">
                        <p className="font-medium text-[var(--cm-text)]">{entry.actionTaken}</p>
                        <p className="text-[13px] text-[var(--cm-muted)]">
                          Outcome: {entry.outcome} · {entry.loggedByName} ({formatDateTime(entry.actionTime)})
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Trigger New Incident Dialog */}
      <Dialog open={showNewIncident} onOpenChange={setShowNewIncident}>
        <DialogContent
          title={`Log Emergency — ${activeProfile?.fullName || ''}`}
          description="Logs the incident immediately and queues notifications for opted-in family contacts and the assigned doctor."
        >
          <form onSubmit={handleTriggerIncident} className="space-y-4">
            <div>
              <Label htmlFor="incDesc">What happened?</Label>
              <Textarea
                id="incDesc"
                required
                minLength={5}
                value={incidentDesc}
                onChange={(e) => setIncidentDesc(e.target.value)}
                placeholder="Describe symptoms, fall, or urgent clinical observation..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowNewIncident(false)}>Cancel</Button>
              <Button type="submit" variant="danger" disabled={busy}>Confirm Emergency Log</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Append Action Entry Dialog */}
      <Dialog open={Boolean(entryTarget)} onOpenChange={(o) => !o && setEntryTarget(null)}>
        <DialogContent title="Append Emergency Action Entry" description="Entries are timestamped and preserved permanently.">
          <form onSubmit={handleAddEntry} className="space-y-3.5">
            <div>
              <Label htmlFor="actTaken">Action Taken</Label>
              <Input id="actTaken" required minLength={3} value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} placeholder="e.g., Called assigned doctor and checked SpO2" />
            </div>
            <div>
              <Label htmlFor="actOutcome">Outcome</Label>
              <Input id="actOutcome" required minLength={2} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g., Resident stable; doctor visiting at 16:00" />
            </div>
            <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={closeIncident}
                onChange={(e) => setCloseIncident(e.target.checked)}
                className="h-5 w-5 accent-[var(--cm-primary)]"
              />
              <span className="text-[14px] font-medium">Mark this emergency incident Closed</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEntryTarget(null)}>Cancel</Button>
              <Button type="submit" disabled={busy}>Append Entry</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
