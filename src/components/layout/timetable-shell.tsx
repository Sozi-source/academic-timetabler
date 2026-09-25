'use client';

import { ClipboardCheck, FileChartColumn, ListChecks, LogOut, Menu, PencilRuler } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { logoutAction } from '@/features/auth/actions';
import type { AuthenticatedProfile } from '@/features/auth/types';

import { DashboardSidebar } from './dashboard-sidebar';
import { MobileBottomNav } from './mobile-bottom-nav';

// The four everyday timetabling steps; master-setup pages (rooms, offerings,
// constraints, imports, etc.) stay one tap away behind "More".
const BOTTOM_TABS = [
  { label: 'Generate', href: '/timetable/readiness', icon: ClipboardCheck },
  { label: 'Edit', href: '/timetable/editor', icon: PencilRuler },
  { label: 'Published', href: '/timetable/published', icon: FileChartColumn },
  { label: 'Reports', href: '/timetable/reports', icon: ListChecks },
] as const;

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
  const pathname = usePathname();
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
        <header className="admin-shell-header sticky top-0 z-40 flex min-h-[var(--header-height)] items-center justify-between gap-2 border-b border-border-soft bg-surface/95 px-[var(--content-gutter)] shadow-sm backdrop-blur-xl">
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

            <span className="hidden h-7 w-0.5 shrink-0 rounded-full bg-institutional-yellow sm:block" aria-hidden="true" />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-bold text-text-primary">Timetabling</p>
              </div>
              <p className="hidden max-w-[34rem] truncate text-[0.68rem] font-medium text-text-muted sm:block">
                {profile.departmentName || 'No department assigned'}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden min-w-0 max-w-48 border-l border-border pl-4 text-right md:block">
              <p className="truncate text-sm font-bold text-text-primary">{profile.fullName}</p>
              <p className="truncate text-xs text-text-muted">
                {profile.role === 'system_admin' ? 'System administrator' : 'Timetable administrator'}
              </p>
            </div>

            <div
              title={profile.fullName}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary text-[0.68rem] font-bold text-white ring-2 ring-institutional-yellow/85 ring-offset-2 ring-offset-surface"
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

        <main className="admin-screen mx-auto min-w-0 w-full max-w-none overflow-x-clip px-[var(--content-gutter)] py-3.5 pb-20 sm:py-5 lg:py-6 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Android/iOS-style bottom tab bar — mobile & tablet only. */}
      <MobileBottomNav
        items={[
          ...BOTTOM_TABS.map((tab) => ({
            ...tab,
            isActive: pathname === tab.href || pathname.startsWith(`${tab.href}/`),
          })),
          { label: 'More', icon: Menu, onClick: () => setMobileOpen(true) },
        ]}
      />
    </div>
  );
}
