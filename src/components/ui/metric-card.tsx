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
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon
            className="size-4"
            aria-hidden="true"
          />
        </div>

        {status ? (
          <Badge variant="neutral">{status}</Badge>
        ) : null}
      </div>

      <p className="mt-4 text-2xl font-semibold tracking-tight text-text-primary">
        {value}
      </p>

      <p className="mt-1 text-sm font-semibold text-text-primary">
        {label}
      </p>

      <p className="mt-1 text-xs leading-5 text-text-muted">
        {description}
      </p>
    </Card>
  );
}