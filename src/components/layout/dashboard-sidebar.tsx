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

  const sidebarContent = (
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
              Academic Operations
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
        <div className="space-y-6">
          {dashboardNavigation.map((section) => (
            <section key={section.label}>
              <p className="px-3 text-[0.65rem] font-semibold uppercase tracking-[0.17em] text-text-subtle">
                {section.label}
              </p>

              <div className="mt-2 space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;

                  const active =
                    pathname === item.href ||
                    (
                      item.href !== '/dashboard' &&
                      pathname.startsWith(
                        `${item.href}/`,
                      )
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
                        'group flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition',
                        active
                          ? 'bg-navigation-active text-navigation-active-text'
                          : 'text-navigation-text hover:bg-navigation-hover hover:text-text-primary',
                      )}
                    >
                      <Icon
                        className={cn(
                          'size-[1.05rem] shrink-0',
                          active
                            ? 'text-primary'
                            : 'text-text-muted group-hover:text-primary',
                        )}
                        aria-hidden="true"
                      />

                      <span className="truncate">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </nav>

      <div className="border-t border-navigation-border px-5 py-4">
        <p className="text-xs font-medium text-text-secondary">
          Nutrition and Dietetics
        </p>

        <p className="mt-1 text-[0.6875rem] text-text-muted">
          Department workspace
        </p>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] border-r border-navigation-border bg-navigation-background lg:block">
        {sidebarContent}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onMobileClose}
            className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
          />

          <aside className="relative h-full w-[min(19rem,86vw)] border-r border-navigation-border bg-navigation-background shadow-[var(--shadow-lg)]">
            {sidebarContent}
          </aside>
        </div>
      ) : null}
    </>
  );
}