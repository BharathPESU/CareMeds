'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, AlertTriangle, Plus } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Card, Input, Label, Select, Skeleton } from '@/components/ui/primitives';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiFetch } from '@/lib/api-client';
import { formatDateTime } from '@/lib/time';

interface VitalReadingItem {
  readingId: string;
  residentId: string;
  residentName: string;
  recordedAt: string;
  recordedByName: string;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  bloodSugar: number | null;
  bloodSugarUnit: 'mg/dL' | 'mmol/L';
  temperatureC: number | null;
  pulseBpm: number | null;
  spo2Percent: number | null;
  weightKg: number | null;
  notes: string | null;
  abnormalFlags: { code: string; name: string; value: number; unit: string; direction: string }[];
}

interface VitalType {
  vitalTypeId: string;
  code: string;
  name: string;
  unit: string;
  minNormal: number | null;
  maxNormal: number | null;
}

export default function VitalsPage() {
  const { user, csrfToken } = useAuth();
  const [readings, setReadings] = useState<VitalReadingItem[]>([]);
  const [vitalTypes, setVitalTypes] = useState<VitalType[]>([]);
  const [residents, setResidents] = useState<{ residentId: string; fullName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResident, setSelectedResident] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    residentId: '',
    bpSystolic: '128',
    bpDiastolic: '80',
    bloodSugar: '',
    bloodSugarUnit: 'mg/dL' as 'mg/dL' | 'mmol/L',
    temperatureC: '36.7',
    pulseBpm: '74',
    spo2Percent: '98',
    weightKg: '',
    notes: '',
  });

  const canRecord = user?.role === 'Caretaker' || user?.role === 'Doctor';

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/vitals', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setReadings(d.readings || []);
        setVitalTypes(d.vitalTypes || []);
        setResidents(d.residents || []);
        if (d.residents?.[0] && !selectedResident) {
          setSelectedResident(d.residents[0].residentId);
          setForm((prev) => ({ ...prev, residentId: prev.residentId || d.residents[0].residentId }));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [selectedResident]);

  useEffect(() => {
    void load();
  }, [load]);

  const thresholdsConfigured = vitalTypes.some((v) => v.minNormal !== null || v.maxNormal !== null);

  const chartData = useMemo(() => {
    return readings
      .filter((r) => !selectedResident || r.residentId === selectedResident)
      .slice(0, 12)
      .reverse()
      .map((r) => ({
        time: new Date(r.recordedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        systolic: r.bpSystolic,
        diastolic: r.bpDiastolic,
        pulse: r.pulseBpm,
        spo2: r.spo2Percent,
      }));
  }, [readings, selectedResident]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
      const { ok, data } = await apiFetch<{ abnormalFlags?: { name: string }[] }>('/api/vitals', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify({
          residentId: form.residentId,
          bpSystolic: numOrNull(form.bpSystolic),
          bpDiastolic: numOrNull(form.bpDiastolic),
          bloodSugar: numOrNull(form.bloodSugar),
          bloodSugarUnit: form.bloodSugarUnit,
          temperatureC: numOrNull(form.temperatureC),
          pulseBpm: numOrNull(form.pulseBpm),
          spo2Percent: numOrNull(form.spo2Percent),
          weightKg: numOrNull(form.weightKg),
          notes: form.notes || null,
        }),
      });
      if (!ok) {
        toast.error(data.error || 'Could not record vital reading.');
        return;
      }
      if (data.abnormalFlags && data.abnormalFlags.length > 0) {
        toast.warning(`Reading saved — ${data.abnormalFlags.length} abnormal vital alert(s) triggered.`);
      } else {
        toast.success('Vital signs recorded.');
      }
      setForm((prev) => ({ ...prev, notes: '' }));
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[var(--cm-text)]">Resident Vitals</h1>
        <p className="text-[15px] text-[var(--cm-muted)] mt-0.5">
          Track blood pressure, blood glucose, temperature, pulse, SpO2, and weight trends.
        </p>
      </div>

      {!thresholdsConfigured && (
        <div className="rounded-[16px] border border-[var(--cm-border)] bg-[var(--cm-info-bg)] text-[var(--cm-info)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-[14px] font-medium">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>
              Abnormal-vital alerting is currently off because clinical ranges start unset. Readings are still recorded and charted; once the facility doctor enters thresholds, out-of-range alerts activate automatically.
            </span>
          </div>
          {(user?.role === 'Doctor' || user?.role === 'Admin') && (
            <Link href="/admin/settings" className="shrink-0">
              <Button variant="secondary" size="sm">Set Ranges</Button>
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {canRecord && (
          <Card className="lg:col-span-2">
            <h2 className="text-[18px] font-semibold mb-3">Record Vitals</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="vRes">Resident</Label>
                <Select
                  id="vRes"
                  required
                  value={form.residentId}
                  onChange={(e) => {
                    setForm({ ...form, residentId: e.target.value });
                    setSelectedResident(e.target.value);
                  }}
                >
                  {residents.map((r) => (
                    <option key={r.residentId} value={r.residentId}>{r.fullName}</option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="bpSys">BP Systolic (mmHg)</Label>
                  <Input id="bpSys" type="number" value={form.bpSystolic} onChange={(e) => setForm({ ...form, bpSystolic: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="bpDia">BP Diastolic (mmHg)</Label>
                  <Input id="bpDia" type="number" value={form.bpDiastolic} onChange={(e) => setForm({ ...form, bpDiastolic: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="sugar">Blood Sugar</Label>
                  <Input id="sugar" type="number" step="0.1" value={form.bloodSugar} onChange={(e) => setForm({ ...form, bloodSugar: e.target.value })} placeholder="118" />
                </div>
                <div>
                  <Label htmlFor="sugarUnit">Unit</Label>
                  <Select
                    id="sugarUnit"
                    value={form.bloodSugarUnit}
                    onChange={(e) => setForm({ ...form, bloodSugarUnit: e.target.value as 'mg/dL' | 'mmol/L' })}
                  >
                    <option value="mg/dL">mg/dL</option>
                    <option value="mmol/L">mmol/L</option>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="temp">Temp (°C)</Label>
                  <Input id="temp" type="number" step="0.1" value={form.temperatureC} onChange={(e) => setForm({ ...form, temperatureC: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="pulse">Pulse (bpm)</Label>
                  <Input id="pulse" type="number" value={form.pulseBpm} onChange={(e) => setForm({ ...form, pulseBpm: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="spo2">SpO2 (%)</Label>
                  <Input id="spo2" type="number" value={form.spo2Percent} onChange={(e) => setForm({ ...form, spo2Percent: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="vNotes">Notes</Label>
                <Input id="vNotes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Resting before breakfast..." />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                <Plus className="h-4 w-4" />
                {saving ? 'Recording...' : 'Save Vital Reading'}
              </Button>
            </form>
          </Card>
        )}

        <Card className={canRecord ? 'lg:col-span-3' : 'lg:col-span-5'}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[var(--cm-primary)]" />
              <h2 className="text-[18px] font-semibold">Blood Pressure &amp; Pulse Trend</h2>
            </div>
            <Select
              value={selectedResident}
              onChange={(e) => setSelectedResident(e.target.value)}
              className="w-auto min-w-[200px]"
              aria-label="Filter chart by resident"
            >
              {residents.map((r) => (
                <option key={r.residentId} value={r.residentId}>{r.fullName}</option>
              ))}
            </Select>
          </div>
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cm-border)" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: 'var(--cm-muted)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'var(--cm-muted)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--cm-surface)',
                    borderColor: 'var(--cm-border)',
                    borderRadius: 12,
                  }}
                />
                <Line type="monotone" dataKey="systolic" name="BP Systolic" stroke="var(--cm-primary)" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="diastolic" name="BP Diastolic" stroke="var(--cm-info)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="pulse" name="Pulse" stroke="var(--cm-warning)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Readings Table */}
      <Card>
        <h2 className="text-[18px] font-semibold mb-3">Recent Vital Readings</h2>
        {loading ? (
          <Skeleton className="h-44" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px] tabular-nums">
              <thead>
                <tr className="border-b border-[var(--cm-border)] text-[var(--cm-muted)]">
                  <th className="py-2.5 pr-3">Resident</th>
                  <th className="py-2.5 pr-3">Recorded</th>
                  <th className="py-2.5 pr-3">BP</th>
                  <th className="py-2.5 pr-3">Sugar</th>
                  <th className="py-2.5 pr-3">Temp</th>
                  <th className="py-2.5 pr-3">Pulse / SpO2</th>
                  <th className="py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--cm-border)]">
                {readings.map((r) => (
                  <tr key={r.readingId}>
                    <td className="py-3 pr-3 font-semibold">{r.residentName}</td>
                    <td className="py-3 pr-3 text-[var(--cm-muted)]">{formatDateTime(r.recordedAt)}</td>
                    <td className="py-3 pr-3">
                      {r.bpSystolic && r.bpDiastolic ? `${r.bpSystolic}/${r.bpDiastolic}` : '—'}
                    </td>
                    <td className="py-3 pr-3">
                      {r.bloodSugar != null ? `${r.bloodSugar} ${r.bloodSugarUnit}` : '—'}
                    </td>
                    <td className="py-3 pr-3">{r.temperatureC != null ? `${r.temperatureC}°C` : '—'}</td>
                    <td className="py-3 pr-3">
                      {r.pulseBpm != null ? `${r.pulseBpm} bpm` : '—'} / {r.spo2Percent != null ? `${r.spo2Percent}%` : '—'}
                    </td>
                    <td className="py-3">
                      {r.abnormalFlags.length > 0 ? (
                        <StatusBadge tone="danger" label={`${r.abnormalFlags.length} Out of Range`} />
                      ) : (
                        <StatusBadge tone="success" label="Recorded" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
