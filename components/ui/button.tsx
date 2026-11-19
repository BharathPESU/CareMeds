'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] text-[15px] font-medium transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 min-h-[44px] px-4 py-2 cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--cm-primary)] text-[var(--cm-primary-fg)] hover:bg-[var(--cm-primary-hover)] shadow-xs',
        secondary:
          'bg-[var(--cm-surface)] text-[var(--cm-text)] border border-[var(--cm-border)] hover:bg-[var(--cm-surface-subtle)]',
        ghost:
          'text-[var(--cm-muted)] hover:text-[var(--cm-text)] hover:bg-[var(--cm-surface-subtle)]',
        danger:
          'bg-[#B91C1C] text-white hover:bg-[#991B1B] shadow-xs',
        success:
          'bg-[#15803D] text-white hover:bg-[#166534] shadow-xs',
        warning:
          'bg-[#B45309] text-white hover:bg-[#92400E] shadow-xs',
      },
      size: {
        default: 'min-h-[44px] px-4 py-2',
        md: 'min-h-[44px] px-4 py-2',
        lg: 'min-h-[48px] px-5 py-2.5 text-[16px]',
        sm: 'min-h-[44px] px-3 py-1.5 text-[14px]',
        icon: 'h-[44px] w-[44px] p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
