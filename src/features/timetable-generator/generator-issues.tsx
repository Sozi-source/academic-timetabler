import {
  AlertCircle,
  AlertTriangle,
  UserRound,
} from 'lucide-react';

import {
  Badge,
} from '@/components/ui/badge';

import type {
  GeneratorConflictSummary,
  GeneratorUnscheduledSession,
} from './server-types';

export function GeneratorUnscheduledList({
  sessions,
}: {
  sessions:
    GeneratorUnscheduledSession[];
}) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          Unresolved sessions
        </h2>

        <p className="mt-1 text-sm text-text-muted">
          These requests could not be placed
          automatically and require configuration or
          manual review.
        </p>
      </div>

      <div className="grid gap-3">
        {sessions.map((session) => (
          <article
            key={`${session.teachingAllocationId}:${session.sessionNumber}`}
            className="rounded-2xl border border-warning-border bg-warning-surface p-5"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 size-5 shrink-0 text-warning"
                aria-hidden="true"
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-text-primary">
                    {session.unitName ??
                      'Unknown unit'}
                  </h3>

                  <Badge variant="warning">
                    Session{' '}
                    {session.sessionNumber}
                  </Badge>

                  <Badge variant="neutral">
                    {session.reason.replaceAll(
                      '_',
                      ' ',
                    )}
                  </Badge>
                </div>

                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  {session.message}
                </p>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-text-muted">
                  <span>
                    Cohort:{' '}
                    {session.cohortCode ??
                      'Unknown'}
                  </span>

                  <span className="inline-flex items-center gap-1">
                    <UserRound
                      className="size-3.5"
                      aria-hidden="true"
                    />
                    {session.trainerName ??
                      'Unknown trainer'}
                  </span>

                  <span>
                    Candidates attempted:{' '}
                    {
                      session.attemptedCandidateCount
                    }
                  </span>
                </div>

                {session.conflictTypes.length >
                0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {session.conflictTypes.map(
                      (type) => (
                        <Badge
                          key={type}
                          variant="danger"
                        >
                          {type.replaceAll(
                            '_',
                            ' ',
                          )}
                        </Badge>
                      ),
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function GeneratorConflictList({
  conflicts,
}: {
  conflicts:
    GeneratorConflictSummary[];
}) {
  if (conflicts.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          Conflict report
        </h2>

        <p className="mt-1 text-sm text-text-muted">
          Review planning warnings and blocked
          placements before publishing.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {conflicts.map((conflict) => (
          <article
            key={conflict.id}
            className={
              conflict.severity ===
              'blocked'
                ? 'rounded-2xl border border-danger-border bg-danger-surface p-5'
                : 'rounded-2xl border border-warning-border bg-warning-surface p-5'
            }
          >
            <div className="flex items-start gap-3">
              {conflict.severity ===
              'blocked' ? (
                <AlertCircle
                  className="mt-0.5 size-5 shrink-0 text-danger"
                  aria-hidden="true"
                />
              ) : (
                <AlertTriangle
                  className="mt-0.5 size-5 shrink-0 text-warning"
                  aria-hidden="true"
                />
              )}

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-text-primary">
                    {conflict.title}
                  </h3>

                  <Badge
                    variant={
                      conflict.severity ===
                      'blocked'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {conflict.severity}
                  </Badge>
                </div>

                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  {conflict.description}
                </p>

                {conflict.resourceLabel ? (
                  <p className="mt-2 text-xs font-medium text-text-muted">
                    Resource:{' '}
                    {conflict.resourceLabel}
                  </p>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}