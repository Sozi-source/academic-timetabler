'use client';

import {
  LogOut,
  Menu,
  UserRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { logoutAction } from '@/features/auth/actions';
import type { AuthenticatedProfile } from '@/features/auth/types';

import { DashboardSidebar } from './dashboard-sidebar';

interface DashboardShellProps {
  profile: AuthenticatedProfile;
  children: ReactNode;
}

function getInitials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function DashboardShell({
  profile,
  children,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] =
    useState(false);

  const initials =
    getInitials(profile.fullName) || 'HD';

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => {
          setMobileOpen(false);
        }}
      />

      <div className="lg:pl-[var(--sidebar-width)]">
        <header className="sticky top-0 z-20 flex min-h-[var(--header-height)] items-center justify-between gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(true);
              }}
              aria-label="Open navigation"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary lg:hidden"
            >
              <Menu
                className="size-5"
                aria-hidden="true"
              />
            </button>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">
                Department workspace
              </p>

              <p className="hidden truncate text-xs text-text-muted sm:block">
                Academic planning and timetable management
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right md:block">
              <p className="truncate text-sm font-semibold text-text-primary">
                {profile.fullName}
              </p>

              <p className="truncate text-xs text-text-muted">
                Head of Department
              </p>
            </div>

            <div
              title={profile.fullName}
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-primary-soft text-xs font-semibold text-primary"
            >
              {initials || (
                <UserRound
                  className="size-4"
                  aria-hidden="true"
                />
              )}
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-text-muted transition hover:bg-surface-subtle hover:text-text-primary"
              >
                <LogOut
                  className="size-4"
                  aria-hidden="true"
                />
              </button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[var(--content-max-width)] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}