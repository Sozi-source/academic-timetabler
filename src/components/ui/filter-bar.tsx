import {
  SlidersHorizontal,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

interface FilterBarProps {
  children: ReactNode;
  actions?: ReactNode;
  title?: string;
  className?: string;
}

export function FilterBar({
  children,
  actions,
  title = 'Filters',
  className,
}: FilterBarProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-surface-subtle p-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 px-1 text-xs font-semibold text-text-muted">
          <SlidersHorizontal
            className="size-3.5"
            aria-hidden="true"
          />
          {title}
        </div>

        {children}
      </div>

      {actions ? (
        <div className="flex shrink-0 items-center gap-2">
          {actions}
        </div>
      ) : null}
    </section>
  );
}