'use client';

import * as React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  PauseCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE_STYLES: Record<StatusTone, string> = {
  success: 'bg-[var(--cm-success-bg)] text-[var(--cm-success)]',
  warning: 'bg-[var(--cm-warning-bg)] text-[var(--cm-warning)]',
  danger: 'bg-[var(--cm-danger-bg)] text-[var(--cm-danger)]',
  info: 'bg-[var(--cm-info-bg)] text-[var(--cm-info)]',
  neutral: 'bg-[var(--cm-surface-subtle)] text-[var(--cm-muted)]',
};

const TONE_ICONS: Record<StatusTone, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
  info: Info,
  neutral: Clock,
};

/**
 * CareMeds Principle #5: Status NEVER depends on colour alone.
 * Every status renders colour + icon + text label together.
 */
export function StatusBadge({
  tone,
  label,
  icon: CustomIcon,
  className,
}: {
  tone: StatusTone;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const Icon = CustomIcon || TONE_ICONS[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[14px] font-medium whitespace-nowrap shrink-0',
        TONE_STYLES[tone],
        className
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function DoseStatusBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  if (overdue && status === 'Pending') {
    return <StatusBadge tone="danger" label="Overdue" icon={AlertCircle} />;
  }
  switch (status) {
    case 'Taken':
      return <StatusBadge tone="success" label="Taken" icon={CheckCircle2} />;
    case 'Refused':
      return <StatusBadge tone="warning" label="Refused" icon={XCircle} />;
    case 'Missed':
      return <StatusBadge tone="danger" label="Missed" icon={AlertCircle} />;
    case 'Held':
      return <StatusBadge tone="warning" label="Held" icon={PauseCircle} />;
    default:
      return <StatusBadge tone="info" label="Pending" icon={Clock} />;
  }
}

export function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'High') {
    return <StatusBadge tone="danger" label="High Priority" icon={AlertCircle} />;
  }
  if (priority === 'Medium') {
    return <StatusBadge tone="warning" label="Medium Priority" icon={AlertTriangle} />;
  }
  return <StatusBadge tone="info" label="Low Priority" icon={Info} />;
}
