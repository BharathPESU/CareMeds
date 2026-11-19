'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  History,
  KeyRound,
  LockOpen,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Card, Input, Label, Select, Skeleton } from '@/components/ui/primitives';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiFetch } from '@/lib/api-client';
import { formatDate, formatDateTime } from '@/lib/time';
import type { RoleName, SafeUser } from '@/lib/types';

interface AdminUsersResponse {
  users: SafeUser[];
  loginHistory: {
    loginId: string;
    attemptedUsername: string;
    attemptedAt: string;
    succeeded: boolean;
    ipAddress: string | null;
  }[];
  credentialExports: {
    exportId: string;
    targetName: string;
    exportedByName: string;
    exportedAt: string;
  }[];
  assignments: {
    assignmentId: string;
    caretakerName: string;
    residentName: string;
    assignedByName: string;
    assignedAt: string;
    endedAt: string | null;
    endedByName: string | null;
  }[];
}

export default function AdminUsersPage() {
  const { csrfToken } = useAuth();
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'users' | 'logins' | 'assignments'>('users');
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    role: 'Doctor' as RoleName,
    username: '',
    password: '',
    email: '',
    phone: '',
  });
  const [createdBannerUser, setCreatedBannerUser] = useState<SafeUser | null>(null);
  const [downloadedOnceIds, setDownloadedOnceIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { ok, data: resp } = await apiFetch<{ user?: SafeUser }>('/api/admin/users', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify(form),
      });
      if (!ok) {
        toast.error(resp.error || 'Could not create staff account.');
        return;
      }
      toast.success(`Created ${resp.user?.role} account: ${resp.user?.username}`);
      setCreatedBannerUser(resp.user || null);
      setShowAdd(false);
      setForm({ fullName: '', role: 'Doctor', username: '', password: '', email: '', phone: '' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleUserOp(userId: string, operation: 'reset_password' | 'unlock' | 'deactivate' | 'reactivate') {
    setBusy(true);
    try {
      const { ok, data: resp } = await apiFetch<{ user?: SafeUser }>('/api/admin/users', {
        method: 'PATCH',
        csrfToken,
        body: JSON.stringify({ userId, operation }),
      });
      if (!ok) {
        toast.error(resp.error || 'Operation failed.');
        return;
      }
      if (operation === 'reset_password' && resp.user) {
        setCreatedBannerUser(resp.user);
        toast.success('Temporary password generated. Download the one-time Credential .txt file.');
      } else {
        toast.success(`User updated (${operation.replace('_', ' ')}).`);
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadCredentials(target: SafeUser) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${target.userId}/credentials`, { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Credential file is no longer available.');
        await load();
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `caremeds-credentials-${target.username}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setDownloadedOnceIds((prev) => new Set(prev).add(target.userId));
      if (createdBannerUser?.userId === target.userId) {
        setCreatedBannerUser(null);
      }
      toast.success('Credentials downloaded as .txt file. You can now send this file to the staff member.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--cm-text)]">
            Staff &amp; Access Management
          </h1>
          <p className="text-[15px] text-[var(--cm-muted)] mt-0.5">
            Create Doctor and Caretaker accounts, download login credentials in .txt format, and manage staff access.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <UserPlus className="h-4 w-4" />
          Add Staff Account
        </Button>
      </div>

      {createdBannerUser && (
        <div className="rounded-[18px] border border-[var(--cm-primary)] bg-[var(--cm-surface)] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[16px] font-semibold text-[var(--cm-primary)] inline-flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Login Credentials Ready for {createdBannerUser.fullName}
            </p>
            <p className="text-[14px] text-[var(--cm-muted)]">
              Username: <code className="font-mono font-semibold text-[var(--cm-text)]">{createdBannerUser.username}</code> ({createdBannerUser.role}). Download the credentials .txt file below and send it to the staff member.
            </p>
          </div>
          <Button
            onClick={() => void handleDownloadCredentials(createdBannerUser)}
            disabled={busy || downloadedOnceIds.has(createdBannerUser.userId)}
          >
            <Download className="h-4 w-4" />
            Download Credentials (.txt)
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant={tab === 'users' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('users')}>
          <Users className="h-4 w-4" />
          Staff Accounts ({data.users.length})
        </Button>
        <Button variant={tab === 'logins' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('logins')}>
          <History className="h-4 w-4" />
          Login History ({data.loginHistory.length})
        </Button>
        <Button variant={tab === 'assignments' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('assignments')}>
          <UserCheck className="h-4 w-4" />
          Caretaker Assignments ({data.assignments.length})
        </Button>
      </div>

      {tab === 'users' && (
        <div className="space-y-3">
          {data.users.map((u) => {
            const canDownloadCsv = u.hasPendingCredentialExport && !downloadedOnceIds.has(u.userId);
            return (
              <Card key={u.userId}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[17px] font-semibold">{u.fullName}</h2>
                      <code className="font-mono text-[13px] bg-[var(--cm-surface-subtle)] px-2 py-0.5 rounded-[6px]">
                        {u.username}
                      </code>
                      <StatusBadge tone="info" label={u.role} />
                      <StatusBadge
                        tone={u.isActive ? 'success' : 'neutral'}
                        label={u.isActive ? 'Active' : 'Deactivated'}
                      />
                      {u.isLocked && <StatusBadge tone="danger" label="Locked" />}
                      {u.mfaEnabled && <StatusBadge tone="success" label="MFA On" icon={ShieldCheck} />}
                    </div>
                    <p className="text-[13px] text-[var(--cm-muted)]">
                      {u.email || 'No email'} · {u.phone || 'No phone'} · Created {formatDate(u.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {canDownloadCsv && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleDownloadCredentials(u)}
                      >
                        <Download className="h-4 w-4" />
                        Credential CSV
                      </Button>
                    )}
                    {u.isLocked && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleUserOp(u.userId, 'unlock')}
                      >
                        <LockOpen className="h-4 w-4" />
                        Unlock
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleUserOp(u.userId, 'reset_password')}
                    >
                      <KeyRound className="h-4 w-4" />
                      Reset Password
                    </Button>
                    {u.isActive ? (
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleUserOp(u.userId, 'deactivate')}
                      >
                        <UserMinus className="h-4 w-4" />
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleUserOp(u.userId, 'reactivate')}
                      >
                        Reactivate
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'logins' && (
        <Card>
          <h2 className="text-[18px] font-semibold mb-3">Recent Sign-In Attempts</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px] tabular-nums">
              <thead>
                <tr className="border-b border-[var(--cm-border)] text-[var(--cm-muted)]">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Username</th>
                  <th className="py-2 pr-3">IP Address</th>
                  <th className="py-2">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--cm-border)]">
                {data.loginHistory.map((h) => (
                  <tr key={h.loginId}>
                    <td className="py-2.5 pr-3">{formatDateTime(h.attemptedAt)}</td>
                    <td className="py-2.5 pr-3 font-mono">{h.attemptedUsername}</td>
                    <td className="py-2.5 pr-3 text-[var(--cm-muted)]">{h.ipAddress || '—'}</td>
                    <td className="py-2.5">
                      <StatusBadge tone={h.succeeded ? 'success' : 'danger'} label={h.succeeded ? 'Succeeded' : 'Failed'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'assignments' && (
        <Card>
          <h2 className="text-[18px] font-semibold mb-3">Caretaker Assignment History</h2>
          <p className="text-[14px] text-[var(--cm-muted)] mb-3">
            Assignments are preserved permanently for clinical accountability; ending an assignment records an end timestamp.
          </p>
          <div className="divide-y divide-[var(--cm-border)] text-[14px]">
            {data.assignments.map((a) => (
              <div key={a.assignmentId} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {a.caretakerName} → {a.residentName}
                  </p>
                  <p className="text-[13px] text-[var(--cm-muted)] tabular-nums">
                    Assigned {formatDate(a.assignedAt)} by {a.assignedByName}
                    {a.endedAt ? ` · Ended ${formatDate(a.endedAt)} by ${a.endedByName || 'Staff'}` : ''}
                  </p>
                </div>
                <StatusBadge tone={a.endedAt ? 'neutral' : 'success'} label={a.endedAt ? 'Ended' : 'Active'} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent
          title="Create Staff Account"
          description="Create Doctor and Caretaker accounts. You can specify custom credentials or leave them blank to auto-generate. Credentials can be downloaded immediately as a .txt file."
        >
          <form onSubmit={handleCreateUser} className="space-y-3.5">
            <div>
              <Label htmlFor="stName">Full Name</Label>
              <Input id="stName" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Dr. Kavita Rao" />
            </div>
            <div>
              <Label htmlFor="stRole">Role</Label>
              <Select id="stRole" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as RoleName })}>
                <option value="Doctor">Doctor</option>
                <option value="Caretaker">Caretaker</option>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="stUsername">Username (optional)</Label>
                <Input
                  id="stUsername"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="e.g. kavita.rao"
                />
              </div>
              <div>
                <Label htmlFor="stPassword">Password (optional)</Label>
                <Input
                  id="stPassword"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Auto-generated if empty"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="stEmail">Email (optional)</Label>
                <Input id="stEmail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="stPhone">Phone (optional)</Label>
                <Input id="stPhone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>
                <UserPlus className="h-4 w-4" />
                {busy ? 'Creating...' : 'Create Account'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
