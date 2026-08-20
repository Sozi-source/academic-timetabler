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
          <h2 className="text-base font-semibold text-text-primary">
            {title}
          </h2>
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
