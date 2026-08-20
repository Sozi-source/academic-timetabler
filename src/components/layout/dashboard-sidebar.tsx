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
    <div className="flex h-full flex-col bg-navigation-background text-white">
      <div className="flex min-h-[var(--header-height)] items-center justify-between border-b border-navigation-border px-5">
        <Link
          href="/dashboard"
          onClick={onMobileClose}
          className="flex min-w-0 items-center gap-3"
        >
          <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-institutional-yellow text-primary-deeper shadow-sm ring-1 ring-white/10">
            <CalendarRange
              className="size-5"
              aria-hidden="true"
            />
            <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-navigation-background bg-white" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-white">
              Academic Planning
            </p>

            <p className="truncate text-xs text-navigation-text/75">
              Management system
            </p>
          </div>
        </Link>

        {onMobileClose ? (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close navigation"
            className="flex size-9 items-center justify-center rounded-lg text-navigation-text transition hover:bg-navigation-hover hover:text-white lg:hidden"
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
                <span className="h-px w-4 bg-institutional-yellow" aria-hidden="true" />
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.17em] text-navigation-text/60">
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
                        'group relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition',
                        active
                          ? 'bg-navigation-active text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r-full before:bg-institutional-yellow'
                          : 'text-navigation-text hover:bg-navigation-hover hover:text-white',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-md transition',
                          active
                            ? 'bg-institutional-yellow text-primary-deeper'
                            : 'text-navigation-text/75 group-hover:bg-white/10 group-hover:text-institutional-yellow',
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

      <div className="border-t border-navigation-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="size-2 rounded-full bg-institutional-yellow shadow-[0_0_0_4px_rgba(245,196,0,0.12)]" aria-hidden="true" />
          <div>
            <p className="text-xs font-medium text-white">
              Timetabling workspace
            </p>
            <p className="mt-0.5 text-[0.6875rem] text-navigation-text/65">
              Academic scheduling operations
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] border-r border-navigation-border bg-navigation-background shadow-[8px_0_28px_rgba(16,60,57,0.08)] lg:block">
        {sidebarContent}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onMobileClose}
            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
          />

          <aside className="relative h-full w-[min(19rem,86vw)] border-r border-navigation-border bg-navigation-background shadow-lg">
            {sidebarContent}
          </aside>
        </div>
      ) : null}
    </>
  );
}
