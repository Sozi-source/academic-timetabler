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
    value.length > 20 ? 'text-[0.72rem] font-semibold leading-tight' :
    value.length > 14 ? 'text-sm font-bold leading-tight' :
    value.length > 9 ? 'text-lg font-bold leading-none' :
    'text-[1.7rem] font-bold leading-none';

  return (
    <Card
      className={`admin-metric-card group flex min-w-0 min-h-[6.9rem] flex-col justify-between p-3.5 sm:min-h-[7.25rem] sm:p-4 ${className ?? ''}`}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="min-w-0 truncate text-[0.64rem] font-bold uppercase tracking-[0.075em] text-text-muted">
            {label}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {status ? <Badge variant="neutral">{status}</Badge> : null}
            {Icon ? (
              <span className="admin-metric-icon flex size-7 shrink-0 items-center justify-center rounded-[0.6rem] border border-primary/10 bg-primary-soft text-primary">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
            ) : null}
          </div>
        </div>
        <p className={`mt-3 break-words tracking-tight text-text-primary ${valueClass}`}>{value}</p>
      </div>
      {description ? (
        <p className="mt-2 line-clamp-2 text-[0.65rem] leading-[1.35] text-text-muted">{description}</p>
      ) : null}
    </Card>
  );
}
