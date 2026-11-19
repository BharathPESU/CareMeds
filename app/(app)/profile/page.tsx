'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { KeyRound, Monitor, Moon, Palette, Save, ShieldCheck, Sun, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Card, Input, Label } from '@/components/ui/primitives';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiFetch } from '@/lib/api-client';
import { COLOR_MODE_OPTIONS, THEME_OPTIONS } from '@/lib/theme';
import type { ColorMode, ThemeKey } from '@/lib/types';

export default function ProfilePage() {
  const { user, csrfToken, themeKey, colorMode, setCareTheme, refreshAuth } = useAuth();
  const [fullNameDraft, setFullNameDraft] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fullName = fullNameDraft ?? user?.fullName ?? '';
  const phone = phoneDraft ?? user?.phone ?? '';

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { ok, data } = await apiFetch('/api/profile', {
        method: 'PATCH',
        csrfToken,
        body: JSON.stringify({ fullName, phone: phone || null }),
      });
      if (!ok) {
        toast.error(data.error || 'Could not update profile.');
        return;
      }
      setFullNameDraft(null);
      setPhoneDraft(null);
      await refreshAuth();
      toast.success('Profile updated.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[var(--cm-text)]">
          My Profile &amp; Appearance
        </h1>
        <p className="text-[15px] text-[var(--cm-muted)] mt-0.5">
          Manage your contact details, account security, and personal theme preference.
        </p>
      </div>

      {/* Personal Details */}
      <Card>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-[var(--cm-primary)]" />
              <h2 className="text-[19px] font-semibold">Account Details</h2>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge tone="info" label={user?.role || 'Staff'} />
              <StatusBadge
                tone={user?.mfaEnabled ? 'success' : 'warning'}
                label={user?.mfaEnabled ? 'MFA Enabled' : 'MFA Optional'}
                icon={ShieldCheck}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="profName">Full Name</Label>
              <Input id="profName" required value={fullName} onChange={(e) => setFullNameDraft(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="profUser">Username (read-only)</Label>
              <Input id="profUser" readOnly disabled value={user?.username || ''} className="font-mono" />
            </div>
            <div>
              <Label htmlFor="profPhone">Phone</Label>
              <Input id="profPhone" value={phone} onChange={(e) => setPhoneDraft(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="profEmail">Email</Label>
              <Input id="profEmail" readOnly disabled value={user?.email || 'Not set'} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4" />
              Save Profile
            </Button>
            <div className="flex flex-wrap gap-2">
              <Link href="/change-password">
                <Button type="button" variant="secondary">
                  <KeyRound className="h-4 w-4" />
                  Change Password
                </Button>
              </Link>
              {!user?.mfaEnabled && (
                <Link href="/mfa-enroll">
                  <Button type="button" variant="secondary">
                    <ShieldCheck className="h-4 w-4" />
                    Enable MFA
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </form>
      </Card>

      {/* Personal Theme & Dark Mode Picker */}
      <Card className="space-y-5">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-[var(--cm-primary)]" />
          <div>
            <h2 className="text-[19px] font-semibold">Theme &amp; Colour Mode</h2>
            <p className="text-[14px] text-[var(--cm-muted)]">
              Saved to your profile and applied immediately across sessions. Status badges stay fixed across all themes for safety.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {THEME_OPTIONS.map((t) => {
            const active = themeKey === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  void setCareTheme(t.key as ThemeKey, colorMode, true);
                  toast.success(`Theme switched to ${t.label}`);
                }}
                className={`text-left rounded-[16px] border p-4 transition-colors min-h-[100px] ${
                  active
                    ? 'border-[var(--cm-primary)] bg-[var(--cm-primary)]/10'
                    : 'border-[var(--cm-border)] hover:bg-[var(--cm-surface-subtle)]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="h-4 w-4 rounded-full border border-black/15"
                    style={{ backgroundColor: t.swatch }}
                  />
                  <span className="font-semibold text-[15px]">{t.label}</span>
                </div>
                <p className="text-[13px] text-[var(--cm-muted)]">{t.description}</p>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <Label>Colour Mode</Label>
          <div className="grid grid-cols-3 gap-2.5">
            {COLOR_MODE_OPTIONS.map((m) => {
              const Icon = m.key === 'light' ? Sun : m.key === 'dark' ? Moon : Monitor;
              const active = colorMode === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    void setCareTheme(themeKey, m.key as ColorMode, true);
                    toast.success(`Colour mode set to ${m.label}`);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-[14px] border px-3 py-3 text-[15px] font-medium min-h-[48px] transition-colors ${
                    active
                      ? 'border-[var(--cm-primary)] bg-[var(--cm-primary)] text-[var(--cm-primary-foreground)]'
                      : 'border-[var(--cm-border)] hover:bg-[var(--cm-surface-subtle)]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
