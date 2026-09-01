'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  BookOpenCheck,
  CalendarCheck2,
  CalendarDays,
  ClipboardList,
  Download,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PencilLine,
  X,
} from 'lucide-react';
import Link, { useLinkStatus } from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { logoutAction } from '@/features/auth/actions';
import type { AuthenticatedProfile } from '@/features/auth/types';
import { cn } from '@/lib/utils/cn';

interface StaffShellProps {
  profile: AuthenticatedProfile;
  children: ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Teaching & Classes',
    items: [
      { label: 'Overview', href: '/staff', icon: LayoutDashboard, exact: true },
      { label: 'My Units', href: '/staff/units', icon: BookOpenCheck },
      { label: 'Weekly Timetable', href: '/staff/timetable', icon: CalendarDays },
      { label: 'Attendance Register', href: '/staff/attendance', icon: CalendarCheck2 },
      { label: 'Daily Report', href: '/staff/daily-report', icon: ClipboardList },
    ],
  },
  {
    title: 'Curriculum & Documents',
    items: [
      { label: 'Teaching Documents', href: '/staff/documents', icon: FileText },
      { label: 'Course Outline Editor', href: '/teaching-documents/curriculum/editor', icon: PencilLine },
    ],
  },
  {
    title: 'Tools & Records',
    items: [
      { label: 'Downloads', href: '/staff/downloads', icon: Download },
      { label: 'Activity History', href: '/staff/history', icon: History },
    ],
  },
];

const MOBILE_BOTTOM_NAV: NavItem[] = [
  { label: 'Overview', href: '/staff', icon: LayoutDashboard, exact: true },
  { label: 'Timetable', href: '/staff/timetable', icon: CalendarDays },
  { label: 'Attendance', href: '/staff/attendance', icon: CalendarCheck2 },
];

function getInitials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function NavigationProgress() {
  const { pending } = useLinkStatus();
  return pending ? <span className="portal-route-progress" aria-hidden="true" /> : null;
}

export function StaffShell({ profile, children }: StaffShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const initials = getInitials(profile.fullName) || 'TR';
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between border-r border-[#083d39] bg-[#0b4f4a] text-white">
      <div>
        {/* Brand Header */}
        <div className="flex h-[4.625rem] items-center justify-between border-b border-white/10 border-t-[5px] border-t-[#ffd400] bg-[#0b4f4a] px-[1.125rem]">
          <Link
            href="/staff"
            className="flex items-center gap-3 group"
          >
            <span className="flex size-[2.375rem] shrink-0 items-center justify-center rounded-[0.625rem] bg-[#ffd400] text-[#0b4f4a] font-black shadow-md transition group-hover:scale-105">
              <BookOpen className="size-4.5" />
            </span>
            <div className="min-w-0">
              <span className="block text-sm font-black tracking-tight text-white">
                Imperial College
              </span>
              <span className="inline-block text-[10px] font-semibold tracking-wide text-white/70">
                Trainer Portal
              </span>
            </div>
          </Link>
        </div>

        {/* Task-Organized Navigation */}
        <div className="space-y-6 px-3 py-5 overflow-y-auto max-h-[calc(100vh-140px)]">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1.5">
              <p className="px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-white/55">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname?.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs transition',
                        isActive
                          ? 'border-l-[3px] border-l-[#ffd400] bg-white/13 text-white font-bold shadow-sm'
                          : 'text-white/75 hover:bg-white/8 hover:text-white font-bold'
                      )}
                    >
                      <NavigationProgress />
                      {isActive && (
                        <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-institutional-yellow" />
                      )}
                      <Icon
                        className={cn(
                          'size-4.5 shrink-0 transition',
                          isActive ? 'text-[#ffd400]' : 'text-white/65 group-hover:text-white'
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <span className={cn(
                          'ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-black',
                          isActive ? 'bg-institutional-yellow text-institutional-yellow-ink' : 'bg-white/10 text-white/80'
                        )}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trainer Profile Card & Logout Footer */}
      <div className="border-t border-white/10 bg-[#0b4f4a] p-3">
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/7 p-2.5 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fff8cc] text-[#0b4f4a] text-xs font-bold shadow-xs">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-white">
                {profile.fullName}
              </p>
              <p className="truncate text-[10px] text-white/55 font-bold">
                Academic Trainer
              </p>
            </div>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              title="Sign out"
              className="flex size-8 items-center justify-center rounded-lg text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="academic-portal min-h-screen bg-background flex">
      {/* Subtle Institutional Brand Accent Header Line */}
      <div className="fixed inset-x-0 top-0 z-[60] h-1 bg-[#ffd400]" aria-hidden="true" />

      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden lg:flex lg:w-[14.75rem] lg:flex-col lg:fixed lg:inset-y-0 lg:z-40 border-r border-slate-200">
        {sidebarContent}
      </aside>

      <div className={cn('fixed inset-0 z-50 lg:hidden transition-[visibility] duration-300', mobileOpen ? 'visible' : 'invisible delay-300')} aria-hidden={!mobileOpen}>
        <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className={cn('absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] transition-opacity duration-300', mobileOpen ? 'opacity-100' : 'opacity-0')} />
        <div
          onClick={(event) => { if ((event.target as HTMLElement).closest('a')) setMobileOpen(false); }}
          className={cn('relative h-full w-[19rem] max-w-[86vw] shadow-2xl transition-transform duration-300 ease-out', mobileOpen ? 'translate-x-0' : '-translate-x-full')}
        >
          {sidebarContent}
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition active:scale-95">
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:pl-[14.75rem] min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-[3.625rem] items-center justify-between border-b border-border bg-surface/95 px-3.5 sm:px-6 lg:h-[4.625rem] backdrop-blur shadow-2xs">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="flex size-9 items-center justify-center rounded-[0.625rem] border border-border bg-surface text-primary-deep shadow-sm transition active:scale-95 lg:hidden">
              <Menu className="size-[1.125rem]" />
            </button>
            {pathname !== '/staff' ? (
              <button
                type="button"
                onClick={() => router.back()}
                aria-label="Go back"
                title="Back"
                className="flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] border border-border bg-surface text-primary-deep shadow-sm transition hover:bg-primary-subtle active:scale-95"
              >
                <ArrowLeft className="size-[1.125rem]" />
              </button>
            ) : null}
            <span className="text-xs font-bold text-slate-900">
              Staff Workspace
            </span>
            <span className="hidden sm:inline-block text-slate-300">/</span>
            <span className="hidden sm:inline-block text-xs font-medium text-slate-500">
              Imperial College
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center rounded bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
              Active Term
            </span>
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <span className="text-xs font-bold text-slate-900 hidden sm:inline">
                {profile.fullName}
              </span>
              <span className="flex size-9 items-center justify-center rounded-full bg-[#fff8cc] text-[#0b4f4a] text-[11px] font-bold">
                {initials}
              </span>
              <form action={logoutAction} className="lg:hidden">
                <button
                  type="submit"
                  title="Sign out"
                  className="flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                >
                  <LogOut className="size-3.5" />
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* Page Content Body (with bottom padding for mobile nav) */}
        <main className="portal-page-content flex-1 px-4 py-3.5 sm:px-6 lg:px-[1.625rem] lg:py-[1.625rem] pb-20 lg:pb-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar (Clean & Professional) */}
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-sm lg:hidden">
          <div className="grid h-[3.625rem] max-w-md grid-cols-4 mx-auto">
            {MOBILE_BOTTOM_NAV.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname?.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 transition-colors',
                    isActive
                      ? 'text-primary font-bold'
                      : 'text-slate-500 hover:text-slate-800 font-medium'
                  )}
                >
                  <NavigationProgress />
                  <Icon
                    className={cn(
                      'size-5',
                      isActive ? 'text-primary stroke-[2.2]' : 'text-slate-400'
                    )}
                  />
                  <span className="text-[10px] tracking-tight truncate max-w-[64px]">{item.label}</span>
                </Link>
              );
            })}
            <button type="button" onClick={() => setMobileOpen(true)} className="flex flex-col items-center justify-center gap-0.5 text-text-muted transition active:scale-95" aria-label="Open more navigation">
              <Menu className="size-5" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
