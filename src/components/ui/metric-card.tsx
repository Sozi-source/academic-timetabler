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
  icon: Icon,
  status,
}: MetricCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-primary/10">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {status ? <Badge variant="neutral">{status}</Badge> : null}
      </div>

      <p className="mt-4 text-2xl font-semibold tracking-tight text-text-primary">
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-text-secondary">{label}</p>
    </Card>
  );
}
