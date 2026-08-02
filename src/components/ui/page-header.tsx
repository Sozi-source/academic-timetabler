import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  context?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  context,
}: PageHeaderProps) {
  return (
    <header className="border-b border-border pb-6">
      {context ? (
        <div className="mb-5">
          {context}
        </div>
      ) : null}

      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {eyebrow}
            </p>
          ) : null}

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
            {title}
          </h1>

          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary sm:text-base">
              {description}
            </p>
          ) : null}
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