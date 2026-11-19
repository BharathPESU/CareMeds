'use client';

import React, { useEffect, useState } from 'react';
import { BarChart3, Download, FileSpreadsheet, FileText } from 'lucide-react';
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

interface DashboardReportData {
  adherenceSeries: { day: string; taken: number; missed: number; refused: number; rate: number }[];
  shiftSummary: { total: number; taken: number; pending: number; overdue: number; refused: number; missed: number; held: number };
  residentCount: number;
  lowStockCount: number;
  expiringSoonCount: number;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  const exportSets = [
    {
      key: 'rounds',
      title: 'Medication Rounds & Adherence Log',
      description: 'Scheduled vs administered doses, confirmations, and recorded reasons scoped to your role.',
    },
    {
      key: 'residents',
      title: 'Resident Summary Roster',
      description: 'Active residents, room/bed assignments, blood groups, allergy statuses, and assigned doctors.',
    },
    ...(user?.role !== 'Doctor'
      ? [
          {
            key: 'inventory',
            title: 'Inventory Valuation & Batch Expiry',
            description: 'FEFO batch stock on hand calculated from the stock movement ledger, reorder levels, and expiry dates.',
          },
        ]
      : []),
    ...(user?.role === 'Admin'
      ? [
          {
            key: 'audit',
            title: 'Facility Audit Trail',
            description: 'Append-only audit log of clinical, stock, and user administration changes.',
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[var(--cm-text)]">
          Reports &amp; Clinical Exports
        </h1>
        <p className="text-[15px] text-[var(--cm-muted)] mt-0.5">
          Download role-scoped CSV, formatted Excel (.xlsx), and printable PDF reports directly from live server records.
        </p>
      </div>

      {loading || !data ? (
        <Skeleton className="h-72" />
      ) : (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-[var(--cm-primary)]" />
            <h2 className="text-[20px] font-semibold">7-Day Medication Adherence Rate (%)</h2>
          </div>
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.adherenceSeries} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cm-border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: 'var(--cm-muted)', fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--cm-muted)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--cm-surface)',
                    borderColor: 'var(--cm-border)',
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="rate" name="Adherence %" fill="var(--cm-primary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exportSets.map((set) => (
          <Card key={set.key} className="flex flex-col justify-between gap-4">
            <div>
              <h3 className="text-[18px] font-semibold text-[var(--cm-text)]">{set.title}</h3>
              <p className="text-[14px] text-[var(--cm-muted)] mt-1">{set.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={`/api/exports/csv?dataset=${set.key}`} download>
                <Button variant="secondary" size="sm">
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
              </a>
              <a href={`/api/exports/excel?dataset=${set.key}`} download>
                <Button variant="secondary" size="sm">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel (.xlsx)
                </Button>
              </a>
              <a href={`/api/exports/pdf?dataset=${set.key}`} download>
                <Button variant="secondary" size="sm">
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
              </a>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
