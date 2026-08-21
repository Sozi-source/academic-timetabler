import {
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  UsersRound,
} from 'lucide-react';

import {
  MetricCard,
} from '@/components/ui/metric-card';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  AttendanceAdminTable,
} from '@/features/class-attendance/admin-table';
import {
  getHodClassAttendanceOverview,
} from '@/features/class-attendance/admin-queries';

export default async function AttendanceClinicalModulePage() {
  await requireHodAccess();

  const items =
    await getHodClassAttendanceOverview();

  const completed =
    items.filter(
      (item) =>
        item.status ===
        'completed',
    ).length;

  const open =
    items.filter(
      (item) =>
        item.status ===
        'open',
    ).length;

  const students =
    items.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.rosterCount,
      0,
    );

  const absent =
    items.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.absentCount,
      0,
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Academic operations"
        title="Class Attendance"
        description="Department oversight of trainer attendance."
        icon={CalendarCheck2}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Sessions"
          value={String(
            items.length,
          )}
          description="Last 60 days"
          icon={CalendarCheck2}
        />

        <MetricCard
          label="Completed"
          value={String(
            completed,
          )}
          description={`${open} still open`}
          icon={CheckCircle2}
        />

        <MetricCard
          label="Student records"
          value={String(
            students,
          )}
          description="Attendance entries"
          icon={UsersRound}
        />

        <MetricCard
          label="Absences"
          value={String(
            absent,
          )}
          description="Recorded absent"
          icon={ClipboardCheck}
        />
      </section>

      <section className="rounded-xl border border-border bg-surface-subtle/50 px-4 py-3">
        <p className="text-[11px] leading-5 text-text-secondary">
          Trainers record Present or Absent only.
          Completed attendance is locked; reopening
          is an HOD-controlled correction and remains
          in the audit history.
        </p>
      </section>

      <AttendanceAdminTable
        items={
          items
        }
      />

      <p className="text-[10px] leading-4 text-text-muted">
        Clinical rotation tracking remains separate and
        will not be mixed into class attendance records.
      </p>
    </div>
  );
}
