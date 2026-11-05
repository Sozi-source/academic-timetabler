'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

import { Badge } from './badge';
import { type BreadcrumbItem } from './breadcrumb';
import { PageHeader } from './page-header';

export interface RecordTab {
  key: string;
  label: string;
  href: string;
  count?: number;
}

interface RecordShellProps {
  /** Leave out inside the admin shells: they already render a trail from the URL. */
  breadcrumbs?: BreadcrumbItem[];
  title: string;
  /** Short line under the title, e.g. admission number or role. */
  subtitle?: string;
  status?: {
    label: string;
    variant?:
      | 'neutral'
      | 'primary'
      | 'success'
      | 'warning'
      | 'danger'
      | 'info'
      | 'institutional';
  };
  /** Action ribbon: buttons for Edit, Print, Reset password and so on. */
  actions?: ReactNode;
  tabs: RecordTab[];
  /** Optional explicit active tab key; when omitted, resolved from `usePathname()`. */
  activeTab?: string;
  children: ReactNode;
  className?: string;
}

function resolveActiveTabKey(
  tabs: RecordTab[],
  pathname: string,
  explicitActiveTab?: string,
): string | undefined {
  if (explicitActiveTab) {
    return explicitActiveTab;
  }

  const cleanPath = (href: string) => href.split('?')[0] ?? href;

  const exact = tabs.find((tab) => cleanPath(tab.href) === pathname);
  if (exact) {
    return exact.key;
  }

  // Fallback to the most specific prefix match
  const prefixMatches = tabs
    .filter((tab) => pathname.startsWith(`${cleanPath(tab.href)}/`))
    .sort((a, b) => cleanPath(b.href).length - cleanPath(a.href).length);

  return prefixMatches[0]?.key ?? tabs[0]?.key;
}

/**
 * Standard layout for a single student, trainer, unit or similar record:
 * breadcrumb, title with status badge, action ribbon, then URL-driven tabs.
 *
 * Tabs are plain links (use ?tab=... or sub-routes), so every tab can be
 * bookmarked or shared.
 */
export function RecordShell({
  breadcrumbs,
  title,
  subtitle,
  status,
  actions,
  tabs,
  activeTab,
  children,
  className,
}: RecordShellProps) {
  const pathname = usePathname();
  const resolvedActiveTab = resolveActiveTabKey(tabs, pathname, activeTab);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="print:hidden">
        <PageHeader
          breadcrumbs={breadcrumbs}
          title={title}
          description={subtitle}
          actions={
            <>
              {status ? (
                <Badge variant={status.variant ?? 'neutral'} dot>
                  {status.label}
                </Badge>
              ) : null}
              {actions}
            </>
          }
        />
      </div>

      <nav
        aria-label="Record sections"
        className="-mb-px flex gap-1 overflow-x-auto border-b border-border print:hidden"
      >
        {tabs.map((tab) => {
          const active = tab.key === resolvedActiveTab;

          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:border-border-strong hover:text-text-primary',
              )}
            >
              {tab.label}

              {typeof tab.count === 'number' ? (
                <span className="rounded-full bg-surface-muted px-1.5 text-[10px] tabular-nums text-text-secondary">
                  {tab.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}
