import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  context?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  context,
}: PageHeaderProps) {
  return (
    <header className="relative overflow-hidden rounded-xl border border-border bg-surface px-4 py-4 shadow-sm sm:px-5">
      <div
        className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-institutional-maroon via-institutional-gold to-primary"
        aria-hidden="true"
      />

      {context ? <div className="mb-3">{context}</div> : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </span>
          ) : null}

          <div className="min-w-0">
            {eyebrow ? (
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                <span className="size-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                {eyebrow}
              </p>
            ) : null}

            <h1
              className={cn(
                'text-xl font-bold tracking-tight text-text-primary sm:text-2xl',
                eyebrow && 'mt-1',
              )}
            >
              {title}
            </h1>

            {description ? (
              <p className="mt-1 max-w-2xl text-sm leading-5 text-text-secondary">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
