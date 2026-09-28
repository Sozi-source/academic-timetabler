'use client';

import {
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardViewProps {
  departmentName: string;
  activePeriodName: string;
  snapshot: any;
}

/**
 * Responsive admin home: compact and stacked on mobile, full workspace on desktop.
 *
 * The dashboard keeps its core actions and metrics compact while giving
 * workspace destinations full-width, Business Central-style launch cards:
 *   1. Hero banner  — status + the two actions people actually reach for
 *   2. Stat strip   — one grouped card, divided like a mobile widget
 *   3. Workspaces   — full-width rectangular launch cards
 */
export function DashboardView({
  activePeriodName,
  snapshot,
}: DashboardViewProps) {
  const studentsEligible = snapshot?.students?.eligible ?? 185;
  const studentsPortalActive = snapshot?.students?.portalActive ?? 65;

  const teachingUnits = snapshot?.timetable?.activeAllocations ?? 63;
  const publishedSessions = snapshot?.timetable?.publishedSessions ?? 0;

  const attendanceCompleted = snapshot?.attendance?.completed ?? 0;
  const attendanceOpen = snapshot?.attendance?.open ?? 1;

  const workspaces = [
    { label: 'Daily Ops', href: '/operations/daily-reports', icon: Clock },
    { label: 'Students', href: '/students/registry', icon: UserCheck },
    { label: 'Timetable', href: '/timetable', icon: CalendarDays },
    { label: 'Unit Reg.', href: '/students/unit-registration', icon: BookOpenCheck },
    { label: 'Staff', href: '/trainers', icon: Users },
    { label: 'Documents', href: '/teaching-documents', icon: FileText },
    { label: 'Results', href: '/assessment', icon: BarChart3 },
    { label: 'Attendance', href: '/attendance-clinical/class-attendance', icon: CheckCircle2 },
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-6 font-sans sm:max-w-3xl md:max-w-5xl lg:grid lg:max-w-none lg:grid-cols-12 lg:items-start lg:gap-5 xl:gap-6">
      {/* ================================================================= */}
      {/* 1. Hero banner — status pill + the two most-used actions          */}
      {/* ================================================================= */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface px-5 py-5 text-text-primary shadow-xs lg:col-span-12 lg:px-8 lg:py-7">
        <div className="relative lg:grid lg:grid-cols-12 lg:items-center lg:gap-8">
          <div className="lg:col-span-7">
            <div className="relative flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary-deep ring-1 ring-primary-soft lg:px-3 lg:py-1.5 lg:text-xs">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                Live Operational Hub
              </span>
            </div>

            <p className="relative mt-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary lg:mt-4 lg:text-xs">
              Academic session
            </p>
            <h1 className="relative text-xl font-semibold tracking-tight text-text-primary lg:text-3xl">
              {activePeriodName}
            </h1>
            <p className="relative mt-1 text-[12px] text-text-secondary lg:mt-2 lg:text-sm">
              {publishedSessions > 0 ? 'Timetable published and live' : 'Timetable in draft mode'}
            </p>

            <div className="relative mt-4 flex flex-wrap items-center gap-2 lg:mt-6 lg:gap-3">
              <Link
                href="/operations/action-center"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover active:scale-[0.97] lg:px-5 lg:py-2.5 lg:text-sm"
              >
                <Zap className="size-3.5" aria-hidden="true" />
                Action Centre
              </Link>
              <Link
                href="/operations/daily-reports"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle active:scale-[0.97] lg:px-5 lg:py-2.5 lg:text-sm"
              >
                Daily Reports
              </Link>
              <Link
                href="/staff"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle active:scale-[0.97] lg:px-5 lg:py-2.5 lg:text-sm"
              >
                My Workspace
              </Link>
            </div>
          </div>

          <div className="mt-6 hidden grid-cols-2 gap-3 lg:col-span-5 lg:mt-0 lg:grid" aria-label="Operational snapshot">
            <div className="rounded-xl border border-border bg-surface-subtle p-4">
              <CalendarDays className="size-4 text-primary" aria-hidden="true" />
              <p className="mt-3 text-2xl font-bold leading-none text-text-primary">{publishedSessions}</p>
              <p className="mt-1.5 text-xs font-medium text-text-secondary">Live sessions</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-subtle p-4">
              <Users className="size-4 text-primary" aria-hidden="true" />
              <p className="mt-3 text-2xl font-bold leading-none text-text-primary">{studentsPortalActive}</p>
              <p className="mt-1.5 text-xs font-medium text-text-secondary">Active student portals</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-subtle p-4">
              <BookOpenCheck className="size-4 text-primary" aria-hidden="true" />
              <p className="mt-3 text-2xl font-bold leading-none text-text-primary">{teachingUnits}</p>
              <p className="mt-1.5 text-xs font-medium text-text-secondary">Active units</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-subtle p-4">
              <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
              <p className="mt-3 text-2xl font-bold leading-none text-text-primary">{attendanceCompleted}</p>
              <p className="mt-1.5 text-xs font-medium text-text-secondary">Completed · {attendanceOpen} open</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 2. Stat strip — one grouped card, divided like a mobile widget     */}
      {/* ================================================================= */}
      <section
        aria-label="Department metrics"
        className="grid grid-cols-3 divide-x divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs lg:hidden"
      >
        <Link href="/students/registry" className="group flex flex-col gap-1 px-3 py-3.5 text-left transition active:bg-gray-50 lg:gap-2 lg:px-6 lg:py-5">
          <Users className="size-4 text-primary lg:size-5" aria-hidden="true" />
          <p className="text-base font-bold leading-none text-text-primary lg:text-2xl">
            {studentsPortalActive}
            <span className="text-xs font-semibold text-text-muted lg:text-sm">/{studentsEligible}</span>
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary lg:text-xs">Students</p>
        </Link>

        <div className="flex flex-col gap-1 px-3 py-3.5 lg:gap-2 lg:px-6 lg:py-5">
          <CalendarDays className="size-4 text-primary lg:size-5" aria-hidden="true" />
          <p className="text-base font-bold leading-none text-text-primary lg:text-2xl">{teachingUnits}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary lg:text-xs">Units</p>
        </div>

        <Link href="/operations/daily-reports" className="group flex flex-col gap-1 px-3 py-3.5 text-left transition active:bg-gray-50 lg:gap-2 lg:px-6 lg:py-5">
          <CheckCircle2 className="size-4 text-success lg:size-5" aria-hidden="true" />
          <p className="text-base font-bold leading-none text-text-primary lg:text-2xl">{attendanceCompleted}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary lg:text-xs">
            {attendanceOpen} open
          </p>
        </Link>
      </section>

      {/* ================================================================= */}
      {/* Workspace cards span full width */}
      {/* ================================================================= */}
      <section className="rounded-xl border border-border bg-surface p-4 shadow-xs lg:col-span-12 lg:p-5">
        <div className="flex items-center justify-between pb-3 lg:pb-5">
          <h2 className="text-sm font-semibold text-text-primary lg:text-base">Workspaces</h2>
          <span className="rounded-md bg-surface-subtle px-2 py-1 text-xs font-medium tabular-nums text-text-muted">{workspaces.length}</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 lg:gap-3">
          {workspaces.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-h-[5.75rem] items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3 text-left transition hover:border-primary/40 hover:bg-surface-subtle hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-border active:bg-primary-subtle sm:px-4"
            >
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-deep transition group-hover:bg-primary group-hover:text-primary-foreground"
              >
                <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold leading-snug text-text-primary">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}
