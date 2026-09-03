import {
  BookOpenCheck,
  CalendarCheck2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  History,
} from 'lucide-react';
import Link from 'next/link';

import {
  MetricCard,
} from '@/components/ui/metric-card';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  getStaffWorkspace,
} from '@/features/staff-assessment/queries';
import { groupStaffUnitAllocations } from '@/features/staff-assessment/unit-grouping';
import {
  portalGreeting,
} from '@/lib/portal-greeting';

export default async function StaffHomePage() {
  const profile =
    await requireTrainerAccess();

  const workspace =
    await getStaffWorkspace(
      profile.id,
    );
  const groupedUnits = groupStaffUnitAllocations(workspace.allocations);

  const assessmentCount =
    workspace.allocations.reduce(
      (
        total,
        allocation,
      ) =>
        total +
        (
          allocation.cat
            ? 1
            : 0
        ) +
        (
          allocation.exam
            ? 1
            : 0
        ),
      0,
    );

  const published =
    workspace.allocations.reduce(
      (
        total,
        allocation,
      ) =>
        total +
        (
          allocation.cat
            ?.published
            ? 1
            : 0
        ) +
        (
          allocation.exam
            ?.published
            ? 1
            : 0
        ),
      0,
    );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Staff dashboard"
        title={portalGreeting(profile.fullName)}
        description="Units, classes, and assessments."
        icon={GraduationCap}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/staff/daily-report"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-surface px-3.5 text-xs font-bold text-primary shadow-xs ring-1 ring-border hover:bg-primary-subtle transition"
            >
              <ClipboardList className="size-3.5 text-primary" />
              Daily Report
            </Link>
            <Link
              href="/staff/units"
              className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-xs font-black text-institutional-yellow-soft shadow-sm transition hover:bg-primary-hover ring-1 ring-primary-deeper/20"
            >
              My Units
            </Link>
          </div>
        }
      />

      <section className="portal-metric-grid" data-columns="3">
        <MetricCard
          label="Allocated units"
          value={String(groupedUnits.length)}
          icon={BookOpenCheck}
          className="border-t-4 border-t-primary shadow-xs"
        />

        <MetricCard
          label="Assessments"
          value={String(assessmentCount)}
          icon={ClipboardCheck}
          className="border-t-4 border-t-amber-400 shadow-xs"
        />

        <MetricCard
          label="Published"
          value={String(published)}
          icon={GraduationCap}
          className="border-t-4 border-t-primary shadow-xs"
        />
      </section>

      {/* QUICK ACCESS GRID */}
      <section className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-primary">
          Quick Access
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-5">
          <Link
            href="/staff/attendance"
            className="group flex flex-col items-start gap-2 rounded-xl border border-border border-l-4 border-l-primary bg-surface p-3.5 shadow-xs transition hover:border-primary/50 hover:shadow-sm sm:flex-row sm:items-center sm:gap-3"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary group-hover:bg-primary-soft font-bold">
              <CalendarCheck2 className="size-4.5" />
            </span>
            <div>
              <p className="text-xs font-black text-slate-950 group-hover:text-primary">Attendance</p>
            </div>
          </Link>

          <Link
            href="/staff/daily-report"
            className="group flex flex-col items-start gap-2 rounded-xl border border-slate-200 border-l-4 border-l-emerald-600 bg-white p-3.5 shadow-xs transition hover:border-emerald-500 hover:shadow-sm sm:flex-row sm:items-center sm:gap-3"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 group-hover:bg-emerald-100 font-bold">
              <ClipboardList className="size-4.5" />
            </span>
            <div>
              <p className="text-xs font-black text-slate-950 group-hover:text-emerald-900">Daily Report</p>
            </div>
          </Link>

          <Link
            href="/staff/timetable"
            className="group flex flex-col items-start gap-2 rounded-xl border border-slate-200 border-l-4 border-l-amber-400 bg-white p-3.5 shadow-xs transition hover:border-amber-400 hover:shadow-sm sm:flex-row sm:items-center sm:gap-3"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-800 group-hover:bg-amber-100 font-bold">
              <CalendarDays className="size-4.5" />
            </span>
            <div>
              <p className="text-xs font-black text-slate-950 group-hover:text-amber-900">Weekly Timetable</p>
            </div>
          </Link>

          <Link
            href="/staff/documents"
            className="group flex flex-col items-start gap-2 rounded-xl border border-border border-l-4 border-l-primary bg-surface p-3.5 shadow-xs transition hover:border-primary/50 hover:shadow-sm sm:flex-row sm:items-center sm:gap-3"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary group-hover:bg-primary-soft font-bold">
              <FileText className="size-4.5" />
            </span>
            <div>
              <p className="text-xs font-black text-slate-950 group-hover:text-primary">Teaching Documents</p>
            </div>
          </Link>

          <Link
            href="/staff/units"
            className="group col-span-2 flex flex-col items-start gap-2 rounded-xl border border-slate-200 border-l-4 border-l-amber-500 bg-white p-3.5 shadow-xs transition hover:border-amber-500 hover:shadow-sm sm:col-span-1 sm:flex-row sm:items-center sm:gap-3"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-900 group-hover:bg-amber-100 font-bold">
              <ClipboardCheck className="size-4.5" />
            </span>
            <div>
              <p className="text-xs font-black text-slate-950 group-hover:text-amber-900">Enter Marks</p>
            </div>
          </Link>
        </div>
      </section>

      <section className="flex items-center justify-between rounded-xl border border-border border-l-4 border-l-primary bg-surface px-4 py-3 text-xs shadow-xs">
        <div>
          <span className="font-black text-slate-950">{workspace.trainerName}</span>
          <span className="ml-2 text-slate-500 font-medium">· Teaching Allocations Active</span>
        </div>
        <Link
          href="/staff/history"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary-deep"
        >
          <History className="size-3.5" />
          View Activity History
        </Link>
      </section>
    </div>
  );
}
