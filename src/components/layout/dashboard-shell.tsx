'use client';

import { LogOut, Menu } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
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
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-gradient-to-r from-institutional-maroon via-institutional-gold to-primary" aria-hidden="true" />
      <DashboardSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => {
          setMobileOpen(false);
        }}
      />

      <div className="lg:pl-[var(--sidebar-width)]">
        <header className="sticky top-0 z-20 flex min-h-[var(--header-height)] items-center justify-between gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              aria-label="Open navigation"
              onClick={() => {
                setMobileOpen(true);
              }}
              className="lg:hidden"
            >
              <Menu
                className="size-5"
                aria-hidden="true"
              />
            </Button>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">
                Academic Operations Platform
              </p>

              <p className="hidden truncate text-xs text-text-muted sm:block">
                {profile.departmentName || 'No department assigned'}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden min-w-0 border-l border-border pl-4 text-right md:block">
              <p className="truncate text-sm font-semibold text-text-primary">
                {profile.fullName}
              </p>

              <p className="truncate text-xs text-text-muted">
                {profile.role === 'system_admin'
                  ? 'System administrator'
                  : 'Department timetable administrator'}
              </p>
            </div>

            <div
              title={profile.fullName}
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-primary-soft text-xs font-semibold text-primary"
            >
              {initials}
            </div>

            <form action={logoutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut
                  className="size-4"
                  aria-hidden="true"
                />
              </Button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[var(--content-max-width)] px-4 py-5 sm:px-5 lg:px-6 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
