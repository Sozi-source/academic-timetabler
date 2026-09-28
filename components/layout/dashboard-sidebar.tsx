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
    <div className="flex h-full flex-col bg-surface text-text-primary">
      <div className="flex min-h-[var(--header-height)] items-center justify-between border-b border-border-soft px-5">
        <Link
          href="/dashboard"
          onClick={onMobileClose}
          className="flex min-w-0 items-center gap-3"
        >
          <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary shadow-sm border border-primary-soft/50">
            <CalendarRange
              className="size-5"
              aria-hidden="true"
            />
          </div>

          <p className="truncate text-sm font-bold tracking-tight text-text-primary">
            Academic Planner
          </p>
        </Link>

        {onMobileClose ? (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close navigation"
            className="flex size-9 items-center justify-center rounded-lg text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary lg:hidden"
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
        className="flex-1 overflow-y-auto px-3 py-4"
      >
        <div className="space-y-5">
          {dashboardNavigation.map((section) => (
            <section key={section.label}>
              <div className="flex items-center gap-2 px-3">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.17em] text-text-subtle">
                  {section.label}
                </p>
              </div>

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
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition',
                        active
                          ? 'bg-primary-soft text-primary border border-primary-soft/30'
                          : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-md transition',
                          active
                            ? 'text-primary'
                            : 'text-text-subtle group-hover:text-text-primary',
                        )}
                      >
                        <Icon
                          className="size-[1.05rem]"
                          aria-hidden="true"
                        />
                      </span>

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

    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] border-r border-border-soft bg-surface shadow-[1px_0_10px_rgba(0,0,0,0.01)] lg:block">
        {sidebarContent}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onMobileClose}
            className="absolute inset-0 bg-black/25 backdrop-blur-[1px]"
          />

          <aside className="relative h-full w-[var(--sidebar-width)] max-w-[85vw] border-r border-border-soft bg-surface shadow-lg">
            {sidebarContent}
          </aside>
        </div>
      ) : null}
    </>
  );
}
