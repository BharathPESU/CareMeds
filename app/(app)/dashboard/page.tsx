'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Package,
  Pill,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Card, Skeleton } from '@/components/ui/primitives';
import { DoseStatusBadge, PriorityBadge, StatusBadge } from '@/components/ui/status-badge';
import { formatDateTime } from '@/lib/time';

interface DashboardData {
  role: 'Admin' | 'Caretaker' | 'Doctor';
  residentCount: number;
  activePrescriptions: number;
  shiftSummary: {
    total: number;
    taken: number;
    pending: number;
    overdue: number;
    refused: number;
    missed: number;
    held: number;
  };
  openAlertsCount: number;
  highAlertsCount: number;
  pendingStockApprovals: number;
  pendingMedicineApprovals: number;
  renewalsDue: number;
  lowStockCount: number;
  expiringSoonCount: number;
  adherenceSeries: { day: string; taken: number; missed: number; refused: number; rate: number }[];
  upcomingRounds: {
    doseEventId: string;
    scheduledAt: string;
    overdue: boolean;
    residentId: string;
    residentName: string;
    roomLabel: string;
    medicineName: string;
    doseLabel: string;
  }[];
  recentAlerts: {
    alertId: string;
    alertCode: string;
    priority: string;
    status: string;
    message: string;
    createdAt: string;
  }[];
  vitalThresholdsConfigured: boolean;
}

export default function DashboardPage() {
  const { user, facility } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
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

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const completionPct =
    data.shiftSummary.total > 0
      ? Math.round((data.shiftSummary.taken / data.shiftSummary.total) * 100)
      : 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[14px] font-medium text-[var(--cm-muted)]">
            {facility?.name || 'Residential Care Home'} · {data.role} View
          </p>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--cm-text)] mt-0.5">
            Welcome back, {user?.fullName.split(' ')[0]}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {data.role === 'Caretaker' && (
            <Link href="/rounds">
              <Button size="md">
                <ClipboardCheck className="h-4 w-4" />
                Open Today’s Rounds
              </Button>
            </Link>
          )}
          {data.role === 'Doctor' && (
            <Link href="/prescriptions">
              <Button size="md">
                <FileText className="h-4 w-4" />
                Manage Prescriptions
              </Button>
            </Link>
          )}
          {data.role === 'Admin' && (
            <Link href="/inventory">
              <Button size="md">
                <Package className="h-4 w-4" />
                Review Inventory &amp; Approvals
              </Button>
            </Link>
          )}
        </div>
      </div>

      {!data.vitalThresholdsConfigured && (data.role === 'Doctor' || data.role === 'Admin') && (
        <div className="rounded-[16px] border border-[var(--cm-border)] bg-[var(--cm-warning-bg)] text-[var(--cm-warning)] px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-[14px] font-medium">
              Clinical vital-sign thresholds are currently unset. Abnormal-vital alerts will activate once a Doctor enters facility normal ranges.
            </p>
          </div>
          <Link href="/admin/settings" className="shrink-0">
            <Button variant="secondary" size="sm">
              Configure Thresholds
            </Button>
          </Link>
        </div>
      )}

      {/* Role-Tailored KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between text-[var(--cm-muted)]">
            <span className="text-[14px] font-medium">
              {data.role === 'Caretaker' ? 'Assigned Residents' : data.role === 'Doctor' ? 'My Residents' : 'Active Residents'}
            </span>
            <Users className="h-5 w-5 text-[var(--cm-primary)]" />
          </div>
          <p className="mt-2 text-[32px] font-bold tabular-nums text-[var(--cm-text)]">
            {data.residentCount}
          </p>
          <p className="text-[13px] text-[var(--cm-muted)] mt-1">
            {data.activePrescriptions} active prescriptions
          </p>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-[var(--cm-muted)]">
            <span className="text-[14px] font-medium">Today’s Shift Progress</span>
            <CheckCircle2 className="h-5 w-5 text-[var(--cm-success)]" />
          </div>
          <p className="mt-2 text-[32px] font-bold tabular-nums text-[var(--cm-text)]">
            {data.shiftSummary.taken}
            <span className="text-[18px] font-medium text-[var(--cm-muted)]">
              /{data.shiftSummary.total}
            </span>
          </p>
          <p className="text-[13px] text-[var(--cm-muted)] mt-1 tabular-nums">
            {completionPct}% taken · {data.shiftSummary.overdue} overdue
          </p>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-[var(--cm-muted)]">
            <span className="text-[14px] font-medium">Open Clinical Alerts</span>
            <Bell className="h-5 w-5 text-[var(--cm-danger)]" />
          </div>
          <p className="mt-2 text-[32px] font-bold tabular-nums text-[var(--cm-text)]">
            {data.openAlertsCount}
          </p>
          <p className="text-[13px] text-[var(--cm-muted)] mt-1 tabular-nums">
            {data.highAlertsCount} high priority requiring action
          </p>
        </Card>

        {data.role === 'Admin' ? (
          <Card>
            <div className="flex items-center justify-between text-[var(--cm-muted)]">
              <span className="text-[14px] font-medium">Pending Approvals</span>
              <Package className="h-5 w-5 text-[var(--cm-warning)]" />
            </div>
            <p className="mt-2 text-[32px] font-bold tabular-nums text-[var(--cm-text)]">
              {data.pendingStockApprovals + data.pendingMedicineApprovals}
            </p>
            <p className="text-[13px] text-[var(--cm-muted)] mt-1 tabular-nums">
              {data.pendingStockApprovals} stock · {data.pendingMedicineApprovals} medicines
            </p>
          </Card>
        ) : data.role === 'Doctor' ? (
          <Card>
            <div className="flex items-center justify-between text-[var(--cm-muted)]">
              <span className="text-[14px] font-medium">Renewals Due Soon</span>
              <Pill className="h-5 w-5 text-[var(--cm-warning)]" />
            </div>
            <p className="mt-2 text-[32px] font-bold tabular-nums text-[var(--cm-text)]">
              {data.renewalsDue}
            </p>
            <p className="text-[13px] text-[var(--cm-muted)] mt-1">
              Expiring within facility reminder window
            </p>
          </Card>
        ) : (
          <Card>
            <div className="flex items-center justify-between text-[var(--cm-muted)]">
              <span className="text-[14px] font-medium">Stock Attention</span>
              <Package className="h-5 w-5 text-[var(--cm-warning)]" />
            </div>
            <p className="mt-2 text-[32px] font-bold tabular-nums text-[var(--cm-text)]">
              {data.lowStockCount + data.expiringSoonCount}
            </p>
            <p className="text-[13px] text-[var(--cm-muted)] mt-1 tabular-nums">
              {data.lowStockCount} low stock · {data.expiringSoonCount} expiring soon
            </p>
          </Card>
        )}
      </div>

      {/* Main Content Split: Upcoming Rounds & 7-Day Adherence Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-[20px] font-semibold text-[var(--cm-text)]">
                Upcoming &amp; Overdue Doses
              </h2>
              <p className="text-[14px] text-[var(--cm-muted)]">
                Next scheduled administrations sorted by due time
              </p>
            </div>
            <Link href="/rounds">
              <Button variant="ghost" size="sm">
                Full Rounds
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {data.upcomingRounds.length === 0 ? (
            <div className="rounded-[16px] bg-[var(--cm-surface-subtle)] p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-[var(--cm-success)] mx-auto mb-2" />
              <p className="text-[16px] font-semibold">All scheduled doses completed</p>
              <p className="text-[14px] text-[var(--cm-muted)] mt-1">
                No pending medication administrations remain for this shift.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--cm-border)]">
              {data.upcomingRounds.map((item) => (
                <div
                  key={item.doseEventId}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/residents/${item.residentId}`}
                        className="text-[16px] font-semibold text-[var(--cm-text)] hover:text-[var(--cm-primary)]"
                      >
                        {item.residentName}
                      </Link>
                      <span className="text-[13px] text-[var(--cm-muted)]">{item.roomLabel}</span>
                    </div>
                    <p className="text-[14px] text-[var(--cm-muted)] mt-0.5">
                      <span className="font-medium text-[var(--cm-text)]">{item.medicineName}</span> · {item.doseLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[14px] font-medium tabular-nums text-[var(--cm-muted)] inline-flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {formatDateTime(item.scheduledAt)}
                    </span>
                    <DoseStatusBadge status="Pending" overdue={item.overdue} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[20px] font-semibold text-[var(--cm-text)]">7-Day Adherence</h2>
              <p className="text-[14px] text-[var(--cm-muted)]">Taken vs missed/overdue doses</p>
            </div>
            <Activity className="h-5 w-5 text-[var(--cm-primary)]" />
          </div>
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.adherenceSeries} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cm-border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: 'var(--cm-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--cm-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--cm-surface)',
                    borderColor: 'var(--cm-border)',
                    borderRadius: 12,
                    color: 'var(--cm-text)',
                  }}
                />
                <Bar dataKey="taken" name="Taken" fill="var(--cm-primary)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="missed" name="Missed/Overdue" fill="var(--cm-danger)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--cm-border)] flex items-center justify-between text-[13px] text-[var(--cm-muted)]">
            <span>
              Refused: <strong className="tabular-nums text-[var(--cm-text)]">{data.shiftSummary.refused}</strong> · Held:{' '}
              <strong className="tabular-nums text-[var(--cm-text)]">{data.shiftSummary.held}</strong>
            </span>
            <Link href="/reports" className="text-[var(--cm-primary)] font-medium hover:underline">
              Reports
            </Link>
          </div>
        </Card>
      </div>

      {/* Open Alerts Panel */}
      <Card>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-[20px] font-semibold text-[var(--cm-text)]">Active Alerts</h2>
            <p className="text-[14px] text-[var(--cm-muted)]">
              Latest open or escalated items scoped to your role
            </p>
          </div>
          <Link href="/alerts">
            <Button variant="ghost" size="sm">
              View All Alerts
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        {data.recentAlerts.length === 0 ? (
          <div className="rounded-[14px] bg-[var(--cm-surface-subtle)] p-6 text-center text-[14px] text-[var(--cm-muted)]">
            No open alerts at this moment.
          </div>
        ) : (
          <div className="space-y-3">
            {data.recentAlerts.map((alert) => (
              <div
                key={alert.alertId}
                className="rounded-[14px] border border-[var(--cm-border)] bg-[var(--cm-surface-subtle)]/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={alert.priority} />
                    <StatusBadge
                      tone={alert.status === 'Escalated' ? 'danger' : alert.status === 'Acknowledged' ? 'info' : 'warning'}
                      label={alert.status}
                    />
                    <span className="text-[12px] font-mono text-[var(--cm-muted)]">{alert.alertCode}</span>
                  </div>
                  <p className="text-[15px] text-[var(--cm-text)] font-medium">{alert.message}</p>
                </div>
                <span className="text-[13px] text-[var(--cm-muted)] shrink-0 tabular-nums">
                  {formatDateTime(alert.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
