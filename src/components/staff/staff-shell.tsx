'use client';

import type { ReactNode } from 'react';
import {
  BookOpen,
  BookOpenCheck,
  CalendarCheck2,
  CalendarDays,
  Download,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  PencilLine,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { logoutAction } from '@/features/auth/actions';
import type { AuthenticatedProfile } from '@/features/auth/types';
import { cn } from '@/lib/utils/cn';

interface StaffShellProps {
  profile: AuthenticatedProfile;
  children: ReactNode;
}

interface NavSection {
  title: string;
  items: {
    label: string;
    href: string;
    icon: typeof LayoutDashboard;
    exact?: boolean;
    badge?: string;
  }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Teaching & Classes',
    items: [
      { label: 'Overview', href: '/staff', icon: LayoutDashboard, exact: true },
      { label: 'My Units', href: '/staff/units', icon: BookOpenCheck },
      { label: 'Weekly Timetable', href: '/staff/timetable', icon: CalendarDays },
      { label: 'Attendance Register', href: '/staff/attendance', icon: CalendarCheck2 },
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
      { label: 'Offline Markbooks', href: '/staff/downloads', icon: Download },
      { label: 'Activity History', href: '/staff/history', icon: History },
    ],
  },
];

const MOBILE_BOTTOM_NAV = [
  { label: 'Overview', href: '/staff', icon: LayoutDashboard, exact: true },
  { label: 'My Units', href: '/staff/units', icon: BookOpenCheck },
  { label: 'Timetable', href: '/staff/timetable', icon: CalendarDays },
  { label: 'Attendance', href: '/staff/attendance', icon: CalendarCheck2 },
  { label: 'Documents', href: '/staff/documents', icon: FileText },
];

function getInitials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function StaffShell({ profile, children }: StaffShellProps) {
  const pathname = usePathname();
  const initials = getInitials(profile.fullName) || 'TR';

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#f8faf9] text-slate-900 border-r border-[#dfe6e5]">
      <div>
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-teal-900/10 px-5 bg-white">
          <Link
            href="/staff"
            className="flex items-center gap-3 group"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-900 text-amber-400 font-black shadow-md ring-2 ring-amber-400/80 transition group-hover:scale-105">
              <BookOpen className="size-4.5" />
            </span>
            <div className="min-w-0">
              <span className="block text-sm font-black tracking-tight text-slate-950">
                Imperial College
              </span>
              <span className="inline-block text-[10px] font-black uppercase tracking-wider text-teal-900 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200/80">
                Trainer Portal
              </span>
            </div>
          </Link>
        </div>

        {/* Task-Organized Navigation */}
        <div className="space-y-6 px-3 py-5 overflow-y-auto max-h-[calc(100vh-140px)]">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1.5">
              <p className="px-3 text-[10px] font-black uppercase tracking-widest text-teal-800">
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
                          ? 'bg-teal-900 text-white font-black shadow-sm ring-1 ring-teal-950/20'
                          : 'text-slate-900 hover:bg-teal-50 hover:text-teal-950 font-bold'
                      )}
                    >
                      {isActive && (
                        <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-amber-400" />
                      )}
                      <Icon
                        className={cn(
                          'size-4.5 shrink-0 transition',
                          isActive ? 'text-amber-400' : 'text-teal-700 group-hover:text-teal-900'
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <span className={cn(
                          'ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-black',
                          isActive ? 'bg-amber-400 text-slate-950' : 'bg-teal-100 text-teal-900'
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
      <div className="border-t border-teal-900/10 p-3 bg-white">
        <div className="flex items-center justify-between rounded-xl bg-teal-50/70 p-2.5 border border-teal-200/80 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-900 text-amber-400 text-xs font-black ring-1 ring-amber-400/80 shadow-xs">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-slate-950">
                {profile.fullName}
              </p>
              <p className="truncate text-[10px] text-teal-800 font-bold">
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
    <div className="min-h-screen bg-slate-50 flex">
      {/* Subtle Institutional Brand Accent Header Line */}
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-teal-800" aria-hidden="true" />

      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:z-40 border-r border-slate-200">
        {sidebarContent}
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-teal-900 text-white font-bold lg:hidden">
              <BookOpen className="size-3.5" />
            </span>
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
              <span className="flex size-7 items-center justify-center rounded-md bg-teal-900 text-white text-[11px] font-bold">
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
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 pb-20 lg:pb-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar (Clean & Professional) */}
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-sm lg:hidden">
          <div className="grid grid-cols-5 h-14 max-w-lg mx-auto">
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
                      ? 'text-teal-900 font-bold'
                      : 'text-slate-500 hover:text-slate-800 font-medium'
                  )}
                >
                  <Icon
                    className={cn(
                      'size-5',
                      isActive ? 'text-teal-900 stroke-[2.2]' : 'text-slate-400'
                    )}
                  />
                  <span className="text-[10px] tracking-tight truncate max-w-[64px]">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
