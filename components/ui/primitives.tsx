import * as React from 'react';
import { cn } from '@/lib/utils';

export function Card({
  className,
  interactive = false,
  selected = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean; selected?: boolean }) {
  return (
    <div
      className={cn(
        'cm-card p-4 md:p-5',
        interactive && 'cm-card-interactive',
        selected && 'cm-card-selected',
        className
      )}
      {...props}
    />
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full min-h-[44px] rounded-[12px] border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3.5 py-2 text-[15px] text-[var(--cm-text)] placeholder:text-[var(--cm-muted)] transition-colors disabled:opacity-60',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full min-h-[88px] rounded-[12px] border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3.5 py-2.5 text-[15px] text-[var(--cm-text)] placeholder:text-[var(--cm-muted)] transition-colors disabled:opacity-60',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'w-full min-h-[44px] rounded-[12px] border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3.5 py-2 text-[15px] text-[var(--cm-text)] transition-colors disabled:opacity-60',
      className
    )}
    {...props}
  />
));
Select.displayName = 'Select';

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('block text-[14px] font-medium text-[var(--cm-text)] mb-1.5', className)}
      {...props}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-[12px] bg-[var(--cm-surface-subtle)]',
        className
      )}
    />
  );
}
