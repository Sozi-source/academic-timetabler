'use client';

import {
  BookOpenCheck,
  CalendarDays,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  UserRound,
  ClipboardCheck,
} from 'lucide-react';
import type {
  LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import {
  usePathname,
} from 'next/navigation';
import type {
  ReactNode,
} from 'react';

import {
  Button,
} from '@/components/ui/button';
import {
  studentPortalLogout,
} from '@/features/student-portal/actions';
import type {
  StudentPortalIdentity,
} from '@/features/student-portal/types';
import {
  cn,
} from '@/lib/utils/cn';

interface NavigationItem {
  label:
    string;
  href:
    string;
  icon:
    LucideIcon;
}

const navigation:
readonly NavigationItem[] = [
  {
    label:
      'Dashboard',
    href:
      '/student',
    icon:
      LayoutDashboard,
  },
  {
    label:
      'My Units',
    href:
      '/student/units',
    icon:
      BookOpenCheck,
  },
  {
    label:
      'Timetable',
    href:
      '/student/timetable',
    icon:
      CalendarDays,
  },
  {
    label:
      'Registration',
    href:
      '/student/unit-registration',
    icon:
      ClipboardCheck,
  },
  {
    label:
      'Results',
    href:
      '/student/results',
    icon:
      GraduationCap,
  },
  {
    label:
      'Documents',
    href:
      '/student/documents',
    icon:
      FileText,
  },
  {
    label:
      'Profile',
    href:
      '/student/profile',
    icon:
      UserRound,
  },
];

function initials(
  fullName:
    string,
) {
  return fullName
    .trim()
    .split(
      /\s+/,
    )
    .slice(
      0,
      2,
    )
    .map(
      (part) =>
        part[0]
          ?.toUpperCase(),
    )
    .join(
      '',
    );
}

export function StudentPortalShell({
  student,
  children,
}: {
  student:
    StudentPortalIdentity;
  children:
    ReactNode;
}) {
  const pathname =
    usePathname();

  return (
    <div className="min-h-screen bg-surface-subtle">
      <div
        className="h-1 bg-institutional-yellow"
        aria-hidden="true"
      />

      <header className="bg-primary text-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-institutional-yellow text-[11px] font-extrabold text-institutional-yellow-ink">
              {
                initials(
                  student.fullName,
                ) ||
                'ST'
              }
            </span>

            <div className="min-w-0">
              <p className="truncate text-xs font-bold">
                {
                  student.fullName
                }
              </p>

              <p className="mt-0.5 truncate text-[10px] text-white/65">
                {
                  student.admissionNumber
                }
                {student.cohortName
                  ? ` · ${student.cohortName}`
                  : ''}
              </p>
            </div>
          </div>

          <form
            action={
              studentPortalLogout
            }
          >
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <LogOut
                className="size-3.5"
                aria-hidden="true"
              />
              <span className="hidden sm:inline">
                Sign out
              </span>
            </Button>
          </form>
        </div>
      </header>

      <nav className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-2 sm:px-5">
          {navigation.map(
            (
              item,
            ) => {
              const active =
                pathname ===
                  item.href ||
                (
                  item.href !==
                    '/student' &&
                  pathname.startsWith(
                    `${item.href}/`,
                  )
                );

              const Icon =
                item.icon;

              return (
                <Link
                  key={
                    item.href
                  }
                  href={
                    item.href
                  }
                  className={cn(
                    'inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition',
                    active
                      ? 'bg-primary text-white'
                      : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary',
                  )}
                >
                  <Icon
                    className="size-3.5"
                    aria-hidden="true"
                  />
                  {
                    item.label
                  }
                </Link>
              );
            },
          )}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
        {
          children
        }
      </main>
    </div>
  );
}
