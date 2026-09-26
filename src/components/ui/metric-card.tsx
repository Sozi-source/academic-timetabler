import type { LucideIcon } from 'lucide-react';

import { Badge } from './badge';
import { Card } from './card';

interface MetricCardProps {
  label: string;
  value: string;
  description?: string;
  icon?: LucideIcon;
  status?: string;
  className?: string;
}

export function MetricCard({ label, value, description, icon: Icon, status, className }: MetricCardProps) {
  const valueClass =
    value.length > 20 ? 'text-[0.75rem] font-semibold leading-tight' :
    value.length > 14 ? 'text-xs sm:text-sm font-semibold leading-tight' :
    value.length > 9 ? 'text-sm sm:text-base font-semibold leading-none' :
    'text-lg sm:text-[1.65rem] font-semibold leading-none';

  return (
    <Card
      className={`admin-metric-card group flex min-w-0 min-h-[5.25rem] flex-col justify-between p-2.5 sm:min-h-[6.75rem] sm:p-3.5 ${className ?? ''}`}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-1.5 sm:gap-2">
          <p className="min-w-0 truncate text-[0.625rem] sm:text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-text-secondary">
            {label}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {status ? <Badge variant="neutral">{status}</Badge> : null}
            {Icon ? (
              <span className="admin-metric-icon flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary-soft text-primary">
                <Icon className="size-3 sm:size-3.5" aria-hidden="true" />
              </span>
            ) : null}
          </div>
        </div>
        <p className={`mt-1.5 sm:mt-2.5 break-words tabular-nums tracking-tight text-text-primary ${valueClass}`}>{value}</p>
      </div>
      {description ? (
        <p className="mt-1 sm:mt-1.5 truncate sm:line-clamp-2 text-[0.625rem] sm:text-[0.6875rem] leading-[1.3] text-text-muted">{description}</p>
      ) : null}
    </Card>
  );
}
