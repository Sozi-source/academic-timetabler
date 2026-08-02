import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

type BadgeVariant =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

const variantClasses: Record<
  BadgeVariant,
  string
> = {
  neutral:
    'border-border bg-surface-subtle text-text-secondary',
  primary:
    'border-border bg-primary-subtle text-primary',
  success:
    'border-success-border bg-success-surface text-success',
  warning:
    'border-warning-border bg-warning-surface text-warning',
  danger:
    'border-danger-border bg-danger-surface text-danger',
  info:
    'border-info-border bg-info-surface text-info',
};

export function Badge({
  children,
  variant = 'neutral',
  dot = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-7 items-center gap-2 rounded-full border px-3 text-xs font-semibold',
        variantClasses[variant],
        className,
      )}
    >
      {dot ? (
        <span
          className="size-1.5 rounded-full bg-current"
          aria-hidden="true"
        />
      ) : null}

      {children}
    </span>
  );
}