'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Card, Input, Label } from '@/components/ui/primitives';

export default function MfaEnrollPage() {
  const router = useRouter();
  const { csrfToken, refreshAuth } = useAuth();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/auth/mfa', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.alreadyEnrolled) {
          router.replace('/dashboard');
          return;
        }
        if (data.error) setError(data.error);
        else {
          setQrDataUrl(data.qrDataUrl || '');
          setTotpSecret(data.totpSecret || '');
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
        body: JSON.stringify({ totpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid authenticator code.');
        return;
      }
      setRecoveryCodes(data.recoveryCodes || []);
      await refreshAuth();
      toast.success('Two-factor authentication enabled.');
    } catch {
      setError('Could not complete MFA verification.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-[14px] bg-[var(--cm-primary)]/10 text-[var(--cm-primary)] flex items-center justify-center">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold">Set Up Authenticator App (MFA)</h1>
            <p className="text-[14px] text-[var(--cm-muted)]">
              Required to protect resident medication records.
            </p>
          </div>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-[12px] bg-[var(--cm-danger-bg)] text-[var(--cm-danger)] p-3.5 text-[14px]">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <p className="text-[14px] text-[var(--cm-muted)]">Generating your authenticator key...</p>
        ) : recoveryCodes.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[var(--cm-success)]">
              <CheckCircle2 className="h-5 w-5" />
              <h2 className="text-[17px] font-semibold">Save Your 10 One-Time Recovery Codes</h2>
            </div>
            <p className="text-[14px] text-[var(--cm-muted)]">
              Store these codes securely. They will not be displayed again.
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-[16px] bg-[var(--cm-surface-subtle)] p-4 font-mono text-[14px] font-semibold">
              {recoveryCodes.map((code) => (
                <div key={code} className="rounded-[8px] bg-[var(--cm-surface)] px-3 py-2 text-center border border-[var(--cm-border)]">
                  {code}
                </div>
              ))}
            </div>
            <Button className="w-full" size="lg" onClick={() => router.push('/dashboard')}>
              Continue to CareMeds
            </Button>
          </div>
        ) : (
          <form onSubmit={handleConfirm} className="space-y-4">
            {qrDataUrl && (
              <div className="flex flex-col items-center gap-2 rounded-[16px] bg-[var(--cm-surface-subtle)] p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="MFA QR code" className="h-44 w-44 rounded-[12px] bg-white p-2" />
                <p className="text-[13px] text-[var(--cm-muted)]">Or enter secret manually:</p>
                <code className="font-mono text-[14px] font-semibold select-all">{totpSecret}</code>
              </div>
            )}
            <div>
              <Label htmlFor="mfaCode">Enter 6-Digit Verification Code</Label>
              <Input
                id="mfaCode"
                inputMode="numeric"
                maxLength={6}
                required
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="font-mono text-center tracking-[0.35em] text-[20px]"
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? 'Verifying...' : 'Confirm & Enable Two-Factor'}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
