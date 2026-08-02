import type { LucideIcon } from 'lucide-react';

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
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon
            className="size-5"
            aria-hidden="true"
          />
        </div>

        {status ? (
          <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-[0.6875rem] font-semibold text-text-muted">
            {status}
          </span>
        ) : null}
      </div>

      <p className="mt-5 text-2xl font-semibold tracking-tight text-text-primary">
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