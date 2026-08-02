import type {
  LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

type AlertVariant =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

interface AlertProps {
  title?: string;
  children: ReactNode;
  icon?: LucideIcon;
  variant?: AlertVariant;
  className?: string;
}

const variantClasses: Record<
  AlertVariant,
  string
> = {
  neutral:
    'border-border bg-surface-subtle text-text-secondary',
  success:
    'border-success-border bg-success-surface text-success',
  warning:
    'border-warning-border bg-warning-surface text-warning',
  danger:
    'border-danger-border bg-danger-surface text-danger',
  info:
    'border-info-border bg-info-surface text-info',
};

export function Alert({
  title,
  children,
  icon: Icon,
  variant = 'neutral',
  className,
}: AlertProps) {
  return (
    <div
      role={
        variant === 'danger'
          ? 'alert'
          : 'status'
      }
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
        variantClasses[variant],
        className,
      )}
    >
      {Icon ? (
        <Icon
          className="mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
      ) : null}

      <div className="min-w-0">
        {title ? (
          <p className="font-semibold text-text-primary">
            {title}
          </p>
        ) : null}

        <div
          className={cn(
            'leading-6',
            title && 'mt-1',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}