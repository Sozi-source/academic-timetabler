import {
  BookOpen,
  Building2,
  Clock3,
  GraduationCap,
  UserRound,
} from 'lucide-react';

import {
  Badge,
} from '@/components/ui/badge';

import type {
  GeneratorPreviewSession,
} from './server-types';

function formatDay(
  value: string,
) {
  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

export function GeneratorSessionTable({
  sessions,
}: {
  sessions: GeneratorPreviewSession[];
}) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
        <CalendarEmptyState />
      </div>
    );
  }

  const orderedSessions =
    [...sessions].sort(
      (first, second) =>
        first.workingDayName.localeCompare(
          second.workingDayName,
        ) ||
        first.startsAt.localeCompare(
          second.startsAt,
        ) ||
        first.cohortCode.localeCompare(
          second.cohortCode,
        ),
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-surface-subtle text-xs uppercase tracking-[0.08em] text-text-muted">
            <tr>
              <th className="px-5 py-3">
                Day and time
              </th>

              <th className="px-5 py-3">
                Unit
              </th>

              <th className="px-5 py-3">
                Cohort
              </th>

              <th className="px-5 py-3">
                Trainer
              </th>

              <th className="px-5 py-3">
                Room
              </th>

              <th className="px-5 py-3">
                Session
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border-soft">
            {orderedSessions.map(
              (session) => (
                <tr
                  key={session.id}
                  className="align-top transition hover:bg-surface-subtle"
                >
                  <td className="min-w-44 px-5 py-4">
                    <div className="flex items-start gap-2">
                      <Clock3
                        className="mt-0.5 size-4 shrink-0 text-text-subtle"
                        aria-hidden="true"
                      />

                      <div>
                        <p className="font-semibold text-text-primary">
                          {formatDay(
                            session.workingDayName,
                          )}
                        </p>

                        <p className="mt-1 text-xs text-text-muted">
                          {session.startsAt}–
                          {session.endsAt}
                        </p>

                        <p className="mt-1 text-xs text-text-muted">
                          {
                            session.durationMinutes
                          }{' '}
                          minutes
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="min-w-56 px-5 py-4">
                    <div className="flex items-start gap-2">
                      <BookOpen
                        className="mt-0.5 size-4 shrink-0 text-text-subtle"
                        aria-hidden="true"
                      />

                      <div>
                        <p className="font-semibold text-text-primary">
                          {session.unitName}
                        </p>

                        <p className="mt-1 text-xs text-text-muted">
                          {session.unitCode}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="min-w-48 px-5 py-4">
                    <div className="flex items-start gap-2">
                      <GraduationCap
                        className="mt-0.5 size-4 shrink-0 text-text-subtle"
                        aria-hidden="true"
                      />

                      <div>
                        <p className="font-medium text-text-primary">
                          {session.cohortName}
                        </p>

                        <p className="mt-1 text-xs text-text-muted">
                          {session.cohortCode}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="min-w-48 px-5 py-4">
                    <div className="flex items-start gap-2">
                      <UserRound
                        className="mt-0.5 size-4 shrink-0 text-text-subtle"
                        aria-hidden="true"
                      />

                      <div>
                        <p className="font-medium text-text-primary">
                          {session.trainerName}
                        </p>

                        <p className="mt-1 text-xs text-text-muted">
                          {
                            session.trainerStaffNumber
                          }
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="min-w-44 px-5 py-4">
                    <div className="flex items-start gap-2">
                      <Building2
                        className="mt-0.5 size-4 shrink-0 text-text-subtle"
                        aria-hidden="true"
                      />

                      <div>
                        <p className="font-medium text-text-primary">
                          {session.roomName}
                        </p>

                        <p className="mt-1 text-xs text-text-muted">
                          {session.roomCode}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="min-w-36 px-5 py-4">
                    <div className="flex flex-col items-start gap-2">
                      <Badge variant="neutral">
                        Session{' '}
                        {session.sessionNumber}
                      </Badge>

                      <Badge variant="success">
                        {session.deliveryMode}
                      </Badge>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CalendarEmptyState() {
  return (
    <>
      <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Clock3
          className="size-5"
          aria-hidden="true"
        />
      </div>

      <h3 className="mt-4 font-semibold text-text-primary">
        No sessions generated
      </h3>

      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-text-muted">
        Generate a preview after configuring teaching
        allocations, working days, teaching slots,
        trainers and rooms.
      </p>
    </>
  );
}