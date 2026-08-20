'use client';

import { LogOut, Menu } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { logoutAction } from '@/features/auth/actions';
import type { AuthenticatedProfile } from '@/features/auth/types';

import { DashboardSidebar } from './dashboard-sidebar';

interface TimetableShellProps {
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

export function TimetableShell({ profile, children }: TimetableShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = getInitials(profile.fullName) || 'HD';

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-x-0 top-0 z-50 h-1 bg-institutional-yellow" aria-hidden="true" />

      <DashboardSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => {
          setMobileOpen(false);
        }}
      />

      <div className="min-w-0 overflow-x-clip lg:pl-[var(--sidebar-width)]">
        <header className="sticky top-0 z-20 flex min-h-[var(--header-height)] items-center justify-between gap-2 border-b border-border xl:gap-3 2xl:gap-4 bg-surface/95 px-3 shadow-[0_1px_0_rgba(31,41,55,0.03)] backdrop-blur sm:px-4 xl:px-6 2xl:px-8">
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
              <Menu className="size-5" aria-hidden="true" />
            </Button>

            <span className="hidden h-8 w-1 shrink-0 rounded-full bg-institutional-yellow sm:block" aria-hidden="true" />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-[12px] font-semibold text-text-primary xl:text-sm 2xl:text-[15px] min-[1920px]:text-base">Timetabling</p>
              </div>
              <p className="hidden truncate text-xs text-text-muted sm:block">
                {profile.departmentName || 'No department assigned'}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden min-w-0 border-l border-border pl-4 text-right md:block">
              <p className="truncate text-[12px] font-semibold text-text-primary xl:text-sm 2xl:text-[15px] min-[1920px]:text-base">{profile.fullName}</p>
              <p className="truncate text-xs text-text-muted">
                {profile.role === 'system_admin' ? 'System administrator' : 'Timetable administrator'}
              </p>
            </div>

            <div
              title={profile.fullName}
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary text-xs font-semibold text-white ring-2 ring-institutional-yellow/85 ring-offset-2 ring-offset-surface"
            >
              {initials}
            </div>

            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" title="Sign out">
                <LogOut className="size-4" aria-hidden="true" />
              </Button>
            </form>
          </div>
        </header>

        <main className="mx-auto min-w-0 w-full max-w-[var(--content-max-width)] overflow-x-clip px-3 py-4 xl:px-5 xl:py-5 2xl:px-6 2xl:py-6 min-[1920px]:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
