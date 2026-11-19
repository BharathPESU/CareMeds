'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Building2, Palette, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Card, Input, Label, Select, Skeleton } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/api-client';
import { COLOR_MODE_OPTIONS, THEME_OPTIONS } from '@/lib/theme';
import type { ColorMode, FacilityRecord, ThemeKey, VitalTypeRecord } from '@/lib/types';

export default function AdminSettingsPage() {
  const { user, csrfToken, setCareTheme } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [facility, setFacility] = useState<FacilityRecord | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [vitalTypes, setVitalTypes] = useState<VitalTypeRecord[]>([]);
  const [doseWindows, setDoseWindows] = useState<{ windowId: string; name: string; startTime: string; endTime: string }[]>([]);

  const isAdmin = user?.role === 'Admin';
  const canEditVitals = user?.role === 'Admin' || user?.role === 'Doctor';

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setFacility(d.facility);
        setSettings(d.systemSettings || {});
        setVitalTypes(d.vitalTypes || []);
        setDoseWindows(d.doseTimeWindows || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveFacility(e: React.FormEvent) {
    e.preventDefault();
    if (!facility) return;
    setSaving(true);
    try {
      const { ok, data } = await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        csrfToken,
        body: JSON.stringify({ section: 'facility', facility }),
      });
      if (!ok) {
        toast.error(data.error || 'Could not save facility profile.');
        return;
      }
      toast.success('Facility profile saved.');
    } finally {
      setSaving(false);
    }
  }

  async function saveSystemSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { ok, data } = await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        csrfToken,
        body: JSON.stringify({ section: 'system_settings', settings }),
      });
      if (!ok) {
        toast.error(data.error || 'Could not save system settings.');
        return;
      }
      if (settings.default_theme && settings.default_color_mode) {
        await setCareTheme(settings.default_theme as ThemeKey, settings.default_color_mode as ColorMode, false);
      }
      toast.success('Facility rules and default theme updated.');
    } finally {
      setSaving(false);
    }
  }

  async function saveVitalThresholds(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { ok, data } = await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        csrfToken,
        body: JSON.stringify({ section: 'vital_thresholds', vitalTypes }),
      });
      if (!ok) {
        toast.error(data.error || 'Could not update vital thresholds.');
        return;
      }
      toast.success('Clinical vital-sign thresholds updated.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !facility) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[var(--cm-text)]">
          Facility Settings &amp; Clinical Ranges
        </h1>
        <p className="text-[15px] text-[var(--cm-muted)] mt-0.5">
          Configure facility details, doctor-approved vital thresholds, security windows, and the default theme.
        </p>
      </div>

      {/* Clinical Vital Thresholds (Doctor & Admin) */}
      {canEditVitals && (
        <Card>
          <form onSubmit={saveVitalThresholds} className="space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[var(--cm-primary)]" />
              <div>
                <h2 className="text-[19px] font-semibold">Clinical Vital-Sign Alert Ranges</h2>
                <p className="text-[14px] text-[var(--cm-muted)]">
                  Leave blank to keep an alert off. Once min/max bounds are set by the facility doctor, out-of-range readings raise a High-priority ABNORMAL_VITAL alert automatically.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {vitalTypes.map((vt, idx) => (
                <div
                  key={vt.vitalTypeId}
                  className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center rounded-[12px] bg-[var(--cm-surface-subtle)] p-3"
                >
                  <div className="sm:col-span-2">
                    <p className="text-[15px] font-semibold">{vt.name}</p>
                    <p className="text-[12px] text-[var(--cm-muted)]">Unit: {vt.unit}</p>
                  </div>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Min normal"
                    aria-label={`${vt.name} min normal`}
                    value={vt.minNormal ?? ''}
                    onChange={(e) => {
                      const next = [...vitalTypes];
                      next[idx] = {
                        ...vt,
                        minNormal: e.target.value === '' ? null : Number(e.target.value),
                      };
                      setVitalTypes(next);
                    }}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Max normal"
                    aria-label={`${vt.name} max normal`}
                    value={vt.maxNormal ?? ''}
                    onChange={(e) => {
                      const next = [...vitalTypes];
                      next[idx] = {
                        ...vt,
                        maxNormal: e.target.value === '' ? null : Number(e.target.value),
                      };
                      setVitalTypes(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4" />
              Save Clinical Thresholds
            </Button>
          </form>
        </Card>
      )}

      {/* Admin-Only Sections */}
      {isAdmin && (
        <>
          <Card>
            <form onSubmit={saveFacility} className="space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[var(--cm-primary)]" />
                <h2 className="text-[19px] font-semibold">Facility Profile</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="facName">Facility Name</Label>
                  <Input id="facName" value={facility.name} onChange={(e) => setFacility({ ...facility, name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="facReg">Registration Number</Label>
                  <Input id="facReg" value={facility.registrationNo} onChange={(e) => setFacility({ ...facility, registrationNo: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="facPhone">Phone</Label>
                  <Input id="facPhone" value={facility.phone} onChange={(e) => setFacility({ ...facility, phone: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="facEmail">Email</Label>
                  <Input id="facEmail" type="email" value={facility.email} onChange={(e) => setFacility({ ...facility, email: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="facAddr">Address</Label>
                <Input id="facAddr" value={facility.address} onChange={(e) => setFacility({ ...facility, address: e.target.value })} />
              </div>
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4" />
                Save Facility Details
              </Button>
            </form>
          </Card>

          <Card>
            <form onSubmit={saveSystemSettings} className="space-y-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[var(--cm-primary)]" />
                <h2 className="text-[19px] font-semibold">Security, Alerts &amp; Dose Timing</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="idleMin">Idle Timeout (minutes)</Label>
                  <Input
                    id="idleMin"
                    type="number"
                    value={settings.session_idle_minutes || '30'}
                    onChange={(e) => setSettings({ ...settings, session_idle_minutes: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="undoMin">Dose Undo Window (minutes)</Label>
                  <Input
                    id="undoMin"
                    type="number"
                    value={settings.undo_window_minutes || '5'}
                    onChange={(e) => setSettings({ ...settings, undo_window_minutes: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="graceMin">Overdue Grace (minutes)</Label>
                  <Input
                    id="graceMin"
                    type="number"
                    value={settings.overdue_grace_minutes || '60'}
                    onChange={(e) => setSettings({ ...settings, overdue_grace_minutes: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="expDays">Expiry Warning (days)</Label>
                  <Input
                    id="expDays"
                    type="number"
                    value={settings.expiry_warning_days || '60'}
                    onChange={(e) => setSettings({ ...settings, expiry_warning_days: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="escMin">Alert Escalation (minutes)</Label>
                  <Input
                    id="escMin"
                    type="number"
                    value={settings.escalation_minutes || '60'}
                    onChange={(e) => setSettings({ ...settings, escalation_minutes: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="mfaCt">Require MFA for Caretakers</Label>
                  <Select
                    id="mfaCt"
                    value={settings.require_mfa_caretakers || 'false'}
                    onChange={(e) => setSettings({ ...settings, require_mfa_caretakers: e.target.value })}
                  >
                    <option value="false">Optional (recommended)</option>
                    <option value="true">Mandatory for all Caretakers</option>
                  </Select>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--cm-border)] space-y-3">
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-[var(--cm-primary)]" />
                  <h3 className="text-[17px] font-semibold">Facility Default Theme</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {THEME_OPTIONS.map((t) => {
                    const active = (settings.default_theme || 'clinical-calm') === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setSettings({ ...settings, default_theme: t.key })}
                        className={`text-left rounded-[16px] border p-4 transition-colors min-h-[92px] ${
                          active
                            ? 'border-[var(--cm-primary)] bg-[var(--cm-primary)]/10'
                            : 'border-[var(--cm-border)] hover:bg-[var(--cm-surface-subtle)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className="h-4 w-4 rounded-full border border-black/10"
                            style={{ backgroundColor: t.swatch }}
                          />
                          <span className="font-semibold text-[15px]">{t.label}</span>
                        </div>
                        <p className="text-[13px] text-[var(--cm-muted)]">{t.description}</p>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <Label htmlFor="defMode">Default Colour Mode</Label>
                  <Select
                    id="defMode"
                    value={settings.default_color_mode || 'system'}
                    onChange={(e) => setSettings({ ...settings, default_color_mode: e.target.value })}
                    className="max-w-xs"
                  >
                    {COLOR_MODE_OPTIONS.map((m) => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--cm-border)]">
                <h3 className="text-[15px] font-semibold mb-2">Dose Time Windows</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[13px]">
                  {doseWindows.map((w) => (
                    <div key={w.windowId} className="rounded-[12px] bg-[var(--cm-surface-subtle)] p-3">
                      <p className="font-semibold">{w.name}</p>
                      <p className="text-[var(--cm-muted)] tabular-nums">
                        {w.startTime} – {w.endTime}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4" />
                Save Facility Settings
              </Button>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}
