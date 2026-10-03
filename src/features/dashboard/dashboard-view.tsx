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

import type { OperationsSnapshot } from '@/features/operations/types';

interface DashboardViewProps {
  departmentName: string;
  activePeriodName: string;
  snapshot: OperationsSnapshot | null | undefined;
}

/**
 * Responsive admin home: compact and stacked on mobile, full workspace on desktop.
 *
 * Layout:
 *   1. Narrow Hero banner — streamlined status & quick actions
 *   2. Key System Stat Cards — outside the banner, below it
 *   3. Workspaces — full-width rectangular launch cards
 */
export function DashboardView({
  activePeriodName,
  snapshot,
}: DashboardViewProps) {
  const studentsEligible = snapshot?.students?.eligible ?? 167;
  const studentsRegistered = snapshot?.students?.registered ?? 0;

  const publishedSessions = snapshot?.timetable?.publishedSessions ?? 0;

  const attendanceCompleted = snapshot?.attendance?.completed ?? 0;
  const attendanceOpen = snapshot?.attendance?.open ?? 0;

  const assessmentsTotal = snapshot?.assessment?.total ?? 0;
  const assessmentsFinalised = snapshot?.assessment?.finalised ?? 0;
  const assessmentsSubmitted = snapshot?.assessment?.submitted ?? 0;

  const documentsApproved = snapshot?.documents?.approved ?? 0;

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
      {/* 1. Hero banner — Narrow, streamlined operational status & actions */}
      {/* ================================================================= */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface px-5 py-4 text-text-primary shadow-xs lg:col-span-12 lg:px-7 lg:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-semibold text-primary-deep ring-1 ring-primary-soft">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                Live Operational Hub
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                Academic Session
              </span>
            </div>

            <h1 className="text-xl font-light tracking-tight text-text-primary sm:text-2xl lg:text-[1.75rem]">
              <span className="font-normal italic text-text-secondary">
                {activePeriodName?.replace(/\s+\d{4}$/, '')}
              </span>
              {activePeriodName?.match(/\d{4}$/) ? (
                <span className="ml-2 font-semibold not-italic text-text-primary">
                  {activePeriodName.match(/\d{4}$/)?.[0]}
                </span>
              ) : null}
            </h1>

            <p className="text-xs text-text-muted">
              {publishedSessions > 0 ? 'Timetable published and live' : 'Timetable in draft mode'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 lg:gap-2.5">
            <Link
              href="/operations/action-center"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover active:scale-[0.97]"
            >
              <Zap className="size-3.5" aria-hidden="true" />
              Action Centre
            </Link>
            <Link
              href="/operations/daily-reports"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle active:scale-[0.97]"
            >
              Daily Reports
            </Link>
            <Link
              href="/staff"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle active:scale-[0.97]"
            >
              My Workspace
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 2. Key System Stat Cards — Outside the banner, below it           */}
      {/* ================================================================= */}
      <section
        aria-label="Department operational metrics"
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-12 lg:grid-cols-4"
      >
        {/* Card 1: Active Students */}
        <Link
          href="/students/registry"
          className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-4 transition hover:border-primary/40 hover:bg-surface-subtle hover:shadow-2xs active:scale-[0.98] sm:p-4.5"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Active Students
            </p>
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary-soft text-primary transition group-hover:bg-primary group-hover:text-primary-foreground sm:size-8">
              <Users className="size-3.5 sm:size-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              {studentsEligible}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {studentsRegistered > 0
                ? `${studentsRegistered} registered for term`
                : 'Enrolled in department'}
            </p>
          </div>
        </Link>

        {/* Card 2: Weekly Timetable */}
        <Link
          href="/timetable"
          className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-4 transition hover:border-primary/40 hover:bg-surface-subtle hover:shadow-2xs active:scale-[0.98] sm:p-4.5"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Weekly Timetable
            </p>
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary-soft text-primary transition group-hover:bg-primary group-hover:text-primary-foreground sm:size-8">
              <CalendarDays className="size-3.5 sm:size-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              {publishedSessions}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {publishedSessions > 0 ? 'Live published sessions' : 'Draft schedule'}
            </p>
          </div>
        </Link>

        {/* Card 3: Class Attendance */}
        <Link
          href="/attendance"
          className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-4 transition hover:border-primary/40 hover:bg-surface-subtle hover:shadow-2xs active:scale-[0.98] sm:p-4.5"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Class Attendance
            </p>
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary-soft text-primary transition group-hover:bg-primary group-hover:text-primary-foreground sm:size-8">
              <CheckCircle2 className="size-3.5 sm:size-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              {attendanceCompleted}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {attendanceOpen > 0
                ? `${attendanceOpen} session${attendanceOpen === 1 ? '' : 's'} pending review`
                : 'Sessions recorded & logged'}
            </p>
          </div>
        </Link>

        {/* Card 4: Assessment Markbooks / Documents */}
        <Link
          href={assessmentsTotal > 0 ? '/assessment' : '/teaching-documents'}
          className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-4 transition hover:border-primary/40 hover:bg-surface-subtle hover:shadow-2xs active:scale-[0.98] sm:p-4.5"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              {assessmentsTotal > 0 ? 'Assessment Markbooks' : 'Curriculum Documents'}
            </p>
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary-soft text-primary transition group-hover:bg-primary group-hover:text-primary-foreground sm:size-8">
              {assessmentsTotal > 0 ? (
                <BarChart3 className="size-3.5 sm:size-4" aria-hidden="true" />
              ) : (
                <FileText className="size-3.5 sm:size-4" aria-hidden="true" />
              )}
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              {assessmentsTotal > 0 ? assessmentsTotal : documentsApproved}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {assessmentsTotal > 0
                ? `${assessmentsFinalised} finalised${assessmentsSubmitted > 0 ? ` · ${assessmentsSubmitted} submitted` : ''}`
                : `${documentsApproved} approved documents`}
            </p>
          </div>
        </Link>
      </section>

      {/* ================================================================= */}
      {/* 3. Workspace cards span full width                                */}
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
