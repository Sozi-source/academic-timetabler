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
  getDepartmentStudentAttendanceAnalytics,
} from '@/features/attendance-analytics/queries';
import { HodAttendanceView } from '@/features/attendance-analytics/hod-attendance-view';
import {
  requireHodAccess,
} from '@/features/auth/authorization';

export default async function AttendanceAnalyticsPage() {
  await requireHodAccess();

  const [
    aggregates,
    students,
  ] =
    await Promise.all([
      getDepartmentAttendanceAnalytics(),
      getDepartmentStudentAttendanceAnalytics(),
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
        description="Completed class attendance for the active academic period."
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
              href="/api/attendance-clinical/class-attendance/export"
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

      <HodAttendanceView aggregates={aggregates} students={students} />

      <section className="rounded-xl border border-border bg-surface-subtle/60 px-4 py-3">
        <p className="text-[10px] leading-4 text-text-muted">
          College minimum attendance policy requires 80.0% attendance across completed sessions for examination clearance. Open or unmarked attendance never enters the denominator.
        </p>
      </section>
    </div>
  );
}
