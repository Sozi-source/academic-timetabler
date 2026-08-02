import {
  ChevronRight,
  Home,
} from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils/cn';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  showHome?: boolean;
}

export function Breadcrumb({
  items,
  className,
  showHome = true,
}: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        'flex flex-wrap items-center gap-1.5 text-xs text-text-muted',
        className,
      )}
    >
      {showHome ? (
        <>
          <Link
            href="/dashboard"
            aria-label="Dashboard"
            className="inline-flex size-7 items-center justify-center rounded-md transition hover:bg-navigation-hover hover:text-primary"
          >
            <Home
              className="size-3.5"
              aria-hidden="true"
            />
          </Link>

          {items.length > 0 ? (
            <ChevronRight
              className="size-3.5 text-text-subtle"
              aria-hidden="true"
            />
          ) : null}
        </>
      ) : null}

      {items.map((item, index) => {
        const isCurrent =
          index === items.length - 1;

        return (
          <span
            key={`${item.label}-${index}`}
            className="inline-flex items-center gap-1.5"
          >
            {item.href && !isCurrent ? (
              <Link
                href={item.href}
                className="rounded-md px-1.5 py-1 transition hover:bg-navigation-hover hover:text-primary"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current={
                  isCurrent
                    ? 'page'
                    : undefined
                }
                className={
                  isCurrent
                    ? 'px-1.5 py-1 font-medium text-text-secondary'
                    : 'px-1.5 py-1'
                }
              >
                {item.label}
              </span>
            )}

            {!isCurrent ? (
              <ChevronRight
                className="size-3.5 text-text-subtle"
                aria-hidden="true"
              />
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}