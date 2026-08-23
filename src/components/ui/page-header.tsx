import { ArrowLeft, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  context?: ReactNode;
  backHref?: string;
  backLabel?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  context,
  backHref,
  backLabel,
}: PageHeaderProps) {
  return (
    <header className="rounded-xl border border-border bg-surface px-3 py-3 shadow-sm xl:px-4 xl:py-3.5 2xl:px-5 2xl:py-4">
      {context ? <div className="mb-3">{context}</div> : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              {backLabel || 'Back'}
            </Link>
          ) : Icon ? (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/5 text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </span>
          ) : null}

          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="min-w-0 break-words text-lg font-semibold tracking-tight xl:text-xl 2xl:text-[22px] min-[1920px]:text-2xl text-text-primary sm:text-2xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-0.5 text-xs text-text-muted">{description}</p>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 md:w-auto md:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
