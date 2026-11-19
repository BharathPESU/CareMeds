'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BedDouble, Plus, Search, ShieldAlert, Stethoscope, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Card, Input, Label, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiFetch } from '@/lib/api-client';

interface ResidentListItem {
  residentId: string;
  fullName: string;
  age: number;
  gender: string;
  bloodGroup: string;
  status: string;
  allergyStatus: string;
  allergiesCount: number;
  hasSevereAllergy: boolean;
  roomCode: string | null;
  wingOrFloor: string | null;
  bedCode: string | null;
  doctorName: string | null;
  activeCaretakers: { userId: string; fullName: string }[];
  activeRxCount: number;
}

export default function ResidentsPage() {
  const { user, csrfToken } = useAuth();
  const [residents, setResidents] = useState<ResidentListItem[]>([]);
  const [doctors, setDoctors] = useState<{ userId: string; fullName: string }[]>([]);
  const [caretakers, setCaretakers] = useState<{ userId: string; fullName: string }[]>([]);
  const [availableBeds, setAvailableBeds] = useState<{ bedId: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    dateOfBirth: '1945-01-15',
    gender: 'Female',
    bloodGroup: 'O+',
    bedId: '',
    admissionDate: new Date().toISOString().slice(0, 10),
    assignedDoctorId: '',
    assignedCaretakerId: '',
    allergyStatus: 'Unknown',
    dietNotes: '',
  });

  const canCreate = user?.role === 'Admin' || user?.role === 'Doctor' || user?.role === 'Caretaker';

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/residents', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setResidents(data.residents || []);
        setDoctors(data.doctors || []);
        setCaretakers(data.caretakers || []);
        setAvailableBeds(data.availableBeds || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return residents;
    const q = search.toLowerCase();
    return residents.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.roomCode || '').toLowerCase().includes(q) ||
        (r.doctorName || '').toLowerCase().includes(q)
    );
  }, [residents, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { ok, data } = await apiFetch('/api/residents', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify({
          ...form,
          bedId: form.bedId || null,
          assignedDoctorId: form.assignedDoctorId || (user?.role === 'Doctor' ? user.userId : null),
          assignedCaretakerId: form.assignedCaretakerId || null,
          dietNotes: form.dietNotes || null,
        }),
      });
      if (!ok) {
        toast.error(data.error || 'Could not add resident.');
        return;
      }
      toast.success('Resident added successfully.');
      setShowAdd(false);
      setForm({
        fullName: '',
        dateOfBirth: '1945-01-15',
        gender: 'Female',
        bloodGroup: 'O+',
        bedId: '',
        admissionDate: new Date().toISOString().slice(0, 10),
        assignedDoctorId: user?.role === 'Doctor' ? user.userId : '',
        assignedCaretakerId: '',
        allergyStatus: 'Unknown',
        dietNotes: '',
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--cm-text)]">Residents</h1>
          <p className="text-[15px] text-[var(--cm-muted)] mt-0.5">
            {user?.role === 'Caretaker'
              ? 'Residents actively assigned to your care shift.'
              : user?.role === 'Doctor'
                ? 'Residents assigned under your medical care.'
                : 'Facility resident directory across all wings and beds.'}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowAdd(true)}>
            <UserPlus className="h-4 w-4" />
            Add Resident
          </Button>
        )}
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="h-4 w-4 text-[var(--cm-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by resident name, room number, or assigned doctor..."
            className="pl-10"
            aria-label="Search residents"
          />
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Skeleton key={n} className="h-44" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Users className="h-8 w-8 text-[var(--cm-muted)] mx-auto mb-2" />
          <h2 className="text-[18px] font-semibold">No residents found</h2>
          <p className="text-[14px] text-[var(--cm-muted)] mt-1">
            Try clearing your search or contact an administrator for care assignments.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((res) => (
            <Link key={res.residentId} href={`/residents/${res.residentId}`} className="block">
              <Card interactive className="h-full flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-[18px] font-semibold text-[var(--cm-text)] truncate">
                        {res.fullName}
                      </h2>
                      <p className="text-[14px] text-[var(--cm-muted)] tabular-nums">
                        {res.age} yrs · {res.gender} · Blood {res.bloodGroup}
                      </p>
                    </div>
                    <StatusBadge
                      tone={res.status === 'Active' ? 'success' : 'neutral'}
                      label={res.status}
                    />
                  </div>

                  <div className="space-y-1 text-[14px] text-[var(--cm-muted)]">
                    <p className="inline-flex items-center gap-1.5">
                      <BedDouble className="h-4 w-4 text-[var(--cm-primary)]" />
                      {res.roomCode
                        ? `Room ${res.roomCode} · Bed ${res.bedCode} (${res.wingOrFloor})`
                        : 'Bed unassigned'}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Stethoscope className="h-4 w-4 text-[var(--cm-primary)]" />
                      {res.doctorName || 'No doctor assigned'}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--cm-border)] flex flex-wrap items-center justify-between gap-2">
                  {res.hasSevereAllergy ? (
                    <StatusBadge tone="danger" label="Severe Allergy" icon={ShieldAlert} />
                  ) : res.allergiesCount > 0 ? (
                    <StatusBadge tone="warning" label={`${res.allergiesCount} Allergy`} />
                  ) : (
                    <StatusBadge tone="neutral" label={`Allergy: ${res.allergyStatus}`} />
                  )}
                  <span className="text-[13px] font-medium text-[var(--cm-muted)] tabular-nums">
                    {res.activeRxCount} active Rx
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent title="Admit New Resident" description="Create a resident profile and assign an open bed.">
          <form onSubmit={handleCreate} className="space-y-3.5">
            <div>
              <Label htmlFor="resName">Full Name</Label>
              <Input
                id="resName"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Smt. Savitri Deshmukh"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  required
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="admDate">Admission Date</Label>
                <Input
                  id="admDate"
                  type="date"
                  required
                  value={form.admissionDate}
                  onChange={(e) => setForm({ ...form, admissionDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select id="gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="bloodGroup">Blood Group</Label>
                <Select
                  id="bloodGroup"
                  value={form.bloodGroup}
                  onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                >
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="allergyStatus">Allergy Status</Label>
                <Select
                  id="allergyStatus"
                  value={form.allergyStatus}
                  onChange={(e) => setForm({ ...form, allergyStatus: e.target.value })}
                >
                  <option value="Unknown">Unknown</option>
                  <option value="None known">None known</option>
                  <option value="Recorded">Recorded</option>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="bedId">Room / Bed</Label>
              <Select id="bedId" value={form.bedId} onChange={(e) => setForm({ ...form, bedId: e.target.value })}>
                <option value="">Assign later</option>
                {availableBeds.map((b) => (
                  <option key={b.bedId} value={b.bedId}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="doctorId">Assigned Doctor</Label>
                <Select
                  id="doctorId"
                  value={form.assignedDoctorId}
                  onChange={(e) => setForm({ ...form, assignedDoctorId: e.target.value })}
                >
                  <option value="">Assign later</option>
                  {doctors.map((d) => (
                    <option key={d.userId} value={d.userId}>
                      {d.fullName}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="caretakerId">Assign Caretaker</Label>
                <Select
                  id="caretakerId"
                  value={form.assignedCaretakerId}
                  onChange={(e) => setForm({ ...form, assignedCaretakerId: e.target.value })}
                >
                  <option value="">No caretaker assigned</option>
                  {caretakers.map((c) => (
                    <option key={c.userId} value={c.userId}>
                      {c.fullName}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="dietNotes">Dietary &amp; Care Notes</Label>
              <Textarea
                id="dietNotes"
                value={form.dietNotes}
                onChange={(e) => setForm({ ...form, dietNotes: e.target.value })}
                placeholder="Low-sodium diet, mobility preferences..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                <Plus className="h-4 w-4" />
                {saving ? 'Admitting...' : 'Admit Resident'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
