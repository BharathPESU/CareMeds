'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, HeartPulse, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Card, Input, Label } from '@/components/ui/primitives';

export default function SetupPage() {
  const router = useRouter();
  const { refreshAuth } = useAuth();
  const [checking, setChecking] = useState(true);
  const [closed, setClosed] = useState(false);

  const [step, setStep] = useState<'create' | 'totp' | 'codes'>('create');
  const [setupToken, setSetupToken] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const [userId, setUserId] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/auth/setup')
      .then((r) => r.json())
      .then((d) => {
        if (d.setupCompleted) setClosed(true);
      })
      .finally(() => setChecking(false));
  }, []);

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupToken, fullName, username, email, phone, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Setup failed.');
        return;
      }
      setUserId(data.userId);
      setQrDataUrl(data.qrDataUrl);
      setTotpSecret(data.totpSecret);
      setStep('totp');
    } catch {
      setError('Network error during setup.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmTotp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'confirm_totp', setupToken, userId, totpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Code verification failed.');
        return;
      }
      setRecoveryCodes(data.recoveryCodes || []);
      await refreshAuth();
      toast.success('First Administrator created and MFA enabled.');
      setStep('codes');
    } catch {
      setError('Network error while verifying MFA.');
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-[15px] text-[var(--cm-muted)]">Checking facility setup status...</p>
      </main>
    );
  }

  if (closed) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-6 text-center space-y-4">
          <ShieldCheck className="h-10 w-10 text-[var(--cm-primary)] mx-auto" />
          <h1 className="text-[22px] font-bold">Initial Setup Closed</h1>
          <p className="text-[15px] text-[var(--cm-muted)]">
            This facility already has an administrator account configured. Initial setup is permanently locked.
          </p>
          <Button onClick={() => router.push('/login')} className="w-full">
            Go to Sign In
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg space-y-5">
        <div className="text-center space-y-1.5">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-[var(--cm-primary)] text-[var(--cm-primary-foreground)]">
            <HeartPulse className="h-6 w-6" />
          </div>
          <h1 className="text-[26px] font-bold">CareMeds First-Run Setup</h1>
          <p className="text-[14px] text-[var(--cm-muted)]">
            Create the initial Facility Administrator account with mandatory TOTP two-factor authentication.
          </p>
        </div>

        <Card className="p-6">
          {error && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-[12px] bg-[var(--cm-danger-bg)] text-[var(--cm-danger)] p-3.5 text-[14px]">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 'create' && (
            <form onSubmit={handleStep1} className="space-y-4">
              <div>
                <Label htmlFor="setupToken">Server Setup Token (SETUP_TOKEN)</Label>
                <Input id="setupToken" type="password" required value={setupToken} onChange={(e) => setSetupToken(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Meera Nair" />
                </div>
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="meera.nair" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="email">Work Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="password">Password (minimum 12 characters)</Label>
                <Input id="password" type="password" minLength={12} required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? 'Creating Administrator...' : 'Continue to Two-Factor Setup'}
              </Button>
            </form>
          )}

          {step === 'totp' && (
            <form onSubmit={handleConfirmTotp} className="space-y-4">
              <h2 className="text-[18px] font-semibold">Scan Authenticator QR Code</h2>
              <p className="text-[14px] text-[var(--cm-muted)]">
                Scan this QR code with Google Authenticator, 1Password, or Authy, then enter the 6-digit code to lock setup.
              </p>
              {qrDataUrl && (
                <div className="flex flex-col items-center gap-2 rounded-[16px] bg-[var(--cm-surface-subtle)] p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="Authenticator QR code" className="h-44 w-44 rounded-[12px] bg-white p-2" />
                  <p className="text-[13px] text-[var(--cm-muted)]">Manual key:</p>
                  <code className="font-mono text-[14px] font-semibold select-all">{totpSecret}</code>
                </div>
              )}
              <div>
                <Label htmlFor="totpCode">6-Digit Authenticator Code</Label>
                <Input
                  id="totpCode"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="font-mono text-center tracking-[0.35em] text-[20px]"
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? 'Verifying...' : 'Verify & Complete Setup'}
              </Button>
            </form>
          )}

          {step === 'codes' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[var(--cm-success)]">
                <CheckCircle2 className="h-6 w-6" />
                <h2 className="text-[18px] font-semibold">Save Your 10 Recovery Codes</h2>
              </div>
              <p className="text-[14px] text-[var(--cm-muted)]">
                These single-use codes are shown only once. Print or store them offline in case you lose your authenticator device.
              </p>
              <div className="grid grid-cols-2 gap-2 rounded-[16px] bg-[var(--cm-surface-subtle)] p-4 font-mono text-[14px] font-semibold">
                {recoveryCodes.map((code) => (
                  <div key={code} className="rounded-[8px] bg-[var(--cm-surface)] px-3 py-2 text-center border border-[var(--cm-border)]">
                    {code}
                  </div>
                ))}
              </div>
              <Button className="w-full" size="lg" onClick={() => router.push('/dashboard')}>
                I Have Saved My Codes — Open Dashboard
              </Button>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
