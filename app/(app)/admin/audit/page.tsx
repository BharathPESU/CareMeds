'use client';

import React, { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Card, Select, Skeleton } from '@/components/ui/primitives';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDateTime } from '@/lib/time';

interface AuditEntry {
  auditId: number;
  userId: string | null;
  userName: string;
  action: string;
  tableName: string;
  recordId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  createdAt: string;
}

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [users, setUsers] = useState<{ userId: string; fullName: string; role: string }[]>([]);
  const [tableFilter, setTableFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const qs = new URLSearchParams();
    if (tableFilter) qs.set('table', tableFilter);
    if (userFilter) qs.set('userId', userFilter);
    fetch(`/api/admin/audit?${qs.toString()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!active || !d) return;
        setEntries(d.entries || []);
        setTables(d.tables || []);
        setUsers(d.users || []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tableFilter, userFilter]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[var(--cm-text)]">
          Append-Only Audit Log
        </h1>
        <p className="text-[15px] text-[var(--cm-muted)] mt-0.5">
          Immutable, chronologically sequenced trail of all sensitive medication, inventory, resident, and access operations.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select value={tableFilter} onChange={(e) => setTableFilter(e.target.value)} aria-label="Filter audit log by table">
            <option value="">All tables</option>
            {tables.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <Select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} aria-label="Filter audit log by staff user">
            <option value="">All staff members</option>
            {users.map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.fullName} ({u.role})
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <Skeleton className="h-72" />
      ) : entries.length === 0 ? (
        <Card className="p-10 text-center">
          <ScrollText className="h-8 w-8 text-[var(--cm-muted)] mx-auto mb-2" />
          <p className="text-[16px] font-semibold">No audit entries match these filters</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-[var(--cm-border)] bg-[var(--cm-surface-subtle)] text-[var(--cm-muted)]">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Table</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--cm-border)]">
                {entries.map((entry) => (
                  <tr key={entry.auditId} className="align-top">
                    <td className="py-3 px-4 font-mono tabular-nums text-[var(--cm-muted)]">
                      {entry.auditId}
                    </td>
                    <td className="py-3 px-4 tabular-nums whitespace-nowrap">
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td className="py-3 px-4 font-medium">{entry.userName}</td>
                    <td className="py-3 px-4">
                      <StatusBadge
                        tone={
                          entry.action.includes('DELETE') || entry.action === 'ARCHIVE' || entry.action === 'DEACTIVATE'
                            ? 'danger'
                            : entry.action === 'INSERT'
                              ? 'success'
                              : 'info'
                        }
                        label={entry.action}
                      />
                    </td>
                    <td className="py-3 px-4 font-mono text-[13px]">{entry.tableName}</td>
                    <td className="py-3 px-4 font-mono text-[12px] text-[var(--cm-muted)] max-w-md break-words">
                      {entry.newValues ? JSON.stringify(entry.newValues) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
