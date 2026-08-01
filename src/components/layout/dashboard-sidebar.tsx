'use client';

import {
  CalendarRange,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { dashboardNavigation } from '@/config/navigation';
import { cn } from '@/lib/utils/cn';

interface DashboardSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function DashboardSidebar({
  mobileOpen = false,
  onMobileClose,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  const navigation = (
    <div className="flex h-full flex-col">
      <div className="flex min-h-[var(--header-height)] items-center justify-between border-b border-navigation-border px-5">
        <Link
          href="/dashboard"
          onClick={onMobileClose}
          className="flex min-w-0 items-center gap-3"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <CalendarRange
              className="size-5"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">
              HND App
            </p>

            <p className="truncate text-xs text-text-muted">
              Department Timetabler
            </p>
          </div>
        </Link>

        {onMobileClose ? (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close navigation"
            className="flex size-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-navigation-hover hover:text-text-primary lg:hidden"
          >
            <X
              className="size-5"
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>

      <nav
        aria-label="Main navigation"
        className="flex-1 overflow-y-auto px-3 py-5"
      >
        <p className="px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-text-subtle">
          Timetable management
        </p>

        <div className="mt-3 space-y-1">
          {dashboardNavigation.map((item) => {
            const Icon = item.icon;

            const active =
              pathname === item.href ||
              (
                item.href !== '/dashboard' &&
                pathname.startsWith(`${item.href}/`)
              );

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                aria-current={
                  active
                    ? 'page'
                    : undefined
                }
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition',
                  active
                    ? 'bg-navigation-active text-navigation-active-text'
                    : 'text-navigation-text hover:bg-navigation-hover hover:text-text-primary',
                )}
              >
                <Icon
                  className="size-[1.125rem] shrink-0"
                  aria-hidden="true"
                />

                <span className="truncate">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-navigation-border px-5 py-4">
        <p className="text-xs leading-5 text-text-muted">
          Human Nutrition and Dietetics
        </p>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] border-r border-navigation-border bg-navigation-background lg:block">
        {navigation}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onMobileClose}
            className="absolute inset-0 bg-black/25 backdrop-blur-[1px]"
          />

          <aside className="relative h-full w-[min(19rem,86vw)] border-r border-navigation-border bg-navigation-background shadow-[var(--shadow-lg)]">
            {navigation}
          </aside>
        </div>
      ) : null}
    </>
  );
}