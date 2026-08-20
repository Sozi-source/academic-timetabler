'use client';

import { AppWindow, LogOut } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { logoutAction } from '@/features/auth/actions';
import type { AuthenticatedProfile } from '@/features/auth/types';

interface PlatformShellProps {
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

export function PlatformShell({ profile, children }: PlatformShellProps) {
  const initials = getInitials(profile.fullName) || 'HD';

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-x-0 top-0 z-50 h-1 bg-institutional-yellow" aria-hidden="true" />

      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 shadow-[0_1px_0_rgba(31,41,55,0.03)] backdrop-blur">
        <div className="mx-auto flex min-h-[var(--header-height)] w-full max-w-[var(--content-max-width)] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white ring-2 ring-institutional-yellow/85 ring-offset-2 ring-offset-surface">
              <AppWindow className="size-5" aria-hidden="true" />
            </span>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold tracking-tight text-text-primary">
                  Academic Planning System
                </p>
              </div>
              <p className="hidden truncate text-xs text-text-muted sm:block">
                {profile.departmentName || 'Academic operations'}
              </p>
            </div>
          </Link>

          <div className="flex min-w-0 items-center gap-2.5">
            <div className="hidden min-w-0 border-l border-border pl-4 text-right md:block">
              <p className="truncate text-sm font-semibold text-text-primary">{profile.fullName}</p>
              <p className="truncate text-xs text-text-muted">
                {profile.role === 'system_admin' ? 'System administrator' : 'Administrator'}
              </p>
            </div>

            <div
              title={profile.fullName}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white ring-2 ring-institutional-yellow/85 ring-offset-2 ring-offset-surface"
            >
              {initials}
            </div>

            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" title="Sign out">
                <LogOut className="size-4" aria-hidden="true" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[var(--content-max-width)] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        {children}
      </main>
    </div>
  );
}
