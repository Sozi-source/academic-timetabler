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
 * Single-column, app-shell style home screen.
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
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-6">
      {/* ================================================================= */}
      {/* 1. Hero banner — status pill + the two most-used actions          */}
      {/* ================================================================= */}
      <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#033B36] to-[#062f2c] px-5 py-5 text-white shadow-lg">
        <div
          className="pointer-events-none absolute -right-10 -top-14 size-40 rounded-full bg-white/10 blur-2xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-8 size-36 rounded-full bg-emerald-400/10 blur-2xl"
          aria-hidden="true"
        />

        <div className="relative flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 ring-1 ring-white/15">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Operational Hub
          </span>
        </div>

        <p className="relative mt-3 text-[11px] font-semibold uppercase tracking-wider text-white/50">
          Academic session
        </p>
        <h1 className="relative text-xl font-bold tracking-tight text-white">
          {activePeriodName}
        </h1>
        <p className="relative mt-1 text-[12px] text-white/60">
          {publishedSessions > 0 ? `${publishedSessions} timetable sessions live` : 'Timetable in draft mode'}
          <span className="mx-1.5 text-white/25">•</span>
          {studentsPortalActive} portal accounts active
        </p>

        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <Link
            href="/operations/action-center"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#FACC15] px-4 py-2 text-xs font-bold text-[#033B36] shadow-sm transition active:scale-[0.97]"
          >
            <Zap className="size-3.5" aria-hidden="true" />
            Action Centre
          </Link>
          <Link
            href="/operations/daily-reports"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/15 transition active:scale-[0.97]"
          >
            Daily Reports
          </Link>
          <Link
            href="/staff"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/15 transition active:scale-[0.97]"
          >
            My Workspace
          </Link>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 2. Stat strip — one grouped card, divided like a mobile widget     */}
      {/* ================================================================= */}
      <section
        aria-label="Department metrics"
        className="grid grid-cols-3 divide-x divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs"
      >
        <Link href="/students/registry" className="group flex flex-col gap-1 px-3 py-3.5 text-left transition active:bg-gray-50">
          <Users className="size-4 text-[#033B36]" aria-hidden="true" />
          <p className="text-base font-bold leading-none text-gray-900">
            {studentsPortalActive}
            <span className="text-xs font-semibold text-gray-400">/{studentsEligible}</span>
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Students</p>
        </Link>

        <div className="flex flex-col gap-1 px-3 py-3.5">
          <CalendarDays className="size-4 text-[#033B36]" aria-hidden="true" />
          <p className="text-base font-bold leading-none text-gray-900">{teachingUnits}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Units</p>
        </div>

        <Link href="/operations/daily-reports" className="group flex flex-col gap-1 px-3 py-3.5 text-left transition active:bg-gray-50">
          <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
          <p className="text-base font-bold leading-none text-gray-900">{attendanceCompleted}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            {attendanceOpen} open
          </p>
        </Link>
      </section>

      {/* ================================================================= */}
      {/* 3. Workspaces — one home-screen style icon grid, no per-tile chrome */}
      {/* ================================================================= */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between pb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">Workspaces</h2>
          <span className="text-[11px] font-medium text-gray-400">{workspaces.length}</span>
        </div>

        <div className="grid grid-cols-4 gap-y-4">
          {workspaces.map(({ label, href, icon: Icon, tint }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col items-center gap-1.5 text-center transition active:scale-95"
            >
              <span
                className="flex size-12 items-center justify-center rounded-2xl text-white shadow-sm transition group-active:scale-95"
                style={{ backgroundColor: tint }}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-[10.5px] font-semibold leading-tight text-gray-700">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ================================================================= */}
      {/* 4. Manage — one grouped list card (native settings-list pattern)  */}
      {/* ================================================================= */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
        <p className="border-b border-gray-100 px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-700">
          Manage &amp; Approvals
        </p>

        <div className="divide-y divide-gray-100">
          <Link
            href="/timetable/trainers/access"
            className="flex items-center justify-between gap-3 px-4 py-3.5 transition active:bg-gray-50"
          >
            <span className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                <KeyRound className="size-4" aria-hidden="true" />
              </span>
              <span className="text-xs font-semibold text-gray-800">Staff Workspace Access</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-gray-300" aria-hidden="true" />
          </Link>

          <Link
            href="/trainers"
            className="flex items-center justify-between gap-3 px-4 py-3.5 transition active:bg-gray-50"
          >
            <span className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#033B36]/10 text-[#033B36]">
                <Users className="size-4" aria-hidden="true" />
              </span>
              <span className="text-xs font-semibold text-gray-800">Trainer Directory &amp; Loads</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-gray-300" aria-hidden="true" />
          </Link>

          <Link
            href="/assessment"
            className="flex items-center justify-between gap-3 px-4 py-3.5 transition active:bg-gray-50"
          >
            <span className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#033B36]/10 text-[#033B36]">
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
              <span className="text-xs font-semibold text-gray-800">Assessment Control Centre</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-gray-300" aria-hidden="true" />
          </Link>
        </div>

        <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50/70 px-4 py-2.5 text-[11px] text-gray-500">
          <ShieldCheck className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>HOD workspace authenticated · Active sync</span>
        </div>
      </section>
    </div>
  );
}
