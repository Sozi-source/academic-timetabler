import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

interface SectionHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-1.5 shrink-0 overflow-hidden rounded-full bg-primary" aria-hidden="true">
          <span className="mt-auto h-3 w-full bg-institutional-yellow" />
        </span>

        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-primary">
              {eyebrow}
            </p>
          ) : null}

          <h2 className="mt-0.5 text-base font-semibold text-text-primary">
            {title}
          </h2>

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
    </header>
  );
}
