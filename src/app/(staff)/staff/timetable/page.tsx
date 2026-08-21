import {
  CalendarDays,
  Clock3,
  MapPin,
} from 'lucide-react';

import {
  Badge,
} from '@/components/ui/badge';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  formatTimetableClock,
} from '@/features/staff-workspace/domain';
import {
  getStaffPublishedTimetable,
} from '@/features/staff-workspace/queries';
import type {
  StaffTimetableSession,
} from '@/features/staff-workspace/types';

function prettyDay(
  value: string,
): string {
  return value
    .replaceAll(
      '_',
      ' ',
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function groupByPeriod(
  sessions: StaffTimetableSession[],
) {
  const periods =
    new Map<
      string,
      {
        name: string;
        sessions: StaffTimetableSession[];
      }
    >();

  for (
    const session of
      sessions
  ) {
    const current =
      periods.get(
        session.academicPeriodId,
      ) ??
      {
        name:
          session.academicPeriodName,
        sessions:
          [],
      };

    current.sessions.push(
      session,
    );

    periods.set(
      session.academicPeriodId,
      current,
    );
  }

  return [
    ...periods.entries(),
  ];
}

function groupByDay(
  sessions: StaffTimetableSession[],
) {
  const days =
    new Map<
      string,
      StaffTimetableSession[]
    >();

  for (
    const session of
      sessions
  ) {
    const key =
      `${session.daySequence}:${session.dayName}`;

    const current =
      days.get(
        key,
      ) ??
      [];

    current.push(
      session,
    );

    days.set(
      key,
      current,
    );
  }

  return [
    ...days.entries(),
  ];
}

export default async function StaffTimetablePage() {
  const profile =
    await requireTrainerAccess();

  const timetable =
    await getStaffPublishedTimetable(
      profile.id,
    );

  const periods =
    groupByPeriod(
      timetable.sessions,
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Staff"
        title="My Timetable"
        description="Your published teaching schedule."
        icon={CalendarDays}
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">
          {
            timetable.sessions.length
          } sessions
        </Badge>

        {timetable.sessions.length >
        0 ? (
          <Badge variant="success">
            Published
          </Badge>
        ) : null}
      </div>

      {periods.length ===
      0 ? (
        <section className="rounded-xl border border-border bg-white px-5 py-10 text-center">
          <CalendarDays
            className="mx-auto size-5 text-text-muted"
            aria-hidden="true"
          />

          <p className="mt-3 text-sm font-semibold text-text-primary">
            No published timetable
          </p>

          <p className="mx-auto mt-1 max-w-md text-[11px] leading-5 text-text-muted">
            Your timetable appears here
            after the department publishes
            and locks the teaching
            sessions.
          </p>
        </section>
      ) : (
        periods.map(
          (
            [
              periodId,
              period,
            ],
          ) => (
            <section
              key={
                periodId
              }
              className="space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-text-primary">
                  {
                    period.name
                  }
                </h2>

                <Badge variant="neutral">
                  {
                    period.sessions.length
                  } sessions
                </Badge>
              </div>

              {groupByDay(
                period.sessions,
              ).map(
                (
                  [
                    dayKey,
                    sessions,
                  ],
                ) => (
                  <div
                    key={
                      dayKey
                    }
                    className="overflow-hidden rounded-xl border border-border bg-white"
                  >
                    <div className="border-b border-border bg-surface-subtle/50 px-4 py-2.5">
                      <p className="text-xs font-bold text-text-primary">
                        {prettyDay(
                          sessions[0]
                            .dayName,
                        )}
                      </p>
                    </div>

                    <div className="divide-y divide-border">
                      {sessions.map(
                        (
                          session,
                        ) => (
                          <article
                            key={
                              session.id
                            }
                            className="grid gap-3 px-4 py-3.5 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(7rem,.45fr)] sm:items-center"
                          >
                            <div>
                              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
                                <Clock3
                                  className="size-3"
                                  aria-hidden="true"
                                />
                                {formatTimetableClock(
                                  session.startsAt,
                                )}
                              </p>

                              <p className="mt-0.5 pl-[18px] text-[10px] text-text-muted">
                                to{' '}
                                {formatTimetableClock(
                                  session.endsAt,
                                )}
                              </p>
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-bold leading-5 text-text-primary">
                                {
                                  session.unitName
                                }
                              </p>

                              <p className="mt-1 text-[11px] text-text-muted">
                                {
                                  session.cohortNames.join(
                                    ' · ',
                                  )
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
                                  session.roomLabel
                                }
                              </p>

                              <p className="mt-1 text-[10px] capitalize text-text-muted">
                                {
                                  session.deliveryMode
                                }
                              </p>
                            </div>
                          </article>
                        ),
                      )}
                    </div>
                  </div>
                ),
              )}
            </section>
          ),
        )
      )}
    </div>
  );
}
