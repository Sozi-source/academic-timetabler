'use client';

import {
  BarChart2,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  Clock,
  FileText,
  LayoutGrid,
  LogOut,
  Settings,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
}

export const adminNavItems: AdminNavItem[] = [
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
  {
    label: 'Action Centre',
    href: '/operations/action-center',
    icon: Zap,
  },
  {
    label: 'Settings',
    href: '/timetable/organization',
    icon: Settings,
  },
];

export function AdminSidebar({
  departmentName = 'Human Nutrition & Dietetics',
  mobileOpen = false,
  onMobileClose,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#033B36] text-white">
      {/* Brand Header */}
      <div className="flex items-center justify-between border-b border-[#0A4741] px-4 py-4">
        <Link
          href="/dashboard"
          onClick={onMobileClose}
          className="flex min-w-0 items-center gap-2.5"
        >
          {/* Gold-ringed Academic Crest */}
          <div className="relative flex size-8.5 shrink-0 items-center justify-center rounded-full bg-[#022A26] ring-1.5 ring-[#EAB308] ring-offset-1.5 ring-offset-[#033B36] shadow-xs">
            <BookOpen className="size-4 text-[#FACC15]" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-xs font-bold tracking-tight text-white leading-tight">
              Academic Planning
            </h1>
            <p className="truncate text-[10px] font-normal text-[#8EAAA5]">
              {departmentName}
            </p>
          </div>
        </Link>

        {onMobileClose ? (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close navigation"
            className="flex size-7 items-center justify-center rounded-lg text-[#8EAAA5] transition hover:bg-[#074741] hover:text-white lg:hidden"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* Navigation Links */}
      <nav aria-label="Admin navigation" className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-4">
        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors duration-150',
                isActive
                  ? 'bg-[#084D46] text-[#FEF08A] font-semibold shadow-2xs'
                  : 'text-[#B0C8C4] hover:bg-[#064741] hover:text-white',
              )}
            >
              {/* Left Accent Bar for Active State */}
              {isActive ? (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-[#FACC15]"
                  aria-hidden="true"
                />
              ) : null}

              <Icon
                className={cn(
                  'size-4 shrink-0 transition-colors',
                  isActive ? 'text-[#FACC15]' : 'text-[#8EAAA5] group-hover:text-white',
                )}
                aria-hidden="true"
              />

              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Sign Out */}
      <div className="border-t border-[#0A4741] p-2.5">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-[#B0C8C4] transition-colors hover:bg-[#064741] hover:text-white"
          >
            <LogOut className="size-4 shrink-0 text-[#8EAAA5]" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[215px] border-r border-[#0A4741] bg-[#033B36] shadow-lg lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onMobileClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          />

          <aside className="relative h-full w-[240px] max-w-[85vw] bg-[#033B36] shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      ) : null}
    </>
  );
}
