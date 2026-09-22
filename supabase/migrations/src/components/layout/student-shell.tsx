'use client';

import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  GraduationCap,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  UsersRound,
  FileUp,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { logoutAction } from '@/features/auth/actions';
import type { AuthenticatedProfile } from '@/features/auth/types';
import { cn } from '@/lib/utils/cn';

interface StudentShellProps {
  profile: AuthenticatedProfile;
  children: ReactNode;
}

interface StudentNavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
}

const navigation: readonly StudentNavigationItem[] = [
  { label: 'Overview', href: '/students', icon: LayoutDashboard },
  { label: 'Student registry', href: '/students/registry', icon: UsersRound },
  { label: 'Student onboarding', href: '/students/registry/import', icon: FileUp },
  { label: 'Portal access', href: '/students/access', icon: KeyRound },
  { label: 'Status & progression', href: '/students/progression', icon: History },
  { label: 'Unit registration', href: '/students/unit-registration', icon: BookOpenCheck },
  { label: 'Reports', href: '/students/reports', icon: BarChart3 },
];

function getInitials(fullName: string) {
  return fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

export function StudentShell({ profile, children }: StudentShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <aside className="flex h-full w-[var(--sidebar-width)] shrink-0 flex-col bg-primary text-white lg:sticky lg:top-0 lg:h-dvh lg:self-start lg:overflow-y-auto">
      <div className="border-b border-white/10 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-institutional-yellow text-institutional-yellow-ink shadow-sm">
            <GraduationCap className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold leading-tight">Student Lifecycle</p>
            <p className="mt-0.5 truncate text-[0.6875rem] font-medium text-white/65">Student management</p>
          </div>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 px-2.5 text-[0.625rem] font-bold uppercase tracking-[0.16em] text-institutional-yellow">Platform</p>
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Back to module hub</span>
            </Link>
          </div>

          <div>
            <p className="mb-1.5 px-2.5 text-[0.625rem] font-bold uppercase tracking-[0.16em] text-institutional-yellow">Student management</p>
            <div className="space-y-1.5">
            {navigation.map((item) => {
              const active = !item.disabled && (pathname === item.href || (item.href !== '/students' && pathname.startsWith(item.href)));
              const Icon = item.icon;

              if (item.disabled) {
                return (
                  <div key={item.href} className="flex min-h-10 w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs text-white/40">
                    <span className="flex min-w-0 items-center gap-2.5"><Icon className="size-4 shrink-0" /><span className="truncate">{item.label}</span></span>
                    <span className="text-[0.5625rem] font-semibold uppercase tracking-wide">Soon</span>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'relative flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition',
                    active ? 'bg-white/14 text-white shadow-sm ring-1 ring-white/5' : 'text-white/72 hover:bg-white/8 hover:text-white',
                  )}
                >
                  {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-institutional-yellow" /> : null}
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-md',
                      active ? 'bg-institutional-yellow text-institutional-yellow-ink' : 'bg-white/5 text-white/70',
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
            </div>
          </div>
        </div>

        <div className="mt-auto pt-6">
          <div className="mx-1 h-px bg-white/10" />
          <p className="px-2.5 pt-1 text-[0.6875rem] leading-4 text-white/55">Student records, progression and registration.</p>
        </div>
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex w-full items-center gap-2.5 rounded-xl bg-black/10 p-2.5 ring-1 ring-white/5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-institutional-yellow text-xs font-bold text-institutional-yellow-ink">
            {getInitials(profile.fullName) || 'HD'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold">{profile.fullName}</p>
            <p className="mt-0.5 truncate text-[0.625rem] text-white/55">{profile.departmentName}</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="rounded-md p-1.5 text-white/55 hover:bg-white/10 hover:text-white" aria-label="Sign out">
              <LogOut className="size-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-x-0 top-0 z-50 h-1 bg-institutional-yellow" />
      <div className="flex min-h-screen">
        <div className="hidden lg:block">{sidebar}</div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button className="absolute inset-0 bg-black/35" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
            <div className="relative h-full w-[var(--sidebar-width)] max-w-[86vw]">{sidebar}</div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex min-h-[var(--header-height)] items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
                <Menu className="size-4" />
              </Button>
              <div>
                <p className="text-sm font-bold text-text-primary">Students</p>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[var(--content-max-width)] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
