import {
  CalendarDays,
  Clock3,
  MapPin,
  UserRound,
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
  formatPortalClock,
} from '@/features/student-portal/domain';
import {
  getActiveStudentPortalPeriod,
  getStudentPortalIdentity,
  getStudentPortalTimetable,
} from '@/features/student-portal/queries';
import {
  getStudentPortalSession,
} from '@/features/student-portal/session';

function dayLabel(
  value:
    string,
) {
  return value
    .replaceAll(
      '_',
      ' ',
    )
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character
          .toUpperCase(),
    );
}

export default async function StudentTimetablePage() {
  const session =
    await getStudentPortalSession();

  if (!session) {
    redirect(
      '/student/login',
    );
  }

  const [
    student,
    period,
    sessions,
  ] =
    await Promise.all([
      getStudentPortalIdentity(
        session.studentId,
      ),
      getActiveStudentPortalPeriod(),
      getStudentPortalTimetable(
        session.studentId,
      ),
    ]);

  if (!student) {
    redirect(
      '/student/login',
    );
  }

  const grouped =
    new Map<
      string,
      typeof sessions
    >();

  for (
    const timetableSession of
      sessions
  ) {
    const current =
      grouped.get(
        timetableSession.dayName,
      ) ??
      [];

    current.push(
      timetableSession,
    );

    grouped.set(
      timetableSession.dayName,
      current,
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
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
              Published schedule
            </p>

            <h1 className="mt-1 text-xl font-bold text-text-primary">
              My Timetable
            </h1>

            <p className="mt-1 text-xs text-text-muted">
              {
                period
                  ?.name ??
                'No active academic period'
              }
            </p>
          </div>

          <Badge
            variant={
              sessions.length >
              0
                ? 'success'
                : 'neutral'
            }
          >
            {
              sessions.length
            } sessions
          </Badge>
        </div>

        {sessions.length ===
        0 ? (
          <EmptyState
            icon={
              CalendarDays
            }
            title="No published timetable"
            description="Your timetable appears here after the department publishes and locks your cohort schedule."
          />
        ) : (
          [
            ...grouped.entries(),
          ].map(
            (
              [
                day,
                daySessions,
              ],
            ) => (
              <section
                key={
                  day
                }
                className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
              >
                <div className="border-b border-border bg-surface-subtle px-4 py-2.5">
                  <h2 className="text-xs font-bold text-text-primary">
                    {dayLabel(
                      day,
                    )}
                  </h2>
                </div>

                <div className="divide-y divide-border">
                  {daySessions.map(
                    (
                      item,
                    ) => (
                      <article
                        key={
                          item.id
                        }
                        className="grid gap-3 px-4 py-3.5 sm:grid-cols-[7.5rem_minmax(0,1fr)_minmax(8rem,.55fr)] sm:items-center"
                      >
                        <div>
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
                            <Clock3
                              className="size-3"
                              aria-hidden="true"
                            />
                            {formatPortalClock(
                              item.startsAt,
                            )}
                          </p>

                          <p className="mt-0.5 pl-[18px] text-[10px] text-text-muted">
                            to{' '}
                            {formatPortalClock(
                              item.endsAt,
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm font-bold text-text-primary">
                            {
                              item.unitName
                            }
                          </p>

                          <p className="mt-1 flex items-center gap-1.5 text-[10px] text-text-muted">
                            <UserRound
                              className="size-3"
                              aria-hidden="true"
                            />
                            {
                              item.trainerName
                            }
                          </p>
                        </div>

                        <div className="sm:text-right">
                          <p className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary sm:justify-end">
                            <MapPin
                              className="size-3"
                              aria-hidden="true"
                            />
                            {
                              item.roomLabel
                            }
                          </p>
                        </div>
                      </article>
                    ),
                  )}
                </div>
              </section>
            ),
          )
        )}
      </div>
    </StudentPortalShell>
  );
}
