import {
  BookOpenCheck,
  CalendarCheck2,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  History,
} from 'lucide-react';
import Link from 'next/link';

import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { getStaffWorkspace } from '@/features/staff-assessment/queries';
import { groupStaffUnitAllocations } from '@/features/staff-assessment/unit-grouping';
import { portalGreeting } from '@/lib/portal-greeting';

export default async function StaffHomePage() {
  const profile = await requireTrainerAccess();

  const workspace = await getStaffWorkspace(profile.id);
  const groupedUnits = groupStaffUnitAllocations(workspace.allocations);

  const assessmentCount = workspace.allocations.reduce(
    (total, allocation) =>
      total + (allocation.cat ? 1 : 0) + (allocation.exam ? 1 : 0),
    0
  );

  const published = workspace.allocations.reduce(
    (total, allocation) =>
      total + (allocation.cat?.published ? 1 : 0) + (allocation.exam?.published ? 1 : 0),
    0
  );

  return (
    <div className="space-y-5">
      {/* Staff Page Header */}
      <PageHeader
        eyebrow="Trainer Workspace"
        title={portalGreeting(profile.fullName)}
        description="Assigned units, classes, and assessment markbooks."
        icon={GraduationCap}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/staff/daily-report"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-surface px-3 text-xs font-bold text-primary shadow-2xs ring-1 ring-border hover:bg-primary-subtle transition active:scale-95"
            >
              <ClipboardList className="size-3.5" />
              Daily Report
            </Link>
            <Link
              href="/staff/units"
              className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-3.5 text-xs font-bold text-white shadow-xs hover:bg-primary-hover transition active:scale-95"
            >
              My Units
            </Link>
          </div>
        }
      />

      {/* Metric Cards Grid */}
      <section className="portal-metric-grid" data-columns="3">
        <MetricCard
          label="Allocated Units"
          value={String(groupedUnits.length)}
          icon={BookOpenCheck}
          className="border-t-4 border-t-primary shadow-2xs"
        />

        <MetricCard
          label="Assessments"
          value={String(assessmentCount)}
          icon={ClipboardCheck}
          className="border-t-4 border-t-institutional-yellow shadow-2xs"
        />

        <MetricCard
          label="Published Results"
          value={String(published)}
          icon={GraduationCap}
          className="border-t-4 border-t-primary shadow-2xs"
        />
      </section>

      {/* Quick Actions Grid */}
      <section className="space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
          Quick Access
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-5">
          <Link
            href="/staff/attendance"
            className="group flex items-center justify-between rounded-xl border border-border border-l-4 border-l-primary bg-surface p-3.5 shadow-2xs transition-all duration-150 hover:border-primary/40 hover:bg-primary-subtle/30 active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary font-bold">
                <CalendarCheck2 className="size-4" />
              </span>
              <p className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                Attendance
              </p>
            </div>
            <ChevronRight className="size-3.5 text-text-subtle group-hover:text-primary" />
          </Link>

          <Link
            href="/staff/daily-report"
            className="group flex items-center justify-between rounded-xl border border-border border-l-4 border-l-emerald-600 bg-surface p-3.5 shadow-2xs transition-all duration-150 hover:border-emerald-500 hover:bg-emerald-50/40 active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100/70 text-emerald-800 font-bold">
                <ClipboardList className="size-4" />
              </span>
              <p className="text-xs font-bold text-text-primary group-hover:text-emerald-900 transition-colors">
                Daily Report
              </p>
            </div>
            <ChevronRight className="size-3.5 text-text-subtle group-hover:text-emerald-800" />
          </Link>

          <Link
            href="/staff/timetable"
            className="group flex items-center justify-between rounded-xl border border-border border-l-4 border-l-institutional-yellow bg-surface p-3.5 shadow-2xs transition-all duration-150 hover:border-institutional-yellow hover:bg-institutional-yellow-subtle/40 active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-institutional-yellow-soft text-institutional-yellow-ink font-bold">
                <CalendarDays className="size-4" />
              </span>
              <p className="text-xs font-bold text-text-primary group-hover:text-institutional-yellow-ink transition-colors">
                Timetable
              </p>
            </div>
            <ChevronRight className="size-3.5 text-text-subtle group-hover:text-institutional-yellow-ink" />
          </Link>

          <Link
            href="/staff/documents"
            className="group flex items-center justify-between rounded-xl border border-border border-l-4 border-l-primary bg-surface p-3.5 shadow-2xs transition-all duration-150 hover:border-primary/40 hover:bg-primary-subtle/30 active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary font-bold">
                <FileText className="size-4" />
              </span>
              <p className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                Documents
              </p>
            </div>
            <ChevronRight className="size-3.5 text-text-subtle group-hover:text-primary" />
          </Link>

          <Link
            href="/staff/units"
            className="group col-span-2 flex items-center justify-between rounded-xl border border-border border-l-4 border-l-amber-500 bg-surface p-3.5 shadow-2xs transition-all duration-150 hover:border-amber-500 hover:bg-amber-50/40 sm:col-span-1 active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100/80 text-amber-900 font-bold">
                <ClipboardCheck className="size-4" />
              </span>
              <p className="text-xs font-bold text-text-primary group-hover:text-amber-900 transition-colors">
                Enter Marks
              </p>
            </div>
            <ChevronRight className="size-3.5 text-text-subtle group-hover:text-amber-900" />
          </Link>
        </div>
      </section>

      {/* Activity Bar Footer */}
      <section className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span className="font-bold text-text-primary">{workspace.trainerName}</span>
          <span className="hidden sm:inline text-text-muted">· Teaching Allocations Active</span>
        </div>
        <Link
          href="/staff/history"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary-deep transition active:scale-95"
        >
          <History className="size-3.5" />
          Activity Log
        </Link>
      </section>
    </div>
  );
}
