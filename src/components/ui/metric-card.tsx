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

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  status,
  className,
}: MetricCardProps) {
  // Dynamically size value text so long names/dates fit cleanly without oversized wrapping
  const getValueSizeClass = (val: string) => {
    if (val.length > 20) return 'text-sm font-semibold';
    if (val.length > 14) return 'text-base font-bold';
    if (val.length > 9) return 'text-xl font-bold';
    return 'text-2xl font-bold';
  };

  return (
    <Card className={`flex flex-col justify-between p-4 transition-all hover:border-border-strong hover:shadow-sm ${className ?? ''}`}>
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-text-muted">
            {label}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {status ? <Badge variant="neutral">{status}</Badge> : null}
            {Icon ? (
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
            ) : null}
          </div>
        </div>

        <p className={`mt-2.5 ${getValueSizeClass(value)} tracking-tight text-text-primary leading-tight`}>
          {value}
        </p>
      </div>

      {description ? (
        <p className="mt-2 truncate text-xs text-text-muted">
          {description}
        </p>
      ) : null}
    </Card>
  );
}

