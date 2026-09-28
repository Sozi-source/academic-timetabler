import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
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
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  AttendanceScheduleList,
} from '@/features/class-attendance/attendance-schedule-list';
import {
  shortTime,
} from '@/features/class-attendance/domain';
import {
  getStaffClassAttendanceHistory,
  getStaffClassAttendanceSchedule,
} from '@/features/class-attendance/queries';

export default async function StaffAttendancePage() {
  await requireTrainerAccess();

  const [
    schedule,
    history,
  ] =
    await Promise.all([
      getStaffClassAttendanceSchedule(),
      getStaffClassAttendanceHistory(
        20,
      ),
    ]);

  const completed =
    history.filter(
      (item) =>
        item.status ===
        'completed',
    ).length;

  const cancelled =
    history.filter(
      (item) =>
        item.status ===
        'cancelled',
    ).length;

  const open =
    history.filter(
      (item) =>
        item.status ===
        'open',
    ).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Staff"
        title="Class Attendance"
        description="Record class attendance."
        icon={CalendarCheck2}
      />

      <section className="portal-metric-grid" data-columns="4">
        <MetricCard
          label="Weekly classes"
          value={String(
            schedule.length,
          )}
          icon={Clock3}
        />

        <MetricCard
          label="Completed"
          value={String(
            completed,
          )}
          icon={CheckCircle2}
        />

        <MetricCard
          label="Did not take place"
          value={String(
            cancelled,
          )}
          icon={CalendarCheck2}
        />

        <MetricCard
          label="Open"
          value={String(
            open,
          )}
          icon={UsersRound}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-bold text-text-primary">
            Take attendance
          </h2>

        </div>

        <AttendanceScheduleList
          items={
            schedule
          }
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-bold text-text-primary">
            Recent sessions
          </h2>

          <p className="mt-0.5 text-[11px] text-text-muted">
            Your latest class attendance records.
          </p>
        </div>

        {history.length ===
        0 ? (
          <div className="rounded-xl border border-border bg-white px-4 py-6 text-center text-xs text-text-muted">
            No attendance recorded yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <div className="divide-y divide-border">
              {history.map(
                (
                  item,
                ) => (
                  <Link
                    key={
                      item.classSessionId
                    }
                    href={`/staff/attendance/${item.classSessionId}`}
                    className="grid gap-3 px-4 py-3 transition hover:bg-surface-subtle md:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-text-primary">
                        {
                          item.unitName
                        }
                      </p>

                      <p className="mt-0.5 text-[10px] text-text-muted">
                        {
                          item.cohortName
                        }
                        {' · '}
                        {
                          item.sessionDate
                        }
                        {' · '}
                        {shortTime(
                          item.startsAt,
                        )}
                        –
                        {shortTime(
                          item.endsAt,
                        )}
                      </p>
                    </div>

                    <Badge
                      variant={
                        item.status ===
                        'completed'
                          ? 'success'
                          : item.status ===
                            'cancelled'
                          ? 'neutral'
                          : 'warning'
                      }
                    >
                      {
                        item.status ===
                        'completed'
                          ? 'Completed'
                          : item.status ===
                            'cancelled'
                          ? 'Did Not Take Place'
                          : 'Open'
                      }
                    </Badge>

                    <p className="text-[10px] text-text-secondary">
                      Present {
                        item.presentCount
                      }
                      {' · '}
                      Absent {
                        item.absentCount
                      }
                    </p>

                    <p className="text-[10px] text-text-muted">
                      Unmarked {
                        item.unmarkedCount
                      }
                    </p>
                  </Link>
                ),
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
