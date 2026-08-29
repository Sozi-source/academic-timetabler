'use client';

import {
  ArrowLeft,
  BarChart3,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { logoutAction } from '@/features/auth/actions';
import type { AuthenticatedProfile } from '@/features/auth/types';
import { cn } from '@/lib/utils/cn';

interface AssessmentShellProps {
  profile: AuthenticatedProfile;
  children: ReactNode;
}

const navigation = [
  { label: 'Overview', href: '/assessment', icon: LayoutDashboard },
  { label: 'CAT & Exam Analysis', href: '/assessment/analysis', icon: BarChart3 },
  { label: 'Examination Reports Centre', href: '/assessment/reports', icon: FileText },
] as const;

function getInitials(fullName: string) {
  return fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

export function AssessmentShell({ profile, children }: AssessmentShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <aside className="flex h-full w-[260px] shrink-0 flex-col bg-slate-900 text-slate-100 lg:sticky lg:top-0 lg:h-dvh lg:self-start lg:overflow-y-auto border-r border-slate-800">
      {/* Brand Header */}
      <div className="border-b border-slate-800 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-200 shadow-2xs border border-slate-700">
            <GraduationCap className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold leading-tight text-white">Results & Exams</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">Academic performance</p>
          </div>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3.5">
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Navigation</p>
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <ArrowLeft className="size-3.5 shrink-0 text-slate-400" />
              <span className="truncate">Back to Module Hub</span>
            </Link>
          </div>

          <div>
            <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Analysis & Reports</p>
            <div className="space-y-1">
              {navigation.map((item) => {
                const active = pathname === item.href || (item.href !== '/assessment' && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'relative flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition',
                      active
                        ? 'bg-slate-800 text-white shadow-2xs'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white',
                    )}
                  >
                    <Icon className={cn('size-3.5 shrink-0', active ? 'text-white' : 'text-slate-400')} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* User Footer */}
      <div className="border-t border-slate-800 p-3">
        <div className="flex w-full items-center gap-2.5 rounded-lg bg-slate-800/60 p-2 border border-slate-700/50">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[11px] font-bold text-white">
            {getInitials(profile.fullName) || 'HD'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-200">{profile.fullName}</p>
            <p className="truncate text-[10px] text-slate-400">{profile.departmentName}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
              aria-label="Sign out"
            >
              <LogOut className="size-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900">
      <div className="flex min-h-screen">
        <div className="hidden lg:block">{sidebar}</div>
        {mobileOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            />
            <div className="relative h-full w-[260px] max-w-[86vw]">{sidebar}</div>
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex min-h-[var(--header-height)] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="size-4" />
              </Button>
              <div>
                <p className="text-xs font-bold text-slate-800">Results & Exams Analysis</p>
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
