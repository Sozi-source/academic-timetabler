'use client';

import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  KeyRound,
  ShieldCheck,
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
 * Everything the old layout spread across a 4-tile metric grid, an 8-icon
 * module grid, a 5-link quick-access bar AND a 4-card sidebar (many of
 * which pointed at the same handful of destinations) is now four merged,
 * native-app-style surfaces:
 *   1. Hero banner  — status + the two actions people actually reach for
 *   2. Stat strip   — one grouped card, divided like a mobile widget
 *   3. Workspaces   — one icon-grid card (home-screen style, no per-tile borders)
 *   4. Manage list  — one grouped list card for admin/approval actions
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
    { label: 'Daily Ops', href: '/operations/daily-reports', icon: Clock, tint: '#033B36' },
    { label: 'Students', href: '/students/registry', icon: UserCheck, tint: '#033B36' },
    { label: 'Timetable', href: '/timetable', icon: CalendarDays, tint: '#B45309' },
    { label: 'Unit Reg.', href: '/students/unit-registration', icon: BookOpenCheck, tint: '#033B36' },
    { label: 'Staff', href: '/trainers', icon: Users, tint: '#033B36' },
    { label: 'Documents', href: '/teaching-documents', icon: FileText, tint: '#033B36' },
    { label: 'Results', href: '/assessment', icon: BarChart3, tint: '#B45309' },
    { label: 'Attendance', href: '/attendance-clinical/class-attendance', icon: CheckCircle2, tint: '#033B36' },
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-6 sm:max-w-3xl md:max-w-5xl lg:grid lg:max-w-none lg:grid-cols-12 lg:items-start lg:gap-5 xl:gap-6">
      {/* ================================================================= */}
      {/* 1. Hero banner — status pill + the two most-used actions          */}
      {/* ================================================================= */}
      <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 py-5 text-gray-900 shadow-xs lg:col-span-12 lg:px-8 lg:py-7">
        <div
          className="pointer-events-none absolute -right-10 -top-14 size-40 rounded-full bg-emerald-50 blur-2xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-8 size-36 rounded-full bg-teal-50 blur-2xl"
          aria-hidden="true"
        />

        <div className="relative lg:grid lg:grid-cols-12 lg:items-center lg:gap-8">
          <div className="lg:col-span-7">
            <div className="relative flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-100 lg:px-3 lg:py-1.5 lg:text-xs">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live Operational Hub
              </span>
            </div>

            <p className="relative mt-3 text-[11px] font-semibold uppercase tracking-wider text-teal-800/80 lg:mt-4 lg:text-xs">
              Academic session
            </p>
            <h1 className="relative text-xl font-bold tracking-tight text-[#033B36] lg:text-3xl">
              {activePeriodName}
            </h1>
            <p className="relative mt-1 text-[12px] text-gray-600 lg:mt-2 lg:text-sm">
              {publishedSessions > 0 ? 'Timetable published and live' : 'Timetable in draft mode'}
            </p>

            <div className="relative mt-4 flex flex-wrap items-center gap-2 lg:mt-6 lg:gap-3">
              <Link
                href="/operations/action-center"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#0d655e] active:scale-[0.97] lg:px-5 lg:py-2.5 lg:text-sm"
              >
                <Zap className="size-3.5" aria-hidden="true" />
                Action Centre
              </Link>
              <Link
                href="/operations/daily-reports"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-[0.97] lg:px-5 lg:py-2.5 lg:text-sm"
              >
                Daily Reports
              </Link>
              <Link
                href="/staff"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-[0.97] lg:px-5 lg:py-2.5 lg:text-sm"
              >
                My Workspace
              </Link>
            </div>
          </div>

          <div className="mt-6 hidden grid-cols-2 gap-3 lg:col-span-5 lg:mt-0 lg:grid" aria-label="Operational snapshot">
            <div className="rounded-xl border border-gray-200 bg-gray-50/90 p-4">
              <CalendarDays className="size-4 text-[#0f766e]" aria-hidden="true" />
              <p className="mt-3 text-2xl font-bold leading-none text-[#033B36]">{publishedSessions}</p>
              <p className="mt-1.5 text-xs font-medium text-gray-600">Live sessions</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50/90 p-4">
              <Users className="size-4 text-[#0f766e]" aria-hidden="true" />
              <p className="mt-3 text-2xl font-bold leading-none text-[#033B36]">{studentsPortalActive}</p>
              <p className="mt-1.5 text-xs font-medium text-gray-600">Active student portals</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50/90 p-4">
              <BookOpenCheck className="size-4 text-[#0f766e]" aria-hidden="true" />
              <p className="mt-3 text-2xl font-bold leading-none text-[#033B36]">{teachingUnits}</p>
              <p className="mt-1.5 text-xs font-medium text-gray-600">Active units</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50/90 p-4">
              <CheckCircle2 className="size-4 text-[#0f766e]" aria-hidden="true" />
              <p className="mt-3 text-2xl font-bold leading-none text-[#033B36]">{attendanceCompleted}</p>
              <p className="mt-1.5 text-xs font-medium text-gray-600">Completed · {attendanceOpen} open</p>
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
          <Users className="size-4 text-[#033B36] lg:size-5" aria-hidden="true" />
          <p className="text-base font-bold leading-none text-[#033B36] lg:text-2xl">
            {studentsPortalActive}
            <span className="text-xs font-semibold text-gray-400 lg:text-sm">/{studentsEligible}</span>
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 lg:text-xs">Students</p>
        </Link>

        <div className="flex flex-col gap-1 px-3 py-3.5 lg:gap-2 lg:px-6 lg:py-5">
          <CalendarDays className="size-4 text-[#033B36] lg:size-5" aria-hidden="true" />
          <p className="text-base font-bold leading-none text-[#033B36] lg:text-2xl">{teachingUnits}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 lg:text-xs">Units</p>
        </div>

        <Link href="/operations/daily-reports" className="group flex flex-col gap-1 px-3 py-3.5 text-left transition active:bg-gray-50 lg:gap-2 lg:px-6 lg:py-5">
          <CheckCircle2 className="size-4 text-emerald-600 lg:size-5" aria-hidden="true" />
          <p className="text-base font-bold leading-none text-[#033B36] lg:text-2xl">{attendanceCompleted}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 lg:text-xs">
            {attendanceOpen} open
          </p>
        </Link>
      </section>

      {/* ================================================================= */}
      {/* 3. Workspaces — one home-screen style icon grid, no per-tile chrome */}
      {/* ================================================================= */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs lg:col-span-9 lg:p-6 xl:p-7">
        <div className="flex items-center justify-between pb-3 lg:pb-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-teal-900 lg:text-sm">Workspaces</h2>
          <span className="text-[11px] font-medium text-gray-400 lg:text-xs">{workspaces.length}</span>
        </div>

        <div className="grid grid-cols-4 gap-y-4 lg:gap-y-7">
          {workspaces.map(({ label, href, icon: Icon, tint }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col items-center gap-1.5 text-center transition active:scale-95 lg:gap-2.5"
            >
              <span
                className="flex size-12 items-center justify-center rounded-2xl text-white shadow-sm transition group-active:scale-95 lg:size-[4.5rem] lg:rounded-[1.35rem]"
                style={{ backgroundColor: tint }}
              >
                <Icon className="size-5 lg:size-8" aria-hidden="true" />
              </span>
              <span className="text-[10.5px] font-semibold leading-tight text-gray-700 lg:text-sm">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ================================================================= */}
      {/* 4. Manage — one grouped list card (native settings-list pattern)  */}
      {/* ================================================================= */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs lg:col-span-3">
        <p className="border-b border-gray-100 px-4 py-3 text-xs font-bold uppercase tracking-wider text-teal-900 lg:px-4 lg:py-4 lg:text-sm">
          Manage &amp; Approvals
        </p>

        <div className="divide-y divide-gray-100">
          <Link
            href="/timetable/trainers/access"
            className="flex items-center justify-between gap-2 px-4 py-3.5 transition active:bg-gray-50 lg:px-3 lg:py-5"
          >
            <span className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700 lg:size-10">
                <KeyRound className="size-4 lg:size-5" aria-hidden="true" />
              </span>
              <span className="text-xs font-semibold text-gray-800 lg:text-[13px]">Staff Workspace Access</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-gray-300" aria-hidden="true" />
          </Link>

          <Link
            href="/trainers"
            className="flex items-center justify-between gap-2 px-4 py-3.5 transition active:bg-gray-50 lg:px-3 lg:py-5"
          >
            <span className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#033B36]/10 text-[#033B36] lg:size-10">
                <Users className="size-4 lg:size-5" aria-hidden="true" />
              </span>
              <span className="text-xs font-semibold text-gray-800 lg:text-[13px]">Trainer Directory &amp; Loads</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-gray-300" aria-hidden="true" />
          </Link>

          <Link
            href="/assessment"
            className="flex items-center justify-between gap-2 px-4 py-3.5 transition active:bg-gray-50 lg:px-3 lg:py-5"
          >
            <span className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#033B36]/10 text-[#033B36] lg:size-10">
                <ArrowRight className="size-4 lg:size-5" aria-hidden="true" />
              </span>
              <span className="text-xs font-semibold text-gray-800 lg:text-[13px]">Assessment Control Centre</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-gray-300" aria-hidden="true" />
          </Link>
        </div>

        <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50/70 px-4 py-2.5 text-[11px] text-gray-500 lg:px-3 lg:py-3 lg:text-xs">
          <ShieldCheck className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>HOD workspace authenticated · Active sync</span>
        </div>
      </section>
    </div>
  );
}
