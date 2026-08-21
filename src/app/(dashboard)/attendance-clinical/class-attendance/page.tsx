import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Percent,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';

import {
  Badge,
} from '@/components/ui/badge';
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
  departmentAttendanceSummary,
  formatAttendanceRate,
} from '@/features/class-attendance/admin-domain';
import {
  getDepartmentAttendanceSessions,
} from '@/features/class-attendance/admin-queries';
import {
  shortTime,
} from '@/features/class-attendance/domain';

export default async function DepartmentClassAttendancePage() {
  await requireHodAccess();

  const sessions =
    await getDepartmentAttendanceSessions(
      120,
    );

  const summary =
    departmentAttendanceSummary(
      sessions,
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Attendance & Clinical"
        title="Class Attendance"
        description="Department attendance oversight."
        icon={CalendarCheck2}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Sessions"
          value={String(
            summary.sessions,
          )}
          description={`${summary.completed} completed`}
          icon={CalendarCheck2}
        />

        <MetricCard
          label="Open"
          value={String(
            summary.open,
          )}
          description={`${summary.unmarked} unmarked student record(s)`}
          icon={Clock3}
        />

        <MetricCard
          label="Present"
          value={String(
            summary.present,
          )}
          description={`${summary.absent} absent`}
          icon={UsersRound}
        />

        <MetricCard
          label="Attendance"
          value={
            formatAttendanceRate(
              summary.attendanceRate,
            )
          }
          description="Present among marked records"
          icon={Percent}
        />
      </section>

      <section className="rounded-xl border border-border bg-surface-subtle/50 px-4 py-3">
        <p className="text-[11px] leading-5 text-text-secondary">
          Records are restricted to students
          in the active department. Shared
          classes are automatically scoped to
          the department cohort(s).
        </p>
      </section>

      {sessions.length ===
      0 ? (
        <section className="rounded-xl border border-border bg-white px-5 py-9 text-center">
          <CheckCircle2
            className="mx-auto size-6 text-text-muted"
            aria-hidden="true"
          />

          <p className="mt-2 text-sm font-semibold text-text-primary">
            No class attendance yet
          </p>

          <p className="mt-1 text-xs text-text-muted">
            Trainer attendance will appear
            here after a published class is
            recorded.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="hidden border-b border-border bg-surface-subtle px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-text-muted lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)_8rem_8rem_10rem] lg:gap-3">
            <span>Class</span>
            <span>Trainer</span>
            <span>Status</span>
            <span>Attendance</span>
            <span>Date</span>
          </div>

          <div className="divide-y divide-border">
            {sessions.map(
              (
                session,
              ) => {
                const marked =
                  session.presentCount +
                  session.absentCount;

                const rate =
                  marked >
                  0
                    ? (
                        session.presentCount /
                        marked
                      ) *
                      100
                    : null;

                return (
                  <Link
                    key={
                      session.classSessionId
                    }
                    href={`/attendance-clinical/class-attendance/${session.classSessionId}`}
                    className="grid gap-2 px-4 py-3.5 transition hover:bg-surface-subtle/60 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)_8rem_8rem_10rem] lg:items-center lg:gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-text-primary">
                        {
                          session.unitName
                        }
                      </p>

                      <p className="mt-0.5 truncate text-[10px] text-text-muted">
                        {
                          session.cohortNames
                        }
                        {' · '}
                        {shortTime(
                          session.startsAt,
                        )}
                        –
                        {shortTime(
                          session.endsAt,
                        )}
                      </p>
                    </div>

                    <p className="truncate text-[11px] text-text-secondary">
                      {
                        session.trainerName
                      }
                    </p>

                    <Badge
                      variant={
                        session.sessionStatus ===
                        'completed'
                          ? 'success'
                          : 'warning'
                      }
                    >
                      {session.sessionStatus ===
                      'completed'
                        ? 'Completed'
                        : 'Open'}
                    </Badge>

                    <p className="text-[11px] font-semibold text-text-secondary">
                      {rate ===
                      null
                        ? '—'
                        : `${rate.toFixed(
                            0,
                          )}%`}
                    </p>

                    <p className="text-[10px] text-text-muted">
                      {
                        session.sessionDate
                      }
                    </p>
                  </Link>
                );
              },
            )}
          </div>
        </section>
      )}
    </div>
  );
}
