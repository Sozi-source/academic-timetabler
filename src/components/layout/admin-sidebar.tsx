'use client';

import {
  BarChart2,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  LayoutGrid,
  LogOut,
  Settings,
  ShieldCheck,
  User,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

import { logoutAction } from '@/features/auth/actions';
import { cn } from '@/lib/utils/cn';

interface AdminSidebarProps {
  departmentName?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export interface AdminNavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  exact?: boolean;
  badge?: string;
}

export interface AdminNavSection {
  title?: string;
  items: AdminNavItem[];
}

export const adminNavSections: AdminNavSection[] = [
  {
    title: 'Operations',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutGrid,
        exact: true,
      },
      {
        label: 'Daily Operations',
        href: '/operations',
        icon: Clock,
      },
      {
        label: 'Class Attendance',
        href: '/attendance-clinical/class-attendance',
        icon: CheckCircle2,
      },
      {
        label: 'Action Centre',
        href: '/operations/action-center',
        icon: Zap,
      },
    ],
  },
  {
    title: 'Academics & Quality',
    items: [
      {
        label: 'Academic Planning',
        href: '/timetable',
        icon: CalendarDays,
      },
      {
        label: 'Unit Registration',
        href: '/students/unit-registration',
        icon: BookOpenCheck,
      },
      {
        label: 'Quality Assurance',
        href: '/teaching-documents',
        icon: ShieldCheck,
      },
      {
        label: 'Grading & Results',
        href: '/assessment',
        icon: BarChart2,
      },
      {
        label: 'Reports',
        href: '/timetable/reports',
        icon: FileText,
      },
    ],
  },
  {
    title: 'Faculty & Students',
    items: [
      {
        label: 'Staff & Trainers',
        href: '/trainers',
        icon: Users,
      },
      {
        label: 'Student Registry',
        href: '/students/registry',
        icon: UserCheck,
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        label: 'Settings',
        href: '/timetable/organization',
        icon: Settings,
      },
    ],
  },
];

export const adminNavItems: AdminNavItem[] = adminNavSections.flatMap((section) => section.items);

export function isNavItemActive(
  pathname: string,
  itemHref: string,
  allHrefs: string[],
  exact?: boolean,
): boolean {
  if (exact || itemHref === '/dashboard') {
    return pathname === itemHref;
  }

  if (pathname === itemHref) {
    return true;
  }

  if (
    itemHref === '/attendance-clinical/class-attendance' &&
    (pathname === '/attendance' || pathname.startsWith('/attendance/'))
  ) {
    return true;
  }

  if (!pathname.startsWith(`${itemHref}/`)) {
    return false;
  }

  // Check if any other nav item has a more specific (longer) match
  const hasMoreSpecificMatch = allHrefs.some(
    (otherHref) =>
      otherHref !== itemHref &&
      otherHref.length > itemHref.length &&
      (pathname === otherHref || pathname.startsWith(`${otherHref}/`)),
  );

  return !hasMoreSpecificMatch;
}

export function AdminSidebar({
  departmentName = 'Human Nutrition & Dietetics',
  mobileOpen = false,
  onMobileClose,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const allHrefs = useMemo(() => adminNavItems.map((item) => item.href), []);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#062f2c] text-white">
      {/* Brand Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
        <Link
          href="/dashboard"
          onClick={onMobileClose}
          className="flex min-w-0 items-center gap-2.5"
        >
          {/* Gold-ringed Academic Crest */}
          <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#0b4540] ring-1 ring-[#f5c400]/80 shadow-sm">
            <BookOpen className="size-4 text-[#f5c400]" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-[0.72rem] font-bold tracking-tight text-white leading-tight">
              Department Management
            </h1>
            <p className="truncate text-[0.64rem] font-medium text-white/55">
              {departmentName}
            </p>
          </div>
        </Link>

        {onMobileClose ? (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close navigation"
            className="flex size-7 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* Grouped Navigation Links */}
      <nav aria-label="Admin navigation" className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4 scrollbar-thin">
        {adminNavSections.map((section, sIdx) => (
          <div key={section.title || `section-${sIdx}`} className="space-y-1">
            {section.title ? (
              <p className="px-3 pt-1 pb-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-white/40">
                {section.title}
              </p>
            ) : null}

            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = isNavItemActive(pathname, item.href, allHrefs, item.exact);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onMobileClose}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group relative flex min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-[0.72rem] font-semibold transition-all duration-150',
                    isActive
                      ? 'bg-white/10 text-[#f5c400] font-semibold shadow-sm ring-1 ring-white/5'
                      : 'text-white/65 hover:bg-white/8 hover:text-white',
                  )}
                >
                  {/* Left Accent Bar for Active State */}
                  {isActive ? (
                    <span
                      className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-[#f5c400]"
                      aria-hidden="true"
                    />
                  ) : null}

                  <Icon
                    className={cn(
                      'size-4 shrink-0 transition-colors',
                      isActive ? 'text-[#f5c400]' : 'text-white/45 group-hover:text-white',
                    )}
                    aria-hidden="true"
                  />

                  <span className="truncate">{item.label}</span>

                  {item.badge ? (
                    <span className="ml-auto rounded-full bg-[#0A4741] px-1.5 py-0.5 text-[9px] font-bold text-[#FACC15]">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Actions: Trainer Portal & Sign Out */}
      <div className="border-t border-white/10 p-3 space-y-1">
        <Link
          href="/staff"
          onClick={onMobileClose}
          className="flex w-full items-center gap-2.5 min-h-10 rounded-xl px-2.5 py-2 text-[0.72rem] font-semibold text-white/65 transition-colors hover:bg-white/8 hover:text-white"
        >
          <User className="size-4 shrink-0 text-white/45" aria-hidden="true" />
          <span>My Trainer Workspace</span>
        </Link>

        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 min-h-10 rounded-xl px-2.5 py-2 text-[0.72rem] font-semibold text-white/65 transition-colors hover:bg-white/8 hover:text-white"
          >
            <LogOut className="size-4 shrink-0 text-white/45" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] border-r border-[#0A4741] bg-[#033B36] shadow-lg lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onMobileClose}
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
          />

          <aside className="relative h-full w-[var(--sidebar-width)] max-w-[85vw] bg-[#062f2c] shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      ) : null}
    </>
  );
}
