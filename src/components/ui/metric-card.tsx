import type { LucideIcon } from 'lucide-react';

import { Badge } from './badge';
import { Card } from './card';

interface MetricCardProps {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  status?: string;
}

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  status,
}: MetricCardProps) {
  return (
    <Card className="relative p-4 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-institutional-yellow">
      <div className="flex items-start justify-between gap-4 pl-1">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-white shadow-sm ring-1 ring-primary/10">
          <Icon className="size-4" aria-hidden="true" />
        </div>

        {status ? (
          <Badge variant="neutral">{status}</Badge>
        ) : null}
      </div>

      <div className="mt-4 pl-1">
        <p className="text-2xl font-semibold tracking-tight text-text-primary">
          {value}
        </p>
        <div className="mt-1 h-1 w-8 rounded-full bg-institutional-yellow" aria-hidden="true" />
      </div>

      <p className="mt-2 pl-1 text-sm font-semibold text-text-primary">
        {label}
      </p>

      <p className="mt-1 pl-1 text-xs leading-5 text-text-muted">
        {description}
      </p>
    </Card>
  );
}
