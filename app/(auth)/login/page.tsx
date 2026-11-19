'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  HeartPulse,
  KeyRound,
  Lock,
  ShieldCheck,
  Stethoscope,
  User,
  UserCog,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Card, Input, Label } from '@/components/ui/primitives';
import type { RoleName } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const { authenticated, loading, previewMode, setupCompleted, refreshAuth } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [switchingRole, setSwitchingRole] = useState<RoleName | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!setupCompleted) {
        router.replace('/setup');
      } else if (authenticated) {
        router.replace('/dashboard');
      }
    }
  }, [authenticated, loading, router, setupCompleted]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          ...(mfaRequired && !useRecovery ? { totpCode: totpCode.trim() } : {}),
          ...(mfaRequired && useRecovery ? { recoveryCode: recoveryCode.trim() } : {}),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Sign-in failed. Check your credentials and try again.');
        if (data.mfaRequired) setMfaRequired(true);
        return;
      }

      if (data.mfaRequired) {
        setMfaRequired(true);
        toast.info('Enter the 6-digit code from your authenticator app.');
        return;
      }

      await refreshAuth();
      if (data.mustChangePassword) {
        router.push('/change-password');
      } else if (data.needsMfaEnroll) {
        router.push('/mfa-enroll');
      } else {
        router.push('/dashboard');
      }
    } catch {
      setError('Could not reach the sign-in service. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePreviewRole(role: RoleName) {
    setError(null);
    setSwitchingRole(role);
    try {
      const res = await fetch('/api/auth/preview-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not start preview session.');
        return;
      }
      await refreshAuth();
      toast.success(`Signed in as ${data.user.fullName} (${data.user.role})`);
      router.push('/dashboard');
    } catch {
      setError('Failed to start preview session.');
    } finally {
      setSwitchingRole(null);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[var(--cm-bg)]">
      <div className="w-full max-w-[440px] space-y-5">
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-[var(--cm-primary)] text-[var(--cm-primary-foreground)] shadow-sm">
            <HeartPulse className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--cm-text)]">CareMeds</h1>
          <p className="text-[15px] text-[var(--cm-muted)]">
            Residential Care Home Medication &amp; Clinical Management
          </p>
        </div>

        <Card className="p-6 sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2 className="text-[20px] font-semibold text-[var(--cm-text)]">Staff Sign In</h2>
              <p className="text-[14px] text-[var(--cm-muted)] mt-0.5">
                {mfaRequired
                  ? 'Two-factor verification is enabled on this account.'
                  : 'Use your facility username and password.'}
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-[12px] bg-[var(--cm-danger-bg)] text-[var(--cm-danger)] p-3.5 text-[14px] font-medium"
              >
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {!mfaRequired ? (
              <>
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="firstname.lastname"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-[12px] bg-[var(--cm-surface-subtle)] px-3.5 py-2.5 text-[14px] text-[var(--cm-muted)] flex items-center justify-between">
                  <span>Signing in as <strong className="text-[var(--cm-text)]">{username}</strong></span>
                  <button
                    type="button"
                    className="text-[var(--cm-primary)] font-medium underline text-[13px] min-h-[36px] px-2"
                    onClick={() => {
                      setMfaRequired(false);
                      setTotpCode('');
                      setRecoveryCode('');
                      setError(null);
                    }}
                  >
                    Change
                  </button>
                </div>

                {!useRecovery ? (
                  <div>
                    <Label htmlFor="totpCode">6-Digit Authenticator Code</Label>
                    <Input
                      id="totpCode"
                      name="totpCode"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="font-mono text-center tracking-[0.35em] text-[20px]"
                    />
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="recoveryCode">One-Time Recovery Code</Label>
                    <Input
                      id="recoveryCode"
                      name="recoveryCode"
                      required
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                      placeholder="XXXX-XXXX"
                      className="font-mono text-center tracking-widest text-[17px]"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setUseRecovery((v) => !v);
                    setError(null);
                  }}
                  className="text-[14px] text-[var(--cm-primary)] hover:underline font-medium min-h-[44px] inline-flex items-center gap-1.5"
                >
                  <KeyRound className="h-4 w-4" />
                  {useRecovery ? 'Use authenticator app code instead' : 'Use a one-time recovery code'}
                </button>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              <Lock className="h-4 w-4" aria-hidden="true" />
              {submitting ? 'Signing in...' : mfaRequired ? 'Verify & Sign In' : 'Sign In'}
            </Button>

            <p className="text-[13px] text-[var(--cm-muted)] text-center pt-1">
              Staff accounts are created by your facility administrator. Contact Admin if you need a password reset or unlock.
            </p>
          </form>
        </Card>

        {previewMode && (
          <Card className="p-5 border-dashed">
            <div className="flex items-start gap-2.5 mb-3">
              <ShieldCheck className="h-5 w-5 text-[var(--cm-primary)] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="text-[15px] font-semibold text-[var(--cm-text)]">
                  Interactive Preview Environment
                </h3>
                <p className="text-[13px] text-[var(--cm-muted)] mt-0.5">
                  No external Supabase database URL is connected yet. Enter a live role session directly — no passwords are stored in code.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <Button
                type="button"
                variant="secondary"
                className="w-full justify-center"
                disabled={switchingRole !== null}
                onClick={() => void handlePreviewRole('Caretaker')}
              >
                <User className="h-4 w-4" />
                {switchingRole === 'Caretaker' ? 'Opening...' : 'Caretaker'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full justify-center"
                disabled={switchingRole !== null}
                onClick={() => void handlePreviewRole('Doctor')}
              >
                <Stethoscope className="h-4 w-4" />
                {switchingRole === 'Doctor' ? 'Opening...' : 'Doctor'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full justify-center"
                disabled={switchingRole !== null}
                onClick={() => void handlePreviewRole('Admin')}
              >
                <UserCog className="h-4 w-4" />
                {switchingRole === 'Admin' ? 'Opening...' : 'Admin'}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
