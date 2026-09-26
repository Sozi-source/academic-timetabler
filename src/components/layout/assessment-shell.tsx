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

import { logoutAction } from '@/features/auth/actions';
import type { AuthenticatedProfile } from '@/features/auth/types';
import { cn } from '@/lib/utils/cn';

import { MobileBottomNav } from './mobile-bottom-nav';

interface AssessmentShellProps {
  profile: AuthenticatedProfile;
  children: ReactNode;
}

const NAVIGATION_ITEMS = [
  { label: 'Overview', href: '/assessment', icon: LayoutDashboard },
  { label: 'CAT & Exam Analysis', href: '/assessment/analysis', icon: BarChart3 },
  { label: 'Reports', href: '/assessment/reports', icon: FileText },
] as const;

function getInitials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function AssessmentShell({ profile, children }: AssessmentShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = getInitials(profile.fullName) || 'HD';

  const sidebar = (
    <aside className="flex h-full w-[var(--sidebar-width)] shrink-0 flex-col bg-[#081725] text-slate-100 lg:sticky lg:top-0 lg:h-dvh lg:self-start lg:overflow-y-auto border-r border-[#1e293b]">
      {/* Brand Header */}
      <div className="border-b border-[#1e293b] px-4 py-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#122a43] text-sky-400 border border-[#2b3d54] shadow-xs group-hover:scale-105 transition-transform">
            <GraduationCap className="size-4 text-sky-400" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.72rem] font-bold leading-tight text-white tracking-tight">Results & Exams</p>
            <p className="mt-0.5 truncate text-[0.64rem] font-medium text-slate-400">Academic Analytics</p>
          </div>
        </Link>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5 py-4">
        <div className="space-y-3.5">
          <div>
            <p className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Navigation</p>
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-10 w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[0.72rem] font-semibold text-slate-300 transition hover:bg-[#16273e] hover:text-white"
            >
              <ArrowLeft className="size-3.5 shrink-0 text-slate-400" />
              <span className="truncate">Module Hub</span>
            </Link>
          </div>

          <div>
            <p className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Analysis & Reports</p>
            <div className="space-y-1">
              {NAVIGATION_ITEMS.map((item) => {
                const active = pathname === item.href || (item.href !== '/assessment' && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'relative flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[0.72rem] font-semibold transition-all duration-150',
                      active
                        ? 'bg-[#16273e] text-white shadow-xs border-l-2 border-l-sky-400 font-bold'
                        : 'text-slate-300 hover:bg-[#16273e]/60 hover:text-white',
                    )}
                  >
                    <Icon className={cn('size-3.5 shrink-0', active ? 'text-sky-400' : 'text-slate-400')} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* User Footer */}
      <div className="border-t border-[#1e293b] p-2.5">
        <div className="flex w-full items-center gap-2 rounded-lg bg-[#16273e]/70 p-2 border border-[#2b3d54]/60 shadow-2xs">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sky-950 text-[10px] font-bold text-sky-400 border border-sky-800/60">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{profile.fullName}</p>
            <p className="truncate text-[0.64rem] font-medium text-slate-400">{profile.departmentName || 'Department'}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded p-1 text-slate-400 hover:bg-rose-950/60 hover:text-rose-400 transition"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="academic-portal min-h-screen bg-[#f8fafc] text-slate-900">
      {/* Top Accent Line */}
      <div className="fixed inset-x-0 top-0 z-[60] h-1 bg-sky-500" aria-hidden="true" />

      <div className="flex min-h-screen">
        <div className="hidden lg:block">{sidebar}</div>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            />
            <div className="admin-mobile-drawer relative h-full w-[var(--sidebar-width)] max-w-[88vw]">{sidebar}</div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          {/* Header */}
          <header className="admin-shell-header sticky top-0 z-40 flex min-h-[var(--header-height)] items-center justify-between border-b border-border-soft bg-white/95 px-[var(--content-gutter)] shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="touch-target size-9 rounded-[0.65rem] border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden active:scale-95"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="size-4" />
              </button>
              <div className="flex items-center gap-2">
                <span className="h-4.5 w-1 rounded-full bg-sky-500" />
                <p className="text-xs font-bold text-slate-900 sm:text-sm">Results & Exams</p>
                <span className="hidden sm:inline text-slate-300">·</span>
                <span className="hidden sm:inline text-xs font-medium text-slate-500">{profile.departmentName}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden md:inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800 border border-sky-200/80">
                Academic Performance
              </span>
            </div>
          </header>

          <main className="admin-screen mx-auto w-full max-w-[var(--content-max-width)] px-[var(--content-gutter)] py-3.5 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:py-5 lg:py-6 lg:pb-6">
            {children}
          </main>
        </div>
      </div>

      {/* Android/iOS-style bottom tab bar — mobile & tablet only. */}
      <MobileBottomNav
        activeClassName="text-sky-600"
        items={[
          { label: 'Hub', href: '/dashboard', icon: ArrowLeft, isActive: false },
          ...NAVIGATION_ITEMS.map((item) => ({
            ...item,
            isActive: pathname === item.href || (item.href !== '/assessment' && pathname.startsWith(item.href)),
          })),
        ]}
      />
    </div>
  );
}
