'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Card, Label, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { PriorityBadge, StatusBadge } from '@/components/ui/status-badge';
import { apiFetch } from '@/lib/api-client';
import { formatDateTime } from '@/lib/time';

interface AlertItem {
  alertId: string;
  alertCode: string;
  priority: string;
  status: string;
  residentName: string | null;
  escalatedToName: string | null;
  message: string;
  createdAt: string;
  actions: { actionId: string; action: string; note: string; userName: string; createdAt: string }[];
}

export default function AlertsPage() {
  const { csrfToken } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [resolveTarget, setResolveTarget] = useState<AlertItem | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setAlerts(d.alerts || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (statusFilter === 'ACTIVE' && a.status === 'Resolved') return false;
      if (statusFilter !== 'ACTIVE' && statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && a.priority !== priorityFilter) return false;
      return true;
    });
  }, [alerts, priorityFilter, statusFilter]);

  async function submitAction(alertId: string, action: 'Acknowledged' | 'Resolved', note: string) {
    setBusy(true);
    try {
      const { ok, data } = await apiFetch('/api/alerts', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify({ alertId, action, note }),
      });
      if (!ok) {
        toast.error(data.error || 'Could not update alert.');
        return false;
      }
      toast.success(`Alert marked ${action}.`);
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[var(--cm-text)]">Alerts &amp; Escalations</h1>
        <p className="text-[15px] text-[var(--cm-muted)] mt-0.5">
          Acknowledge and resolve clinical or stock alerts with a complete, timestamped action trail.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter alerts by status">
            <option value="ACTIVE">Open, Acknowledged &amp; Escalated</option>
            <option value="ALL">All Alerts ({alerts.length})</option>
            <option value="Open">Open only</option>
            <option value="Escalated">Escalated only</option>
            <option value="Resolved">Resolved</option>
          </Select>
          <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label="Filter alerts by priority">
            <option value="ALL">All Priorities</option>
            <option value="High">High Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="Low">Low Priority</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-28" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Bell className="h-8 w-8 text-[var(--cm-muted)] mx-auto mb-2" />
          <p className="text-[16px] font-semibold">No alerts match your filters</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Card key={a.alertId} className="space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={a.priority} />
                    <StatusBadge
                      tone={
                        a.status === 'Resolved'
                          ? 'success'
                          : a.status === 'Escalated'
                            ? 'danger'
                            : a.status === 'Acknowledged'
                              ? 'info'
                              : 'warning'
                      }
                      label={a.status}
                    />
                    <span className="font-mono text-[12px] text-[var(--cm-muted)]">{a.alertCode}</span>
                    {a.residentName && <span className="text-[14px] font-semibold">{a.residentName}</span>}
                  </div>
                  <p className="text-[16px] font-medium text-[var(--cm-text)]">{a.message}</p>
                  <p className="text-[13px] text-[var(--cm-muted)] tabular-nums">
                    Raised {formatDateTime(a.createdAt)}
                    {a.escalatedToName ? ` · Escalated to ${a.escalatedToName}` : ''}
                  </p>
                </div>

                {a.status !== 'Resolved' && (
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {a.status === 'Open' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => void submitAction(a.alertId, 'Acknowledged', 'Acknowledged for follow-up')}
                      >
                        <Eye className="h-4 w-4" />
                        Acknowledge
                      </Button>
                    )}
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setResolveTarget(a);
                        setResolveNote('');
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Resolve
                    </Button>
                  </div>
                )}
              </div>

              {a.actions.length > 0 && (
                <div className="pt-2.5 border-t border-[var(--cm-border)] space-y-1">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--cm-muted)]">
                    Action History
                  </p>
                  {a.actions.map((act) => (
                    <p key={act.actionId} className="text-[13px] text-[var(--cm-muted)]">
                      <strong className="text-[var(--cm-text)]">{act.action}</strong> by {act.userName} ({formatDateTime(act.createdAt)}): {act.note}
                    </p>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(resolveTarget)} onOpenChange={(o) => !o && setResolveTarget(null)}>
        <DialogContent
          title="Resolve Alert"
          description="Document the clinical or inventory action taken to resolve this alert."
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!resolveTarget) return;
              void submitAction(resolveTarget.alertId, 'Resolved', resolveNote).then((ok) => {
                if (ok) {
                  setResolveTarget(null);
                  setResolveNote('');
                }
              });
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="resolveNote">Resolution Note</Label>
              <Textarea
                id="resolveNote"
                required
                minLength={3}
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="Describe how the alert was resolved..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setResolveTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Confirm Resolution
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
