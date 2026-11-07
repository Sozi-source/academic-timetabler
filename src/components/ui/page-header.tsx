import { ArrowLeft, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

import { Breadcrumb, type BreadcrumbItem } from './breadcrumb';

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  titleClassName?: string;
  description?: ReactNode;
  icon?: LucideIcon;
  iconClassName?: string;
  actions?: ReactNode;
  context?: ReactNode;
  backHref?: string;
  backLabel?: string;
  /** Renders a breadcrumb trail above the title. */
  breadcrumbs?: BreadcrumbItem[];
  /**
   * "flat" (default) is a plain title bar with a bottom rule, the way
   * Business Central draws page titles. "card" keeps the old boxed look.
   */
  variant?: 'flat' | 'card';
}

export function PageHeader({
  eyebrow,
  title,
  titleClassName,
  description,
  icon: Icon,
  iconClassName,
  actions,
  context,
  backHref,
  backLabel,
  breadcrumbs,
  variant = 'flat',
}: PageHeaderProps) {
  const isCard = variant === 'card';

  return (
    <header
      className={cn(
        'admin-page-header',
        isCard
          ? 'rounded-[0.9rem] border border-border-soft bg-surface px-3 py-3 shadow-sm sm:px-4 sm:py-3.5 xl:px-5 xl:py-4'
          : 'border-b border-border pb-3',
      )}
    >
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumb items={breadcrumbs} className="mb-1.5" />
      ) : null}

      {context ? <div className="mb-3">{context}</div> : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
          {backHref ? (
            <Link
              href={backHref}
              className="touch-target h-9 shrink-0 gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              {backLabel || 'Back'}
            </Link>
          ) : null}

          <div className="min-w-0 flex-1">
            {eyebrow && isCard ? (
              <p className="hidden text-[10px] font-semibold uppercase tracking-wide text-text-muted sm:block">
                {eyebrow}
              </p>
            ) : null}

            <h1
              className={cn(
                'flex min-w-0 items-start gap-2 break-words text-lg font-semibold leading-snug tracking-tight sm:text-xl',
                titleClassName ?? 'text-text-primary',
              )}
            >
              {!isCard && Icon ? (
                <Icon
                  className={cn('size-5 shrink-0 text-primary mt-0.5', iconClassName)}
                  aria-hidden="true"
                />
              ) : null}
              {isCard && !backHref && Icon ? (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/5 text-primary">
                  <Icon className={cn('size-4', iconClassName)} aria-hidden="true" />
                </span>
              ) : null}
              <span className="min-w-0">{title}</span>
            </h1>

            {description ? (
              typeof description === 'string' ? (
                <p className="mt-1 line-clamp-1 text-[13px] leading-normal text-text-muted sm:mt-0.5 sm:line-clamp-2 sm:text-xs">
                  {description}
                </p>
              ) : (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted sm:mt-0.5">
                  {description}
                </div>
              )
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
