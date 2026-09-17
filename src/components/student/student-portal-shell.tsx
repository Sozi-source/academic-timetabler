'use client';

import {
  ArrowLeft,
  BookOpenCheck,
  CalendarCheck2,
  CalendarDays,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  UserRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link, { useLinkStatus } from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { studentPortalLogout } from '@/features/student-portal/actions';
import type { StudentPortalIdentity } from '@/features/student-portal/types';
import { cn } from '@/lib/utils/cn';

interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { label: 'Dashboard', href: '/student', icon: LayoutDashboard },
  { label: 'My Units', href: '/student/units', icon: BookOpenCheck },
  { label: 'Timetable', href: '/student/timetable', icon: CalendarDays },
  { label: 'Registration', href: '/student/unit-registration', icon: ClipboardCheck },
  // Attendance view fully implemented, hidden from main navigation per management instruction
  // { label: 'Attendance', href: '/student/attendance', icon: CalendarCheck2 },
  { label: 'Documents', href: '/student/documents', icon: FileText },
  { label: 'Profile', href: '/student/profile', icon: UserRound },
];

interface MobileNavigationItem extends NavigationItem {
  tabKey: string;
}

const MOBILE_NAV_ITEMS: readonly MobileNavigationItem[] = [
  { label: 'Dashboard', href: '/student', icon: LayoutDashboard, tabKey: 'dashboard' },
  { label: 'Registration', href: '/student/unit-registration', icon: ClipboardCheck, tabKey: 'registration' },
  { label: 'Timetable', href: '/student/timetable', icon: CalendarDays, tabKey: 'timetable' },
  { label: 'Profile', href: '/student/profile', icon: UserRound, tabKey: 'profile' },
];

function getInitials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function NavigationProgress() {
  const { pending } = useLinkStatus();
  return pending ? <span className="portal-route-progress" aria-hidden="true" /> : null;
}

export function StudentPortalShell({
  student,
  children,
  isAdminPreview = false,
  studentId,
  activeTab = 'registration',
}: {
  student: StudentPortalIdentity;
  children: ReactNode;
  isAdminPreview?: boolean;
  studentId?: string;
  activeTab?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const studentInitials = getInitials(student.fullName) || 'ST';

  const getHref = (item: { href: string; tabKey?: string }) => {
    if (isAdminPreview && studentId) {
      const tab = item.tabKey || item.href.split('/').pop() || 'registration';
      return `/students/registry/${studentId}/portal-view?tab=${tab}`;
    }
    return item.href;
  };

  const isRouteActive = (href: string, tabKey?: string) => {
    if (isAdminPreview) {
      return activeTab === (tabKey || href.split('/').pop());
    }
    return pathname === href || (href !== '/student' && pathname.startsWith(`${href}/`));
  };

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#0b4f4a] text-white">
      {/* Brand Header */}
      <div className="flex h-[4.5rem] items-center gap-3 border-b border-white/10 px-5 bg-[#0b4f4a]">
        <span className="flex size-[2.375rem] shrink-0 items-center justify-center rounded-[0.625rem] bg-[#ffd400] text-[#0b4f4a] font-black shadow-md">
          <GraduationCap className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight text-white">
            Imperial College
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-white/70">
            Student Portal
          </p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5 space-y-1">
        <p className="mb-2.5 px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-white/55">
          Academics
        </p>
        {NAVIGATION_ITEMS.map((item) => {
          const active = isRouteActive(item.href);
          const Icon = item.icon;
          const href = getHref(item);

          return (
            <Link
              key={item.href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'relative flex min-h-11 items-center gap-3 rounded-xl border-l-[3px] px-3.5 text-xs font-semibold transition-all duration-150 active:scale-[0.98]',
                active
                  ? 'border-l-[#ffd400] bg-white/13 text-white font-bold shadow-xs'
                  : 'border-l-transparent text-white/80 hover:bg-white/8 hover:text-white'
              )}
            >
              <NavigationProgress />
              <span className="flex size-7 items-center justify-center rounded-lg text-white/80">
                <Icon className={cn('size-4.5', active ? 'text-[#ffd400]' : 'text-white/70')} />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Student Profile Card & Logout Footer */}
      <div className="border-t border-white/10 p-3 bg-[#0b4f4a]">
        <div className="flex items-center gap-3 rounded-xl bg-white/7 p-2.5 ring-1 ring-white/10 shadow-xs">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fff8cc] text-xs font-bold text-[#0b4f4a]">
            {studentInitials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{student.fullName}</p>
            <p className="mt-0.5 truncate text-[10px] font-medium text-white/60">
              {student.admissionNumber}
            </p>
          </div>
          <form action={studentPortalLogout}>
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="flex size-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white active:scale-95"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  if (isAdminPreview) {
    return (
      <div className="w-full space-y-4">
        {children}
      </div>
    );
  }

  return (
    <div className="academic-portal min-h-screen bg-background">
      {/* Top Institutional Accent Line */}
      <div className="fixed inset-x-0 top-0 z-[60] h-1 bg-[#ffd400]" aria-hidden="true" />

      {/* Desktop Fixed Left Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-width)] border-r border-border shadow-md lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden transition-[visibility] duration-300',
          mobileOpen ? 'visible' : 'invisible delay-300'
        )}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className={cn(
            'absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] transition-opacity duration-300',
            mobileOpen ? 'opacity-100' : 'opacity-0'
          )}
        />
        <div
          className={cn(
            'relative h-full w-[19rem] max-w-[86vw] shadow-2xl transition-transform duration-300 ease-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {sidebarContent}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-xl bg-white/10 text-white transition active:scale-95"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* Main Content Viewport */}
      <div className="min-w-0 lg:pl-[var(--sidebar-width)]">
        {/* Sticky Mobile/Desktop Top Header */}
        <header className="sticky top-0 z-30 flex h-[3.625rem] items-center justify-between border-b border-border bg-surface/95 px-3.5 shadow-2xs backdrop-blur-xl sm:px-6 lg:h-[4.625rem]">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] border border-border bg-surface text-primary-deep shadow-sm transition active:scale-95 lg:hidden"
            >
              <Menu className="size-[1.125rem]" />
            </button>
            {pathname !== '/student' && (
              <button
                type="button"
                onClick={() => router.back()}
                aria-label="Go back"
                title="Back"
                className="flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] border border-border bg-surface text-primary-deep shadow-sm transition hover:bg-primary-subtle active:scale-95"
              >
                <ArrowLeft className="size-[1.125rem]" />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">
                Student Workspace
              </p>
              <p className="truncate text-xs font-semibold text-text-primary sm:text-sm">
                {student.fullName}
              </p>
            </div>
          </div>

          <span className="flex size-8 items-center justify-center rounded-full bg-[#fff8cc] text-[11px] font-bold text-[#0b4f4a] ring-2 ring-white lg:size-9 lg:text-xs shadow-xs">
            {studentInitials}
          </span>
        </header>

        {/* Main Content Body */}
        <main className="portal-page-content w-full max-w-[var(--content-max-width)] px-4 py-3.5 pb-20 sm:px-6 sm:py-7 lg:px-8 lg:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Bar Navigation */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(11,79,74,.08)] backdrop-blur-xl lg:hidden">
          <div className="mx-auto grid h-[3.625rem] max-w-md grid-cols-5">
            {MOBILE_NAV_ITEMS.map((item) => {
              const active = isRouteActive(item.href, item.tabKey);
              const Icon = item.icon;
              const href = getHref(item);
              return (
                <Link
                  key={item.href}
                  href={href}
                  className={cn(
                    'relative flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition active:scale-95',
                    active ? 'text-primary' : 'text-text-muted hover:text-text-primary'
                  )}
                >
                  <NavigationProgress />
                  {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[#ffd400]" />}
                  <Icon className={cn('size-4.5', active && 'stroke-[2.2]')} />
                  <span className="max-w-[4.5rem] truncate">{item.label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex flex-col items-center justify-center gap-1 text-[10px] font-bold text-text-muted transition active:scale-95"
              aria-label="Open more navigation"
            >
              <Menu className="size-4.5" />
              <span>More</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
