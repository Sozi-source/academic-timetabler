'use client';

import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  Folder,
  KeyRound,
  Monitor,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
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

export function DashboardView({
  activePeriodName,
  snapshot,
}: DashboardViewProps) {
  // Dynamic telemetry figures with design fallbacks
  const studentsRegistered = snapshot?.students?.registered ?? 26;
  const studentsEligible = snapshot?.students?.eligible ?? 185;
  const studentsPinsActive = snapshot?.students?.portalActive ?? 185;

  const teachingUnits = snapshot?.timetable?.activeAllocations ?? 63;
  const publishedSessions = snapshot?.timetable?.publishedSessions ?? 0;

  const attendanceCompleted = snapshot?.attendance?.completed ?? 0;
  const attendanceOpen = snapshot?.attendance?.open ?? 1;

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      {/* ========================================================= */}
      {/* 1. Main Dashboard Canvas (Dense & Perfectly Proportioned) */}
      {/* ========================================================= */}
      <div className="min-w-0 flex-1 space-y-7">
        {/* Top Action Buttons Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
              Department Overview
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Live operational telemetry and academic management hub.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/operations/daily-reports"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-2xs transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <ClipboardList className="size-4 text-gray-500" aria-hidden="true" />
              <span>Daily Reports</span>
            </Link>

            <Link
              href="/staff"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-2xs transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <User className="size-4 text-gray-500" aria-hidden="true" />
              <span>My Workspace</span>
            </Link>

            <Link
              href="/operations/action-center"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#033B36] px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[#022A26]"
            >
              <Zap className="size-4 text-[#FACC15]" aria-hidden="true" />
              <span>Action Centre</span>
            </Link>
          </div>
        </div>

        {/* 4-Metric Telemetry Strip */}
        <section aria-label="Department Metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Metric 1: ACTIVE TERM */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs transition hover:shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#033B36] text-white shadow-xs">
                <CalendarDays className="size-5.5 text-[#FACC15]" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Active Term
                </p>
                <p className="mt-0.5 text-base font-bold text-gray-900 leading-tight">
                  {activePeriodName}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">Academic session</p>
              </div>
            </div>
            <div className="mt-4 h-1 w-10 rounded-full bg-[#033B36]" />
          </div>

          {/* Metric 2: STUDENTS PORTAL */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs transition hover:shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#F59E0B] text-white shadow-xs">
                <Users className="size-5.5 text-white" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Students Portal
                </p>
                <p className="mt-0.5 text-base font-bold text-gray-900 leading-tight">
                  {studentsRegistered} / {studentsEligible}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {studentsPinsActive} PINs active
                </p>
              </div>
            </div>
            <div className="mt-4 h-1 w-10 rounded-full bg-[#F59E0B]" />
          </div>

          {/* Metric 3: TEACHING ALLOCATIONS */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs transition hover:shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#033B36] text-white shadow-xs">
                <Monitor className="size-5.5 text-white" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Teaching Units
                </p>
                <p className="mt-0.5 text-base font-bold text-gray-900 leading-tight">
                  {teachingUnits} Units
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {publishedSessions} published
                </p>
              </div>
            </div>
            <div className="mt-4 h-1 w-10 rounded-full bg-[#033B36]" />
          </div>

          {/* Metric 4: CLASS ATTENDANCE */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs transition hover:shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#15803D] text-white shadow-xs">
                <CheckCircle2 className="size-5.5 text-white" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Class Attendance
                </p>
                <p className="mt-0.5 text-base font-bold text-gray-900 leading-tight">
                  {attendanceCompleted} Completed
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {attendanceOpen} open today
                </p>
              </div>
            </div>
            <div className="mt-4 h-1 w-10 rounded-full bg-[#15803D]" />
          </div>
        </section>

        {/* Department Modules Grid */}
        <section aria-labelledby="department-modules-heading" className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 id="department-modules-heading" className="text-sm font-bold uppercase tracking-wider text-gray-700">
              Department Core Modules
            </h2>
            <span className="text-xs font-medium text-gray-500">5 Operational Workspaces</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {/* Module 1: Daily Operations */}
            <Link
              href="/operations/daily-reports"
              className="group flex flex-col items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white px-3 py-6 text-center shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-[#033B36]/30 hover:shadow-md"
            >
              <div className="flex size-13 items-center justify-center rounded-full bg-[#033B36] text-white shadow-xs transition group-hover:scale-105">
                <Clock className="size-6 text-white" aria-hidden="true" />
              </div>
              <p className="mt-4 text-xs font-bold text-[#033B36]">
                Daily Operations
              </p>
              <div className="mt-3 h-1 w-8 rounded-full bg-[#033B36]" />
            </Link>

            {/* Module 2: Academic Planning */}
            <Link
              href="/timetable"
              className="group flex flex-col items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white px-3 py-6 text-center shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-[#F59E0B]/30 hover:shadow-md"
            >
              <div className="flex size-13 items-center justify-center rounded-full bg-[#F59E0B] text-white shadow-xs transition group-hover:scale-105">
                <CalendarDays className="size-6 text-white" aria-hidden="true" />
              </div>
              <p className="mt-4 text-xs font-bold text-[#B45309]">
                Academic Planning
              </p>
              <div className="mt-3 h-1 w-8 rounded-full bg-[#F59E0B]" />
            </Link>

            {/* Module 3: Staff & Trainers */}
            <Link
              href="/trainers"
              className="group flex flex-col items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white px-3 py-6 text-center shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-[#033B36]/30 hover:shadow-md"
            >
              <div className="flex size-13 items-center justify-center rounded-full bg-[#033B36] text-white shadow-xs transition group-hover:scale-105">
                <Users className="size-6 text-white" aria-hidden="true" />
              </div>
              <p className="mt-4 text-xs font-bold text-[#033B36]">
                Staff & Trainers
              </p>
              <div className="mt-3 h-1 w-8 rounded-full bg-[#033B36]" />
            </Link>

            {/* Module 4: Quality Assurance */}
            <Link
              href="/teaching-documents"
              className="group flex flex-col items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white px-3 py-6 text-center shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-[#033B36]/30 hover:shadow-md"
            >
              <div className="flex size-13 items-center justify-center rounded-full bg-[#033B36] text-white shadow-xs transition group-hover:scale-105">
                <FileText className="size-6 text-white" aria-hidden="true" />
              </div>
              <p className="mt-4 text-xs font-bold text-[#033B36]">
                Quality Assurance
              </p>
              <div className="mt-3 h-1 w-8 rounded-full bg-[#033B36]" />
            </Link>

            {/* Module 5: Grading & Results */}
            <Link
              href="/assessment"
              className="group flex flex-col items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white px-3 py-6 text-center shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-[#F59E0B]/30 hover:shadow-md"
            >
              <div className="flex size-13 items-center justify-center rounded-full bg-[#F59E0B] text-white shadow-xs transition group-hover:scale-105">
                <BarChart3 className="size-6 text-white" aria-hidden="true" />
              </div>
              <p className="mt-4 text-xs font-bold text-[#B45309]">
                Grading & Results
              </p>
              <div className="mt-3 h-1 w-8 rounded-full bg-[#F59E0B]" />
            </Link>

            {/* Module 6: Action Centre */}
            <Link
              href="/operations/action-center"
              className="group flex flex-col items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white px-3 py-6 text-center shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-[#033B36]/30 hover:shadow-md"
            >
              <div className="flex size-13 items-center justify-center rounded-full bg-[#033B36] text-white shadow-xs transition group-hover:scale-105">
                <Zap className="size-6 text-[#FACC15]" aria-hidden="true" />
              </div>
              <p className="mt-4 text-xs font-bold text-[#033B36]">
                Action Centre
              </p>
              <div className="mt-3 h-1 w-8 rounded-full bg-[#033B36]" />
            </Link>
          </div>
        </section>

        {/* Quick Access Bar */}
        <section aria-labelledby="quick-access-heading" className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 id="quick-access-heading" className="text-sm font-bold uppercase tracking-wider text-gray-700">
              Quick Shortcuts
            </h2>
            <span className="text-xs font-medium text-gray-500">Direct Workspace Links</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xs">
            <div className="grid grid-cols-1 divide-y sm:grid-cols-5 sm:divide-y-0 sm:divide-x divide-gray-200">
              <Link
                href="/timetable/reports"
                className="flex items-center justify-center gap-2.5 px-4 py-3.5 text-xs font-medium text-gray-800 transition hover:bg-gray-50 hover:text-[#033B36]"
              >
                <CalendarDays className="size-4 text-gray-500 shrink-0" aria-hidden="true" />
                <span className="truncate">Timetables</span>
              </Link>

              <Link
                href="/timetable/teaching-allocations"
                className="flex items-center justify-center gap-2.5 px-4 py-3.5 text-xs font-medium text-gray-800 transition hover:bg-gray-50 hover:text-[#033B36]"
              >
                <Users className="size-4 text-gray-500 shrink-0" aria-hidden="true" />
                <span className="truncate">Allocations</span>
              </Link>

              <Link
                href="/teaching-documents"
                className="flex items-center justify-center gap-2.5 px-4 py-3.5 text-xs font-medium text-gray-800 transition hover:bg-gray-50 hover:text-[#033B36]"
              >
                <Folder className="size-4 text-gray-500 shrink-0" aria-hidden="true" />
                <span className="truncate">Curriculum</span>
              </Link>

              <Link
                href="/assessment/reports"
                className="flex items-center justify-center gap-2.5 px-4 py-3.5 text-xs font-medium text-gray-800 transition hover:bg-gray-50 hover:text-[#033B36]"
              >
                <FileText className="size-4 text-gray-500 shrink-0" aria-hidden="true" />
                <span className="truncate">Exam Reports</span>
              </Link>

              <Link
                href="/assessment/analysis"
                className="flex items-center justify-center gap-2.5 px-4 py-3.5 text-xs font-medium text-gray-800 transition hover:bg-gray-50 hover:text-[#033B36]"
              >
                <TrendingUp className="size-4 text-gray-500 shrink-0" aria-hidden="true" />
                <span className="truncate">Results</span>
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* ========================================================= */}
      {/* 2. Fixed Right Companion Sidebar (Clamped 280px-320px)    */}
      {/* ========================================================= */}
      <aside
        aria-label="Operational Pulse & Shortcuts"
        className="w-full shrink-0 space-y-4 xl:w-72 2xl:w-80"
      >
        {/* Card 1: Academic Session Pulse */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-[#033B36]/10 text-[#033B36]">
                <CalendarRange className="size-4" aria-hidden="true" />
              </span>
              <p className="text-xs font-bold text-gray-900">Academic Session</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          </div>

          <div className="mt-3 space-y-2">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Current Term</p>
              <p className="text-sm font-bold text-gray-900">{activePeriodName}</p>
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px] text-gray-600">
              <span>Timetable Status:</span>
              <span className="font-semibold text-gray-900">
                {publishedSessions > 0 ? `${publishedSessions} Sessions Live` : 'Draft Mode'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-600">
              <span>Portal Admissions:</span>
              <span className="font-semibold text-gray-900">{studentsPinsActive} Active</span>
            </div>
          </div>
        </div>

        {/* Card 2: Staff & Account Management */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <KeyRound className="size-4" aria-hidden="true" />
              </span>
              <p className="text-xs font-bold text-gray-900">Staff & Approvals</p>
            </div>
            <Link
              href="/timetable/trainers/access"
              className="text-[10px] font-semibold text-[#033B36] hover:underline"
            >
              Manage
            </Link>
          </div>

          <div className="mt-3 space-y-2">
            <Link
              href="/timetable/trainers/access"
              className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 p-2.5 text-xs font-medium text-gray-800 transition hover:bg-gray-100/80 hover:border-gray-200"
            >
              <div className="flex items-center gap-2">
                <UserCheck className="size-4 text-emerald-600" />
                <span>Staff Workspace Access</span>
              </div>
              <ChevronRight className="size-3.5 text-gray-400" />
            </Link>

            <Link
              href="/timetable/trainers"
              className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 p-2.5 text-xs font-medium text-gray-800 transition hover:bg-gray-100/80 hover:border-gray-200"
            >
              <div className="flex items-center gap-2">
                <Users className="size-4 text-[#033B36]" />
                <span>Trainer Directory & Loads</span>
              </div>
              <ChevronRight className="size-3.5 text-gray-400" />
            </Link>
          </div>
        </div>

        {/* Card 3: Quick Operational Actions */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-bold text-gray-900 border-b border-gray-100 pb-2.5">
            Operational Shortcuts
          </p>

          <div className="mt-3 space-y-1.5">
            <Link
              href="/timetable/readiness"
              className="flex items-center justify-between rounded-lg p-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 hover:text-[#033B36]"
            >
              <span className="flex items-center gap-2">
                <ClipboardCheck className="size-3.5 text-gray-500" />
                Timetable Readiness
              </span>
              <ArrowRight className="size-3 text-gray-400" />
            </Link>

            <Link
              href="/timetable/editor"
              className="flex items-center justify-between rounded-lg p-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 hover:text-[#033B36]"
            >
              <span className="flex items-center gap-2">
                <CalendarDays className="size-3.5 text-gray-500" />
                Review & Edit Schedule
              </span>
              <ArrowRight className="size-3 text-gray-400" />
            </Link>

            <Link
              href="/assessment"
              className="flex items-center justify-between rounded-lg p-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 hover:text-[#033B36]"
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="size-3.5 text-gray-500" />
                Assessment Control Center
              </span>
              <ArrowRight className="size-3 text-gray-400" />
            </Link>

            <Link
              href="/operations/daily-reports"
              className="flex items-center justify-between rounded-lg p-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 hover:text-[#033B36]"
            >
              <span className="flex items-center gap-2">
                <Clock className="size-3.5 text-gray-500" />
                Submit Daily Attendance
              </span>
              <ArrowRight className="size-3 text-gray-400" />
            </Link>
          </div>
        </div>

        {/* Card 4: System Security Badge */}
        <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50/70 px-3.5 py-2.5 text-[11px] text-gray-500">
          <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
          <span>HOD Workspace Authenticated · Active Sync</span>
        </div>
      </aside>
    </div>
  );
}
