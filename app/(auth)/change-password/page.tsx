'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Card, Input, Label } from '@/components/ui/primitives';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, csrfToken, refreshAuth } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not update password.');
        return;
      }
      await refreshAuth();
      toast.success('Password updated successfully.');
      if (data.needsMfaEnroll) {
        router.push('/mfa-enroll');
      } else {
        router.push('/dashboard');
      }
    } catch {
      setError('Network error while updating password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-md p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-[14px] bg-[var(--cm-primary)]/10 text-[var(--cm-primary)] flex items-center justify-center">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold">Change Your Password</h1>
            <p className="text-[14px] text-[var(--cm-muted)]">
              {user?.mustChangePassword
                ? 'Choose a new permanent password before continuing.'
                : 'Use at least 12 characters, different from your username.'}
            </p>
          </div>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-[12px] bg-[var(--cm-danger-bg)] text-[var(--cm-danger)] p-3.5 text-[14px]">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="currentPassword">Current or Temporary Password</Label>
            <Input
              id="currentPassword"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="newPassword">New Password (min 12 characters)</Label>
            <Input
              id="newPassword"
              type="password"
              minLength={12}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              minLength={12}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? 'Updating Password...' : 'Save New Password'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
