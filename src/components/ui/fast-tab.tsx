'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

interface FastTabProps {
  title: string;
  /** Shown beside the title while the section is collapsed, e.g. "3 units · 2 pending". */
  summary?: ReactNode;
  defaultOpen?: boolean;
  /** Buttons or links shown at the right of the header. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Collapsible form section, modelled on Business Central FastTabs.
 * Stack several on a record page so long forms stay scannable.
 */
export function FastTab({
  title,
  summary,
  defaultOpen = true,
  actions,
  children,
  className,
}: FastTabProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section
      className={cn(
        'rounded-lg border border-border bg-surface shadow-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
        >
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-text-muted transition-transform',
              !open && '-rotate-90',
            )}
            aria-hidden="true"
          />

          <span className="text-sm font-semibold text-primary">
            {title}
          </span>

          {!open && summary ? (
            <span className="min-w-0 truncate text-xs text-text-muted">
              {summary}
            </span>
          ) : null}
        </button>

        {actions ? (
          <div className="flex shrink-0 items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>

      <div
        id={panelId}
        hidden={!open}
        className="border-t border-border-soft px-4 py-4"
      >
        {children}
      </div>
    </section>
  );
}
