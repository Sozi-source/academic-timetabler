import {
  Activity,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Presentation,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { DashboardView } from '@/features/dashboard/dashboard-view';
import { getOperationsSnapshot } from '@/features/operations/queries';

function formatPeriodDisplay(name: string | null | undefined): string {
  if (!name) return 'Sep – Dec 2026';
  return name
    .replace(/September/gi, 'Sep')
    .replace(/December/gi, 'Dec')
    .replace(/January/gi, 'Jan')
    .replace(/February/gi, 'Feb')
    .replace(/March/gi, 'Mar')
    .replace(/April/gi, 'Apr')
    .replace(/August/gi, 'Aug')
    .replace(/October/gi, 'Oct')
    .replace(/November/gi, 'Nov')
    .replace(/[-–—]+/g, ' – ');
}

export default async function DashboardPage() {
  const profile = await requireHodAccess();
  const snapshot = await getOperationsSnapshot().catch(() => null);

  const activePeriod = snapshot?.activePeriodName || 'September – December 2026';

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      {/* 1. Clean Refined Header */}
      <PageHeader
        title="Department Operations"
        description={`${profile.departmentName || 'Human Nutrition & Dietetics'} · ${formatPeriodDisplay(snapshot?.activePeriodName)}`}
        icon={LayoutDashboard}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/operations/daily-reports"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#cbd6d4] bg-white px-3 text-xs font-semibold text-[#184f4b] shadow-2xs transition hover:bg-[#e8f2f1]"
            >
              <ClipboardList className="size-3.5 text-[#2f706b]" aria-hidden="true" />
              <span>Trainer Daily Reports</span>
            </Link>

            <Link
              href="/staff"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#cbd6d4] bg-white px-3 text-xs font-semibold text-[#52606d] shadow-2xs transition hover:bg-[#f8faf9] hover:text-[#1f2937]"
            >
              <UserRound className="size-3.5 text-[#718096]" aria-hidden="true" />
              <span>My Staff Workspace</span>
            </Link>

            <Link
              href="/operations/action-center"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2f706b] px-3.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#184f4b]"
            >
              <Activity className="size-3.5 text-[#f5c400]" aria-hidden="true" />
              <span>Action Centre</span>
            </Link>
          </div>
        }
      />

      {/* 2. Focused 4-Metric Telemetry Strip */}
      <section aria-label="Department Metrics" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1 */}
        <div className="flex items-center gap-3.5 rounded-xl border border-[#dfe6e5] bg-white p-4 shadow-2xs transition hover:border-[#cbd6d4]">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e8f2f1] text-[#2f706b]">
            <CalendarDays className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#718096]">
              Active Term
            </p>
            <p className="truncate text-sm font-bold text-[#1f2937]">
              {formatPeriodDisplay(snapshot?.activePeriodName)}
            </p>
            <p className="text-[11px] text-[#718096]">Academic session</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="flex items-center gap-3.5 rounded-xl border border-[#dfe6e5] bg-white p-4 shadow-2xs transition hover:border-[#cbd6d4]">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#fff9dc] text-[#3f3500]">
            <GraduationCap className="size-5 text-[#d4aa00]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#718096]">
              Students Portal
            </p>
            <p className="text-sm font-bold text-[#1f2937]">
              {snapshot?.students?.registered ?? 24} / {snapshot?.students?.eligible ?? 185}
            </p>
            <p className="text-[11px] text-[#718096]">
              {snapshot?.students?.portalActive ?? 185} PINs active
            </p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="flex items-center gap-3.5 rounded-xl border border-[#dfe6e5] bg-white p-4 shadow-2xs transition hover:border-[#cbd6d4]">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e8f2f1] text-[#2f706b]">
            <Presentation className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#718096]">
              Teaching Allocations
            </p>
            <p className="text-sm font-bold text-[#1f2937]">
              {snapshot?.timetable?.activeAllocations ?? 48} Units
            </p>
            <p className="text-[11px] text-[#718096]">
              {snapshot?.timetable?.publishedSessions ?? 0} published
            </p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="flex items-center gap-3.5 rounded-xl border border-[#dfe6e5] bg-white p-4 shadow-2xs transition hover:border-[#cbd6d4]">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#edf7f1] text-[#34745b]">
            <Stethoscope className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#718096]">
              Class Attendance
            </p>
            <p className="text-sm font-bold text-[#1f2937]">
              {snapshot?.attendance?.completed ?? 0} Completed
            </p>
            <p className="text-[11px] text-[#34745b] font-medium">
              {snapshot?.attendance?.open ?? 0} open today
            </p>
          </div>
        </div>
      </section>

      {/* 3. Dedicated Hub Gateways Grid */}
      <DashboardView
        departmentName={profile.departmentName || 'Human Nutrition & Dietetics'}
        activePeriodName={activePeriod}
        snapshot={snapshot}
      />
    </div>
  );
}
