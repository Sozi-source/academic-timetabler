import {
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  LoaderCircle,
  Sparkles,
  UserRound,
} from 'lucide-react';

import {
  Badge,
} from '@/components/ui/badge';
import {
  Button,
} from '@/components/ui/button';

import type {
  GeneratorConflictSummary,
  GeneratorUnscheduledSession,
} from './server-types';

export function GeneratorUnscheduledList({
  sessions,
  academicPeriodId,
  exchangeAction,
  exchangePending,
  exchangeSuggestionsEvaluated,
}: {
  sessions:
    GeneratorUnscheduledSession[];
  academicPeriodId: string;
  exchangeAction: (formData: FormData) => void;
  exchangePending: boolean;
  exchangeSuggestionsEvaluated: boolean;
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

        {!exchangeSuggestionsEvaluated ? (
          <p className="mt-2 text-xs leading-5 text-text-muted">
            This fast post-exchange preview has not scanned for additional exchanges yet. Use Scan remaining smart repairs above when needed.
          </p>
        ) : null}
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

                {session.exchangeSuggestions.length > 0 ? (
                  <section className="mt-4 rounded-xl border border-primary-soft bg-surface p-4">
                    <div className="flex items-start gap-2">
                      <Sparkles
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <div>
                        <h4 className="text-sm font-semibold text-text-primary">
                          Smart exchange repairs
                        </h4>
                        <p className="mt-1 text-xs leading-5 text-text-muted">
                          These equal-duration exchanges were simulated against the complete timetable. Only trainers in this department are considered.
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2">
                      {session.exchangeSuggestions.map((suggestion, index) => (
                        <article
                          key={suggestion.id}
                          className="rounded-lg border border-border bg-surface-subtle p-3"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0 text-xs leading-5 text-text-secondary">
                              <p className="font-semibold text-text-primary">
                                {index === 0 ? 'Recommended: ' : ''}
                                exchange with {suggestion.partnerTrainerName}
                              </p>
                              <p className="mt-1">
                                {suggestion.partnerTrainerName} takes {session.unitCode ?? 'this unit'}; {suggestion.targetTrainerName} takes {suggestion.partnerUnitCode} — {suggestion.partnerUnitName} ({suggestion.partnerCohortCode}).
                              </p>
                              <p className="mt-1 text-text-muted">
                                {suggestion.durationMinutes} minutes · resolves {suggestion.resolvedSessionCount} session{suggestion.resolvedSessionCount === 1 ? '' : 's'} · {suggestion.remainingUnscheduledCount} unresolved remain · {suggestion.warningCount} warning{suggestion.warningCount === 1 ? '' : 's'}
                              </p>
                            </div>

                            <form action={exchangeAction}>
                              <input type="hidden" name="academicPeriodId" value={academicPeriodId} />
                              <input type="hidden" name="targetTeachingAllocationId" value={suggestion.targetTeachingAllocationId} />
                              <input type="hidden" name="targetSessionNumber" value={suggestion.targetSessionNumber} />
                              <input type="hidden" name="partnerTeachingAllocationId" value={suggestion.partnerTeachingAllocationId} />
                              <Button
                                type="submit"
                                size="sm"
                                variant={index === 0 ? 'primary' : 'outline'}
                                disabled={exchangePending}
                                leadingIcon={exchangePending ? (
                                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                                ) : (
                                  <ArrowRightLeft className="size-4" aria-hidden="true" />
                                )}
                              >
                                {exchangePending ? 'Rechecking exchange' : 'Apply exchange'}
                              </Button>
                            </form>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : session.reason === 'no_valid_placement' &&
                exchangeSuggestionsEvaluated ? (
                  <p className="mt-4 rounded-xl border border-border bg-surface px-4 py-3 text-xs leading-5 text-text-muted">
                    No safe equal-duration trainer exchange was found in this department. Adjust availability, unlock an affected session, or review the fixed schedule before regenerating.
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
