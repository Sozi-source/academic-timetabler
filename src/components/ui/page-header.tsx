import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  context?: ReactNode;
}

export function PageHeader({
  title,
  icon: Icon,
  actions,
  context,
}: PageHeaderProps) {
  return (
    <header className="rounded-xl border border-border bg-surface px-4 py-4 shadow-sm sm:px-5">
      {context ? <div className="mb-3">{context}</div> : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {Icon ? (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/5 text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </span>
          ) : null}

          <h1 className="truncate text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
            {title}
          </h1>
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
