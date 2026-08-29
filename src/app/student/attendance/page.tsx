import {
  CalendarCheck2,
} from 'lucide-react';
import {
  redirect,
} from 'next/navigation';

import {
  StudentPortalShell,
} from '@/components/student/student-portal-shell';
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
  attendanceRateLabel,
} from '@/features/attendance-analytics/domain';
import {
  getStudentPortalAttendance,
} from '@/features/attendance-analytics/queries';
import {
  formatPortalClock,
} from '@/features/student-portal/domain';
import {
  getStudentPortalIdentity,
} from '@/features/student-portal/queries';
import {
  getStudentPortalSession,
} from '@/features/student-portal/session';

export default async function StudentAttendancePage() {
  const session =
    await getStudentPortalSession();

  if (!session) {
    redirect(
      '/student/login',
    );
  }

  const [
    student,
    attendance,
  ] =
    await Promise.all([
      getStudentPortalIdentity(
        session.studentId,
      ),
      getStudentPortalAttendance(
        session.studentId,
      ),
    ]);

  if (!student) {
    redirect(
      '/student/login',
    );
  }

  return (
    <StudentPortalShell
      student={
        student
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="mt-1 text-xl font-bold text-text-primary">
              Attendance
            </h1>

            <p className="mt-1 text-xs text-text-muted">
              {
                attendance.periodName ??
                'No active academic period'
              }
            </p>
          </div>

          <Badge variant="neutral">
            {
              attendance.completedSessions
            } recorded
          </Badge>
        </div>

        <section className="portal-metric-grid" data-columns="3">
          <MetricCard
            label="Attendance rate"
            value={attendanceRateLabel(
              attendance.attendanceRate,
            )}
            icon={CalendarCheck2}
          />

          <MetricCard
            label="Present"
            value={String(
              attendance.presentCount,
            )}
            icon={CalendarCheck2}
          />

          <MetricCard
            label="Absent"
            value={String(
              attendance.absentCount,
            )}
            icon={CalendarCheck2}
          />
        </section>

        {attendance.units.length ===
        0 ? (
          <EmptyState
            icon={CalendarCheck2}
            title="No completed attendance"
            description="Recorded classes will appear here."
          />
        ) : (
          <>
            <section className="overflow-hidden rounded-xl border border-border bg-white">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-bold text-text-primary">
                  By unit
                </h2>
              </div>

              <div className="divide-y divide-border">
                {attendance.units.map(
                  (
                    unit,
                  ) => (
                    <article
                      key={
                        unit.unitId
                      }
                      className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_7rem] sm:items-center"
                    >
                      <p className="text-xs font-semibold text-text-primary">
                        {
                          unit.unitName
                        }
                      </p>

                      <p className="text-[10px] text-text-muted">
                        {
                          unit.completedSessions
                        } classes
                      </p>

                      <p className="text-[10px] text-text-muted">
                        P {
                          unit.presentCount
                        } · A {
                          unit.absentCount
                        }
                      </p>

                      <div className="sm:text-right">
                        <Badge variant="success">
                          {attendanceRateLabel(
                            unit.attendanceRate,
                          )}
                        </Badge>
                      </div>
                    </article>
                  ),
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-border bg-white">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-bold text-text-primary">
                  Recent classes
                </h2>
              </div>

              <div className="divide-y divide-border">
                {attendance.sessions
                  .slice(
                    0,
                    40,
                  )
                  .map(
                    (
                      item,
                    ) => (
                      <article
                        key={
                          item.classSessionId
                        }
                        className="grid gap-2 px-4 py-3 sm:grid-cols-[7rem_minmax(0,1fr)_9rem_7rem] sm:items-center"
                      >
                        <p className="text-[10px] font-semibold text-text-secondary">
                          {
                            item.sessionDate
                          }
                        </p>

                        <div>
                          <p className="text-xs font-semibold text-text-primary">
                            {
                              item.unitName
                            }
                          </p>

                          <p className="mt-0.5 text-[10px] text-text-muted">
                            {
                              item.cohortName
                            }
                          </p>
                        </div>

                        <p className="text-[10px] text-text-muted">
                          {formatPortalClock(
                            item.startsAt,
                          )}
                          {' – '}
                          {formatPortalClock(
                            item.endsAt,
                          )}
                        </p>

                        <div className="sm:text-right">
                          <Badge
                            variant={
                              item.status ===
                              'present'
                                ? 'success'
                                : 'danger'
                            }
                          >
                            {item.status ===
                            'present'
                              ? 'Present'
                              : 'Absent'}
                          </Badge>
                        </div>
                      </article>
                    ),
                  )}
              </div>
            </section>
          </>
        )}
      </div>
    </StudentPortalShell>
  );
}
