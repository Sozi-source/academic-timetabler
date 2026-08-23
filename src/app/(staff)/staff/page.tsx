import {
  BookOpenCheck,
  CalendarCheck2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Download,
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

export default async function StaffHomePage() {
  const profile =
    await requireTrainerAccess();

  const workspace =
    await getStaffWorkspace(
      profile.id,
    );

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
        eyebrow="Staff"
        title="Teaching workspace"
        description="Your allocated units, teaching documents, and assessments."
        icon={GraduationCap}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/staff/daily-report"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-bold text-teal-900 shadow-xs ring-1 ring-slate-200 hover:bg-slate-50 transition"
            >
              <ClipboardList className="size-3.5 text-teal-800" />
              Daily Report
            </Link>
            <Link
              href="/staff/units"
              className="inline-flex h-9 items-center justify-center rounded-xl bg-teal-900 px-4 text-xs font-black text-amber-300 shadow-sm transition hover:bg-teal-800 hover:text-amber-200 ring-1 ring-teal-950/20"
            >
              My Units
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Allocated units"
          value={String(workspace.allocations.length)}
          description="Active and completed Teaching Allocations"
          icon={BookOpenCheck}
          status="My Units"
          className="border-t-4 border-t-teal-800 shadow-xs"
        />

        <MetricCard
          label="Assessments"
          value={String(assessmentCount)}
          description="CAT and Exam assessment sets"
          icon={ClipboardCheck}
          status="Assessment"
          className="border-t-4 border-t-amber-400 shadow-xs"
        />

        <MetricCard
          label="Published"
          value={String(published)}
          description="Assessment sets released"
          icon={GraduationCap}
          status="Results"
          className="border-t-4 border-t-teal-700 shadow-xs"
        />
      </section>

      {/* QUICK ACCESS GRID */}
      <section className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-teal-800">
          Quick Access
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Link
            href="/staff/attendance"
            className="group flex items-center gap-3 rounded-xl border border-slate-200 border-l-4 border-l-teal-700 bg-white p-3.5 shadow-xs transition hover:border-teal-500 hover:shadow-sm"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-800 group-hover:bg-teal-100 font-bold">
              <CalendarCheck2 className="size-4.5" />
            </span>
            <div>
              <p className="text-xs font-black text-slate-950 group-hover:text-teal-900">Attendance</p>
              <p className="text-[11px] text-slate-500 font-medium">Class check-in & register</p>
            </div>
          </Link>

          <Link
            href="/staff/daily-report"
            className="group flex items-center gap-3 rounded-xl border border-slate-200 border-l-4 border-l-emerald-600 bg-white p-3.5 shadow-xs transition hover:border-emerald-500 hover:shadow-sm"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 group-hover:bg-emerald-100 font-bold">
              <ClipboardList className="size-4.5" />
            </span>
            <div>
              <p className="text-xs font-black text-slate-950 group-hover:text-emerald-900">Daily Report</p>
              <p className="text-[11px] text-slate-500 font-medium">Submit day's report & log</p>
            </div>
          </Link>

          <Link
            href="/staff/timetable"
            className="group flex items-center gap-3 rounded-xl border border-slate-200 border-l-4 border-l-amber-400 bg-white p-3.5 shadow-xs transition hover:border-amber-400 hover:shadow-sm"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-800 group-hover:bg-amber-100 font-bold">
              <CalendarDays className="size-4.5" />
            </span>
            <div>
              <p className="text-xs font-black text-slate-950 group-hover:text-amber-900">Weekly Timetable</p>
              <p className="text-[11px] text-slate-500 font-medium">Classrooms & schedule</p>
            </div>
          </Link>

          <Link
            href="/staff/documents"
            className="group flex items-center gap-3 rounded-xl border border-slate-200 border-l-4 border-l-teal-800 bg-white p-3.5 shadow-xs transition hover:border-teal-600 hover:shadow-sm"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-900 group-hover:bg-teal-100 font-bold">
              <FileText className="size-4.5" />
            </span>
            <div>
              <p className="text-xs font-black text-slate-950 group-hover:text-teal-900">Teaching Documents</p>
              <p className="text-[11px] text-slate-500 font-medium">Outlines, Schemes & RoW</p>
            </div>
          </Link>

          <Link
            href="/staff/downloads"
            className="group flex items-center gap-3 rounded-xl border border-slate-200 border-l-4 border-l-amber-500 bg-white p-3.5 shadow-xs transition hover:border-amber-500 hover:shadow-sm"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-900 group-hover:bg-amber-100 font-bold">
              <Download className="size-4.5" />
            </span>
            <div>
              <p className="text-xs font-black text-slate-950 group-hover:text-amber-900">Offline Markbooks</p>
              <p className="text-[11px] text-slate-500 font-medium">Download signing sheets</p>
            </div>
          </Link>
        </div>
      </section>

      <section className="flex items-center justify-between rounded-xl border border-slate-200 border-l-4 border-l-teal-800 bg-white px-4 py-3 text-xs shadow-xs">
        <div>
          <span className="font-black text-slate-950">{workspace.trainerName}</span>
          <span className="ml-2 text-slate-500 font-medium">· Teaching Allocations Active</span>
        </div>
        <Link
          href="/staff/history"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-800 hover:text-teal-950"
        >
          <History className="size-3.5" />
          View Activity History
        </Link>
      </section>
    </div>
  );
}
