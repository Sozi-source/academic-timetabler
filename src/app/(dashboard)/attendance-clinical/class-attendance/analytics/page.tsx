import {
  ArrowLeft,
  BarChart3,
  Download,
} from 'lucide-react';
import Link from 'next/link';

import {
  Badge,
} from '@/components/ui/badge';
import {
  EmptyState,
} from '@/components/ui/empty-state';
import {
  MetricCard,
} from '@/components/ui/metric-card';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  attendanceRate,
  attendanceRateLabel,
} from '@/features/attendance-analytics/domain';
import {
  getDepartmentAttendanceAnalytics,
  getMissedClassReport,
  getDepartmentStudentAttendanceAnalytics,
} from '@/features/attendance-analytics/queries';
import { HodAttendanceView } from '@/features/attendance-analytics/hod-attendance-view';
import {
  requireHodAccess,
} from '@/features/auth/authorization';

export default async function AttendanceAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string }>;
}) {
  await requireHodAccess();
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(params.startDate ?? '') ? params.startDate! : today.slice(0, 8) + '01';
  const endDate = /^\d{4}-\d{2}-\d{2}$/.test(params.endDate ?? '') ? params.endDate! : today;

  const [
    aggregates,
    students,
    missedClasses,
  ] =
    await Promise.all([
      getDepartmentAttendanceAnalytics(),
      getDepartmentStudentAttendanceAnalytics(),
      getMissedClassReport(startDate, endDate),
    ]);

  const present =
    aggregates.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.presentCount,
      0,
    );

  const absent =
    aggregates.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.absentCount,
      0,
    );

  const completedSessions =
    aggregates.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.completedSessions,
      0,
    );

  const rate =
    attendanceRate({
      present,
      absent,
    });

  const periodName =
    aggregates[0]
      ?.academicPeriodName ??
    students[0]
      ?.academicPeriodName ??
    'Active academic period';

  return (
    <div className="admin-screen space-y-5">
      <PageHeader
        eyebrow="Attendance & Clinical"
        title="Attendance analytics"
        icon={BarChart3}
        context={
          <Badge variant="institutional">
            {
              periodName
            }
          </Badge>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/attendance-clinical/class-attendance"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              <ArrowLeft
                className="size-3.5"
                aria-hidden="true"
              />
              Attendance
            </Link>

            <a
              href={`/api/attendance-clinical/class-attendance/export?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover"
            >
              <Download
                className="size-3.5"
                aria-hidden="true"
              />
              Export Excel
            </a>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Completed sessions"
          value={String(
            completedSessions,
          )}
          description="Across unit/cohort schedules"
          icon={BarChart3}
        />

        <MetricCard
          label="Present"
          value={String(
            present,
          )}
          description="Completed attendance entries"
          icon={BarChart3}
        />

        <MetricCard
          label="Absent"
          value={String(
            absent,
          )}
          description="Completed attendance entries"
          icon={BarChart3}
        />

        <MetricCard
          label="Attendance rate"
          value={attendanceRateLabel(
            rate,
          )}
          description="Present ÷ recorded attendance"
          icon={BarChart3}
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3">
          <div><h2 className="text-sm font-bold text-text-primary">Students who missed class</h2><p className="mt-1 text-xs text-text-muted">Recorded absences and the units missed during the selected period.</p></div>
          <form className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs font-medium text-text-secondary">From<input name="startDate" type="date" defaultValue={startDate} className="h-9 rounded-md border border-border px-2" /></label>
            <label className="grid gap-1 text-xs font-medium text-text-secondary">To<input name="endDate" type="date" defaultValue={endDate} className="h-9 rounded-md border border-border px-2" /></label>
            <button className="h-9 rounded-md bg-primary px-3 text-xs font-semibold text-white" type="submit">Filter</button>
          </form>
        </div>
        {missedClasses.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-surface-subtle text-text-muted"><tr><th className="px-4 py-2.5">Date</th><th className="px-3 py-2.5">Admission no.</th><th className="px-3 py-2.5">Student</th><th className="px-3 py-2.5">Cohort</th><th className="px-3 py-2.5">Unit missed</th></tr></thead><tbody className="divide-y divide-border">{missedClasses.map((row, index) => <tr key={`${row.admissionNumber}-${row.sessionDate}-${row.unitCode}-${index}`}><td className="px-4 py-2.5">{row.sessionDate}</td><td className="px-3 py-2.5">{row.admissionNumber}</td><td className="px-3 py-2.5 font-semibold text-text-primary">{row.fullName}</td><td className="px-3 py-2.5">{row.cohortName}</td><td className="px-3 py-2.5">{row.unitCode} {row.unitName}</td></tr>)}</tbody></table></div> : <p className="px-4 py-6 text-center text-xs text-text-muted">No recorded absences from {startDate} to {endDate}.</p>}
      </section>

      <HodAttendanceView aggregates={aggregates} students={students} />

      <section className="rounded-xl border border-border bg-surface-subtle/60 px-4 py-3">
        <p className="text-[10px] leading-4 text-text-muted">
          College minimum attendance policy requires 80.0% attendance across completed sessions for examination clearance. Open or unmarked attendance never enters the denominator.
        </p>
      </section>
    </div>
  );
}
