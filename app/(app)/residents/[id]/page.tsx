'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Archive,
  ArrowLeft,
  BedDouble,
  FileUp,
  Phone,
  Plus,
  ShieldAlert,
  Stethoscope,
  UserCheck,
  UserMinus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Card, Input, Label, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { DoseStatusBadge, StatusBadge } from '@/components/ui/status-badge';
import { apiFetch } from '@/lib/api-client';
import { formatDate, formatDateTime } from '@/lib/time';

type TabKey = 'overview' | 'medicines' | 'doses' | 'vitals' | 'notes';

interface ResidentDetailResponse {
  resident: {
    residentId: string;
    fullName: string;
    age: number;
    dateOfBirth: string;
    gender: string;
    bloodGroup: string;
    admissionDate: string;
    dietNotes: string | null;
    status: string;
    archiveReason: string | null;
    allergyStatus: string;
    roomCode: string | null;
    wingOrFloor: string | null;
    bedCode: string | null;
    assignedDoctorId: string | null;
    doctorName: string | null;
    doctorPhone: string | null;
  };
  contacts: { contactId: string; fullName: string; relationship: string; phone: string; isPrimary: boolean }[];
  diagnoses: { diagnosisId: string; description: string; diagnosedOn: string; isActive: boolean }[];
  history: { historyId: string; type: string; description: string; eventDate: string }[];
  allergies: {
    allergyId: string;
    medicineName: string | null;
    substanceText: string | null;
    reaction: string;
    severity: string;
  }[];
  prescriptions: {
    prescriptionId: string;
    medicineName: string;
    medicineStrength: string;
    reasonDiagnosis: string;
    startDate: string;
    endDate: string | null;
    status: string;
    prescribedByName: string;
    allergyOverrideReason: string | null;
    schedules: { scheduleId: string; doseAmount: number; doseUnit: string; frequency: string; route: string }[];
  }[];
  doses: {
    doseEventId: string;
    medicineName: string;
    doseLabel: string;
    scheduledAt: string;
    status: string;
    confirmedByName: string | null;
    reason: string | null;
  }[];
  vitals: {
    readingId: string;
    recordedAt: string;
    recordedByName: string;
    bpSystolic: number | null;
    bpDiastolic: number | null;
    bloodSugar: number | null;
    bloodSugarUnit: string;
    temperatureC: number | null;
    pulseBpm: number | null;
    spo2Percent: number | null;
    weightKg: number | null;
    notes: string | null;
  }[];
  notes: { noteId: string; noteType: string; body: string; authorName: string; createdAt: string }[];
  handovers: { noteId: string; windowName: string; shiftDate: string; body: string; authorName: string; createdAt: string }[];
  documents: { documentId: string; documentType: string; fileName: string; uploadedByName: string; uploadedAt: string }[];
  assignments: {
    assignmentId: string;
    caretakerId: string;
    caretakerName: string;
    assignedByName: string;
    assignedAt: string;
    endedAt: string | null;
  }[];
  activeCaretakersList: { userId: string; fullName: string }[];
  doseWindows: { windowId: string; name: string }[];
  medicines: { medicineId: string; name: string; strength: string }[];
}

export default function ResidentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, csrfToken } = useAuth();
  const [data, setData] = useState<ResidentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('overview');

  const [showAllergyModal, setShowAllergyModal] = useState(false);
  const [allergyForm, setAllergyForm] = useState({
    medicineId: '',
    substanceText: '',
    reaction: '',
    severity: 'Moderate',
  });

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');

  const [selectedCaretakerId, setSelectedCaretakerId] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteType, setNoteType] = useState<'General' | 'Doctor visit'>('General');
  const [handoverBody, setHandoverBody] = useState('');
  const [handoverWindowId, setHandoverWindowId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/residents/${params.id}`, { cache: 'no-store' });
      if (!res.ok) {
        toast.error('Resident not accessible or not found.');
        router.push('/residents');
        return;
      }
      const d = (await res.json()) as ResidentDetailResponse;
      setData(d);
      if (d.doseWindows[0] && !handoverWindowId) {
        setHandoverWindowId(d.doseWindows[0].windowId);
      }
    } finally {
      setLoading(false);
    }
  }, [handoverWindowId, params.id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-36" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const { resident } = data;
  const canManageAssignments = user?.role === 'Admin' || user?.role === 'Doctor';

  async function patchResident(payload: Record<string, unknown>, successMsg: string) {
    setBusy(true);
    try {
      const { ok, data: resp } = await apiFetch(`/api/residents/${resident.residentId}`, {
        method: 'PATCH',
        csrfToken,
        body: JSON.stringify(payload),
      });
      if (!ok) {
        toast.error(resp.error || 'Operation failed.');
        return false;
      }
      toast.success(successMsg);
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function handleDocumentSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const { ok, data: resp } = await apiFetch('/api/uploads/signed-url', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify({
          residentId: resident.residentId,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          documentType: 'Lab result',
        }),
      });
      if (!ok) {
        toast.error(resp.error || 'Could not register document upload.');
        return;
      }
      toast.success(`Document "${file.name}" validated and registered in resident chart.`);
      await load();
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/residents"
          className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--cm-muted)] hover:text-[var(--cm-text)] min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Residents
        </Link>

        {user?.role === 'Admin' && resident.status === 'Active' && (
          <Button variant="danger" size="sm" onClick={() => setShowArchiveModal(true)}>
            <Archive className="h-4 w-4" />
            Archive Resident
          </Button>
        )}
      </div>

      {/* Header Card */}
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[26px] font-bold text-[var(--cm-text)]">{resident.fullName}</h1>
              <StatusBadge
                tone={resident.status === 'Active' ? 'success' : 'neutral'}
                label={resident.status}
              />
            </div>
            <p className="text-[15px] text-[var(--cm-muted)] tabular-nums">
              {resident.age} yrs (DOB {formatDate(resident.dateOfBirth)}) · {resident.gender} · Blood Group{' '}
              <strong className="text-[var(--cm-text)]">{resident.bloodGroup}</strong> · Admitted{' '}
              {formatDate(resident.admissionDate)}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-[14px] text-[var(--cm-muted)] pt-1">
              <span className="inline-flex items-center gap-1.5">
                <BedDouble className="h-4 w-4 text-[var(--cm-primary)]" />
                {resident.roomCode
                  ? `Room ${resident.roomCode} · Bed ${resident.bedCode} (${resident.wingOrFloor})`
                  : 'Bed unassigned'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Stethoscope className="h-4 w-4 text-[var(--cm-primary)]" />
                {resident.doctorName || 'No assigned doctor'}
                {resident.doctorPhone && (
                  <a href={`tel:${resident.doctorPhone}`} className="text-[var(--cm-primary)] underline ml-1">
                    {resident.doctorPhone}
                  </a>
                )}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowAllergyModal(true)}>
              <Plus className="h-4 w-4" />
              Record Allergy
            </Button>
          </div>
        </div>

        {/* Prominent Allergy Banner */}
        <div className="mt-4 rounded-[14px] border border-[var(--cm-danger)]/35 bg-[var(--cm-danger-bg)]/45 p-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
            <span className="text-[14px] font-semibold text-[var(--cm-danger)] inline-flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" />
              Allergies ({resident.allergyStatus})
            </span>
          </div>
          {data.allergies.length === 0 ? (
            <p className="text-[14px] text-[var(--cm-text)]">No recorded drug or food allergies.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.allergies.map((a) => (
                <div
                  key={a.allergyId}
                  className="inline-flex items-center gap-2 rounded-[12px] bg-[var(--cm-surface)] border border-[var(--cm-border)] px-3 py-1.5 text-[14px]"
                >
                  <StatusBadge
                    tone={a.severity === 'Severe' ? 'danger' : 'warning'}
                    label={a.severity}
                  />
                  <span className="font-semibold">{a.medicineName || a.substanceText}</span>
                  <span className="text-[var(--cm-muted)]">— {a.reaction}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[var(--cm-border)] pb-2" role="tablist">
        {(
          [
            ['overview', 'Overview'],
            ['medicines', `Medicines (${data.prescriptions.length})`],
            ['doses', `Doses (${data.doses.length})`],
            ['vitals', `Vitals (${data.vitals.length})`],
            ['notes', `Notes & Handover (${data.notes.length + data.handovers.length})`],
          ] as [TabKey, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`min-h-[44px] px-4 rounded-[12px] text-[15px] font-medium transition-colors ${
              tab === key
                ? 'bg-[var(--cm-primary)] text-[var(--cm-primary-foreground)]'
                : 'text-[var(--cm-muted)] hover:bg-[var(--cm-surface-subtle)] hover:text-[var(--cm-text)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="space-y-4">
            <h2 className="text-[18px] font-semibold">Emergency Family Contacts</h2>
            {data.contacts.length === 0 ? (
              <p className="text-[14px] text-[var(--cm-muted)]">No emergency contacts recorded.</p>
            ) : (
              <div className="space-y-2.5">
                {data.contacts.map((c) => (
                  <div
                    key={c.contactId}
                    className="rounded-[12px] bg-[var(--cm-surface-subtle)] p-3.5 flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-[15px] font-semibold">
                        {c.fullName}{' '}
                        <span className="text-[13px] font-normal text-[var(--cm-muted)]">
                          ({c.relationship})
                        </span>
                      </p>
                      {c.isPrimary && (
                        <span className="text-[12px] text-[var(--cm-primary)] font-medium">Primary contact</span>
                      )}
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
            )}

            <div className="pt-2 border-t border-[var(--cm-border)]">
              <h3 className="text-[16px] font-semibold mb-1.5">Diet &amp; Daily Care Notes</h3>
              <p className="text-[14px] text-[var(--cm-muted)]">
                {resident.dietNotes || 'No special diet notes recorded.'}
              </p>
            </div>

            <div className="pt-2 border-t border-[var(--cm-border)]">
              <h3 className="text-[16px] font-semibold mb-2">Active Diagnoses</h3>
              {data.diagnoses.length === 0 ? (
                <p className="text-[14px] text-[var(--cm-muted)]">No diagnoses listed.</p>
              ) : (
                <ul className="space-y-1.5 text-[14px]">
                  {data.diagnoses.map((dx) => (
                    <li key={dx.diagnosisId} className="flex justify-between gap-2">
                      <span>{dx.description}</span>
                      <span className="text-[var(--cm-muted)] tabular-nums">{formatDate(dx.diagnosedOn)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-semibold">Caretaker Assignments &amp; History</h2>
            </div>

            {canManageAssignments && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Select
                  value={selectedCaretakerId}
                  onChange={(e) => setSelectedCaretakerId(e.target.value)}
                  aria-label="Select caretaker to assign"
                >
                  <option value="">Select caretaker to assign...</option>
                  {data.activeCaretakersList.map((ct) => (
                    <option key={ct.userId} value={ct.userId}>
                      {ct.fullName}
                    </option>
                  ))}
                </Select>
                <Button
                  disabled={!selectedCaretakerId || busy}
                  onClick={() =>
                    void patchResident(
                      { operation: 'assign_caretaker', caretakerId: selectedCaretakerId },
                      'Caretaker assigned.'
                    ).then((ok) => ok && setSelectedCaretakerId(''))
                  }
                >
                  <UserCheck className="h-4 w-4" />
                  Assign
                </Button>
              </div>
            )}

            <div className="space-y-2">
              {data.assignments.map((a) => (
                <div
                  key={a.assignmentId}
                  className="rounded-[12px] border border-[var(--cm-border)] p-3 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-[15px] font-semibold">{a.caretakerName}</p>
                    <p className="text-[13px] text-[var(--cm-muted)]">
                      Assigned {formatDate(a.assignedAt)} by {a.assignedByName}
                      {a.endedAt ? ` · Ended ${formatDate(a.endedAt)}` : ' · Active'}
                    </p>
                  </div>
                  {a.endedAt === null && canManageAssignments ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void patchResident(
                          { operation: 'end_assignment', assignmentId: a.assignmentId },
                          'Assignment ended and preserved in history.'
                        )
                      }
                    >
                      <UserMinus className="h-4 w-4" />
                      End
                    </Button>
                  ) : (
                    <StatusBadge
                      tone={a.endedAt ? 'neutral' : 'success'}
                      label={a.endedAt ? 'Ended' : 'Active'}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Medical Documents Upload (Doctor only) */}
            <div className="pt-3 border-t border-[var(--cm-border)] space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-semibold">Clinical Documents</h3>
                {user?.role === 'Doctor' && (
                  <label className="inline-flex items-center gap-1.5 rounded-[12px] border border-[var(--cm-border)] px-3 py-2 text-[14px] font-medium cursor-pointer hover:bg-[var(--cm-surface-subtle)] min-h-[44px]">
                    <FileUp className="h-4 w-4" />
                    Upload PDF / Image
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      className="sr-only"
                      onChange={handleDocumentSelect}
                    />
                  </label>
                )}
              </div>
              {data.documents.length === 0 ? (
                <p className="text-[14px] text-[var(--cm-muted)]">No lab results or visit letters uploaded yet.</p>
              ) : (
                <ul className="space-y-1.5 text-[14px]">
                  {data.documents.map((doc) => (
                    <li key={doc.documentId} className="flex justify-between gap-2 rounded-[10px] bg-[var(--cm-surface-subtle)] px-3 py-2">
                      <span className="font-medium truncate">{doc.fileName}</span>
                      <span className="text-[12px] text-[var(--cm-muted)] shrink-0">{doc.documentType}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === 'medicines' && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-semibold">Prescriptions &amp; Dosage Schedules</h2>
            {user?.role === 'Doctor' && (
              <Link href="/prescriptions">
                <Button size="sm">Open Prescriptions</Button>
              </Link>
            )}
          </div>
          {data.prescriptions.length === 0 ? (
            <p className="text-[14px] text-[var(--cm-muted)]">No prescriptions recorded for this resident.</p>
          ) : (
            <div className="space-y-3">
              {data.prescriptions.map((rx) => (
                <div key={rx.prescriptionId} className="rounded-[14px] border border-[var(--cm-border)] p-4 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[16px] font-semibold">
                      {rx.medicineName} ({rx.medicineStrength})
                    </p>
                    <StatusBadge
                      tone={rx.status === 'Active' ? 'success' : rx.status === 'On hold' ? 'warning' : 'neutral'}
                      label={rx.status}
                    />
                  </div>
                  <p className="text-[14px] text-[var(--cm-muted)]">
                    Diagnosis: {rx.reasonDiagnosis} · Prescribed by {rx.prescribedByName}
                  </p>
                  <p className="text-[13px] text-[var(--cm-muted)] tabular-nums">
                    From {formatDate(rx.startDate)} {rx.endDate ? `to ${formatDate(rx.endDate)}` : '(Ongoing)'}
                  </p>
                  {rx.schedules.map((s) => (
                    <p key={s.scheduleId} className="text-[14px] font-medium text-[var(--cm-text)]">
                      Schedule: {s.doseAmount} {s.doseUnit} · {s.route} · {s.frequency}
                    </p>
                  ))}
                  {rx.allergyOverrideReason && (
                    <p className="text-[13px] text-[var(--cm-warning)] font-medium">
                      Allergy override documented: {rx.allergyOverrideReason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'doses' && (
        <Card className="space-y-3">
          <h2 className="text-[18px] font-semibold">Dose History</h2>
          {data.doses.length === 0 ? (
            <p className="text-[14px] text-[var(--cm-muted)]">No dose events recorded.</p>
          ) : (
            <div className="divide-y divide-[var(--cm-border)]">
              {data.doses.map((d) => (
                <div key={d.doseEventId} className="py-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-semibold">
                      {d.medicineName} — {d.doseLabel}
                    </p>
                    <p className="text-[13px] text-[var(--cm-muted)] tabular-nums">
                      Scheduled {formatDateTime(d.scheduledAt)}
                      {d.confirmedByName ? ` · Confirmed by ${d.confirmedByName}` : ''}
                      {d.reason ? ` · Reason: ${d.reason}` : ''}
                    </p>
                  </div>
                  <DoseStatusBadge status={d.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'vitals' && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-semibold">Recent Vitals</h2>
            <Link href="/vitals">
              <Button variant="secondary" size="sm">Open Vitals Module</Button>
            </Link>
          </div>
          {data.vitals.length === 0 ? (
            <p className="text-[14px] text-[var(--cm-muted)]">No vital readings recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[14px] tabular-nums">
                <thead>
                  <tr className="border-b border-[var(--cm-border)] text-[var(--cm-muted)]">
                    <th className="py-2 pr-3">Recorded</th>
                    <th className="py-2 pr-3">BP</th>
                    <th className="py-2 pr-3">Sugar</th>
                    <th className="py-2 pr-3">Temp</th>
                    <th className="py-2 pr-3">Pulse</th>
                    <th className="py-2 pr-3">SpO2</th>
                    <th className="py-2">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--cm-border)]">
                  {data.vitals.map((v) => (
                    <tr key={v.readingId}>
                      <td className="py-2.5 pr-3">{formatDateTime(v.recordedAt)}</td>
                      <td className="py-2.5 pr-3">
                        {v.bpSystolic && v.bpDiastolic ? `${v.bpSystolic}/${v.bpDiastolic}` : '—'}
                      </td>
                      <td className="py-2.5 pr-3">
                        {v.bloodSugar != null ? `${v.bloodSugar} ${v.bloodSugarUnit}` : '—'}
                      </td>
                      <td className="py-2.5 pr-3">{v.temperatureC != null ? `${v.temperatureC}°C` : '—'}</td>
                      <td className="py-2.5 pr-3">{v.pulseBpm != null ? `${v.pulseBpm} bpm` : '—'}</td>
                      <td className="py-2.5 pr-3">{v.spo2Percent != null ? `${v.spo2Percent}%` : '—'}</td>
                      <td className="py-2.5">{v.recordedByName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="space-y-4">
            <h2 className="text-[18px] font-semibold">Clinical &amp; General Notes</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void patchResident(
                  { operation: 'add_note', noteType, body: noteBody },
                  'Note added.'
                ).then((ok) => ok && setNoteBody(''));
              }}
              className="space-y-3"
            >
              {user?.role === 'Doctor' && (
                <Select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value as 'General' | 'Doctor visit')}
                >
                  <option value="Doctor visit">Doctor visit note</option>
                  <option value="General">General note</option>
                </Select>
              )}
              <Textarea
                required
                minLength={3}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Write a clinical observation or care note..."
              />
              <Button type="submit" size="sm" disabled={busy}>
                Save Note
              </Button>
            </form>
            <div className="space-y-2.5">
              {data.notes.map((n) => (
                <div key={n.noteId} className="rounded-[12px] bg-[var(--cm-surface-subtle)] p-3.5">
                  <div className="flex items-center justify-between text-[13px] text-[var(--cm-muted)] mb-1">
                    <span className="font-semibold text-[var(--cm-text)]">
                      {n.authorName} · {n.noteType}
                    </span>
                    <span className="tabular-nums">{formatDateTime(n.createdAt)}</span>
                  </div>
                  <p className="text-[14px]">{n.body}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-[18px] font-semibold">Shift Handover Notes</h2>
            {user?.role === 'Caretaker' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void patchResident(
                    { operation: 'add_handover', windowId: handoverWindowId, body: handoverBody },
                    'Shift handover note recorded.'
                  ).then((ok) => ok && setHandoverBody(''));
                }}
                className="space-y-3"
              >
                <Select
                  value={handoverWindowId}
                  onChange={(e) => setHandoverWindowId(e.target.value)}
                >
                  {data.doseWindows.map((w) => (
                    <option key={w.windowId} value={w.windowId}>
                      {w.name} shift
                    </option>
                  ))}
                </Select>
                <Textarea
                  required
                  minLength={3}
                  value={handoverBody}
                  onChange={(e) => setHandoverBody(e.target.value)}
                  placeholder="Share essential handover notes for the incoming caretaker..."
                />
                <Button type="submit" size="sm" disabled={busy}>
                  Post Handover Note
                </Button>
              </form>
            )}
            <div className="space-y-2.5">
              {data.handovers.map((h) => (
                <div key={h.noteId} className="rounded-[12px] bg-[var(--cm-surface-subtle)] p-3.5">
                  <div className="flex items-center justify-between text-[13px] text-[var(--cm-muted)] mb-1">
                    <span className="font-semibold text-[var(--cm-text)]">
                      {h.windowName} ({h.shiftDate}) · {h.authorName}
                    </span>
                    <span className="tabular-nums">{formatDateTime(h.createdAt)}</span>
                  </div>
                  <p className="text-[14px]">{h.body}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Add Allergy Modal */}
      <Dialog open={showAllergyModal} onOpenChange={setShowAllergyModal}>
        <DialogContent title="Record Resident Allergy" description="Severe allergies automatically block matching prescriptions.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void patchResident(
                {
                  operation: 'add_allergy',
                  medicineId: allergyForm.medicineId || null,
                  substanceText: allergyForm.substanceText || null,
                  reaction: allergyForm.reaction,
                  severity: allergyForm.severity,
                },
                'Allergy recorded.'
              ).then((ok) => {
                if (ok) {
                  setShowAllergyModal(false);
                  setAllergyForm({ medicineId: '', substanceText: '', reaction: '', severity: 'Moderate' });
                }
              });
            }}
            className="space-y-3.5"
          >
            <div>
              <Label htmlFor="allergyMed">Medicine (optional)</Label>
              <Select
                id="allergyMed"
                value={allergyForm.medicineId}
                onChange={(e) => setAllergyForm({ ...allergyForm, medicineId: e.target.value })}
              >
                <option value="">Non-medicine substance (enter below)</option>
                {data.medicines.map((m) => (
                  <option key={m.medicineId} value={m.medicineId}>
                    {m.name} ({m.strength})
                  </option>
                ))}
              </Select>
            </div>
            {!allergyForm.medicineId && (
              <div>
                <Label htmlFor="substanceText">Substance / Food Allergen</Label>
                <Input
                  id="substanceText"
                  required={!allergyForm.medicineId}
                  value={allergyForm.substanceText}
                  onChange={(e) => setAllergyForm({ ...allergyForm, substanceText: e.target.value })}
                  placeholder="e.g., Peanuts, Latex, Sulfa drugs"
                />
              </div>
            )}
            <div>
              <Label htmlFor="severity">Severity</Label>
              <Select
                id="severity"
                value={allergyForm.severity}
                onChange={(e) => setAllergyForm({ ...allergyForm, severity: e.target.value })}
              >
                <option value="Mild">Mild</option>
                <option value="Moderate">Moderate</option>
                <option value="Severe">Severe (Hard block on prescription)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="reaction">Reaction Details</Label>
              <Input
                id="reaction"
                required
                value={allergyForm.reaction}
                onChange={(e) => setAllergyForm({ ...allergyForm, reaction: e.target.value })}
                placeholder="e.g., Rash, swelling, anaphylaxis"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowAllergyModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Save Allergy
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Archive Resident Modal */}
      <Dialog open={showArchiveModal} onOpenChange={setShowArchiveModal}>
        <DialogContent
          title="Archive Resident Record"
          description="Archiving stops all active prescriptions, cancels future pending doses, notifies the assigned doctor, and keeps full clinical history."
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void patchResident(
                { operation: 'archive', reason: archiveReason },
                'Resident archived cleanly.'
              ).then((ok) => {
                if (ok) {
                  setShowArchiveModal(false);
                  setArchiveReason('');
                }
              });
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="archiveReason">Mandatory Archive Reason</Label>
              <Textarea
                id="archiveReason"
                required
                minLength={5}
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="e.g., Discharged to family care on physician clearance..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowArchiveModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={busy}>
                Confirm Archive
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
