import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  FileChartColumn,
  FileSpreadsheet,
  ListChecks,
  PencilRuler,
  Presentation,
  School,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';

export const metadata: Metadata = {
  title: 'Academic Planning & Timetabling | Academic Planning System',
  description: 'Manage scheduling readiness, timetable editor, publications, and master data setup.',
};

export default async function TimetableHubPage() {
  await requireHodAccess();

  const schedulingSteps = [
    {
      title: 'Check Readiness',
      href: '/timetable/readiness',
      icon: ClipboardCheck,
      badge: '01',
      accent: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
      bar: 'bg-emerald-500',
      badgeBg: 'bg-emerald-50 text-emerald-700 ring-emerald-200/60',
    },
    {
      title: 'Review & Edit',
      href: '/timetable/editor',
      icon: PencilRuler,
      badge: '02',
      accent: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
      bar: 'bg-blue-500',
      badgeBg: 'bg-blue-50 text-blue-700 ring-blue-200/60',
    },
    {
      title: 'Publish',
      href: '/timetable/published',
      icon: FileChartColumn,
      badge: '03',
      accent: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
      bar: 'bg-purple-500',
      badgeBg: 'bg-purple-50 text-purple-700 ring-purple-200/60',
    },
    {
      title: 'Reports',
      href: '/timetable/reports',
      icon: ListChecks,
      badge: 'EX',
      accent: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
      bar: 'bg-amber-500',
      badgeBg: 'bg-amber-50 text-amber-700 ring-amber-200/60',
    },
  ] as const;

  const masterSetupItems = [
    { label: 'Academic Periods', href: '/timetable/academic-periods', icon: CalendarRange },
    { label: 'Programmes & Cohorts', href: '/timetable/cohorts', icon: School },
    { label: 'Unit Offerings', href: '/timetable/unit-offerings', icon: BookOpen },
    { label: 'Trainers & Staff', href: '/timetable/trainers', icon: UserRound },
    { label: 'Teaching Allocations', href: '/timetable/teaching-allocations', icon: Presentation },
    { label: 'Lecture Rooms', href: '/timetable/rooms', icon: Building2 },
    { label: 'Scheduling Constraints', href: '/timetable/constraints', icon: SlidersHorizontal },
    { label: 'Master Imports', href: '/timetable/imports', icon: FileSpreadsheet },
  ] as const;

  return (
    <div className="max-w-[var(--content-max-width)] mx-auto space-y-8">
      <PageHeader
        eyebrow="Academic Operations"
        title="Academic Planning & Timetabling"
        icon={CalendarDays}
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      {/* ── 1. Scheduling Workflow ──────────────────────────────────────────── */}
      <section aria-labelledby="scheduling-workflow-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-[3px] rounded-full bg-primary/60" aria-hidden="true" />
            <h2
              id="scheduling-workflow-heading"
              className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/80"
            >
              Scheduling Workflow
            </h2>
          </div>
          <span className="text-[11px] font-medium text-text-muted">Core lifecycle · 3 steps</span>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {schedulingSteps.map((step) => {
            const Icon = step.icon;
            return (
              <Link
                key={step.title}
                href={step.href}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
              >
                {/* Colour bar top */}
                <span className={`absolute inset-x-0 top-0 h-[3px] ${step.bar} opacity-80`} aria-hidden="true" />

                <div className="flex flex-1 flex-col p-5 pt-6">
                  {/* Icon + badge row */}
                  <div className="flex items-start justify-between">
                    <span
                      className={`flex size-10 items-center justify-center rounded-xl border ${step.accent}`}
                    >
                      <Icon className="size-[18px]" aria-hidden="true" />
                    </span>
                    <span
                      className={`inline-flex h-5 items-center rounded-md px-2 text-[10px] font-bold ring-1 ${step.badgeBg}`}
                    >
                      {step.badge}
                    </span>
                  </div>

                  {/* Title */}
                  <p className="mt-4 text-[13px] font-semibold text-text-primary transition-colors group-hover:text-primary">
                    {step.title}
                  </p>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* CTA */}
                  <div className="mt-5 border-t border-border/60 pt-3.5">
                    <span className="text-[11px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Open →
                    </span>
                    <span className="text-[11px] font-medium text-text-muted transition-opacity group-hover:opacity-0 absolute">
                      Open workspace
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── 2. Master Setup & Structure ─────────────────────────────────────── */}
      <section aria-labelledby="master-setup-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-[3px] rounded-full bg-primary/60" aria-hidden="true" />
            <h2
              id="master-setup-heading"
              className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/80"
            >
              Master Setup & Structure
            </h2>
          </div>
          <span className="text-[11px] font-medium text-text-muted">Institutional configuration</span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {masterSetupItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className="group flex items-center gap-3.5 rounded-xl border border-border bg-surface px-4 py-3.5 shadow-2xs transition-all duration-150 hover:border-primary/30 hover:bg-primary/[0.03] hover:shadow-sm"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-secondary transition-colors group-hover:bg-primary group-hover:text-white">
                  <Icon className="size-[15px]" aria-hidden="true" />
                </span>
                <p className="text-[12.5px] font-medium text-text-secondary transition-colors group-hover:text-text-primary">
                  {item.label}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
