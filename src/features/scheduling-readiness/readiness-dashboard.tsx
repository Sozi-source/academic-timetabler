import Link from 'next/link';
import {
  AlertTriangle,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  Clock3,
  GraduationCap,
  ShieldAlert,
  UsersRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/ui/metric-card';
import { Select } from '@/components/ui/select';

import { includeAllUnassignedOfferingsAction, updateTeachingOfferingReadinessAction } from './actions';
import type { SchedulingReadiness } from './types';

function percentage(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

function primaryOfferingState(status: string, enabled: boolean) {
  if (!enabled) {
    return { label: 'Excluded', variant: 'neutral' as const };
  }

  if (status === 'active') {
    return { label: 'Active', variant: 'success' as const };
  }

  if (status === 'draft') {
    return { label: 'Draft', variant: 'warning' as const };
  }

  return { label: status, variant: 'neutral' as const };
}

export function ReadinessDashboard({ readiness }: { readiness: SchedulingReadiness }) {
  const hasMissingTrainerBlocker = readiness.issues.some((issue) => issue.id === 'missing-trainers');

  return (
    <div className="space-y-4">
      <section className="grid overflow-hidden rounded-2xl border border-border bg-surface shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="px-4 py-3">
          <p className="text-xs font-medium text-text-muted">Readiness</p>
          <p className="mt-0.5 text-xl font-semibold text-text-primary">
            {readiness.score}%
          </p>
        </div>

        <div className="border-t border-border px-4 py-3 sm:border-l sm:border-t-0">
          <p className="text-xs font-medium text-text-muted">Offerings</p>
          <p className="mt-0.5 text-xl font-semibold text-text-primary">
            {readiness.enabledOfferingCount}
          </p>
        </div>

        <div className="border-t border-border px-4 py-3 lg:border-l lg:border-t-0">
          <p className="text-xs font-medium text-text-muted">Teaching load</p>
          <p className="mt-0.5 text-xl font-semibold text-text-primary">
            {readiness.requestedWeeklyHours}h
          </p>
        </div>

        <div className="border-t border-border px-4 py-3 sm:border-l lg:border-t-0">
          <p className="text-xs font-medium text-text-muted">Resources</p>
          <p className="mt-0.5 text-xl font-semibold text-text-primary">
            {readiness.availableTrainerCount}/{readiness.availableRoomCount}
          </p>
        </div>
      </section>

      <section className={`rounded-2xl border px-4 py-3 ${readiness.isReady ? 'border-success-border bg-success-surface' : 'border-warning-border bg-warning-surface'}`}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_13rem] lg:items-center">
          <div className="flex min-w-0 items-start gap-3">
            {readiness.isReady ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <h2 className="font-semibold text-text-primary">
                {readiness.isReady ? 'Ready' : 'Action required'}
              </h2>
              {hasMissingTrainerBlocker ? (
                <form action={includeAllUnassignedOfferingsAction} className="mt-3">
                  <input type="hidden" name="academicPeriodId" value={readiness.academicPeriodId} />
                  <Button type="submit" size="sm" variant="outline">Include unassigned units</Button>
                </form>
              ) : null}
            </div>
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-text-muted">
              <span>Readiness</span>
              <span>{readiness.score}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: percentage(readiness.score) }} />
            </div>
          </div>
        </div>
      </section>

      {readiness.issues.length > 0 ? (
        <section className="space-y-3" aria-labelledby="readiness-issues-title">
          <h2 id="readiness-issues-title" className="text-lg font-semibold text-text-primary">Readiness issues</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {readiness.issues.map((entry) => (
              <article key={entry.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${entry.severity === 'blocker' ? 'text-danger' : 'text-warning'}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-text-primary">{entry.title}</h3>
                      <Badge variant={entry.severity === 'blocker' ? 'danger' : entry.severity === 'warning' ? 'warning' : 'neutral'}>
                        {entry.severity === 'blocker' ? 'Blocker' : entry.severity === 'warning' ? 'Warning' : 'Notice'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">{entry.description}</p>
                    {entry.actionHref && entry.actionLabel ? (
                      <Link href={entry.actionHref} className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline">{entry.actionLabel}</Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4" aria-labelledby="offering-readiness-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="offering-readiness-title" className="text-lg font-semibold text-text-primary">Teaching allocations</h2>

          </div>
          <span className="text-sm font-medium text-text-muted">{readiness.offerings.length} units</span>
        </div>

        <div className="space-y-3">
          {readiness.offerings.map((offering) => {
            const requiredCapacity = offering.participants.reduce((total, participant) => total + participant.cohortSize, 0);
            const roomTooSmall = offering.preferredRoomCapacity !== null && offering.preferredRoomCapacity < requiredCapacity;
            const state = primaryOfferingState(offering.status, offering.isTimetableEnabled);
            const issues = [
              !offering.trainerId ? 'Trainer required' : null,
              !offering.preferredRoomId ? 'Room pending' : null,
              roomTooSmall ? 'Room capacity issue' : null,
            ].filter(Boolean) as string[];

            return (
              <article key={offering.id} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
                <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)] xl:items-start">
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                        <GraduationCap className="size-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="break-words font-semibold leading-5 text-text-primary">{offering.title}</h3>
                            <p className="mt-1 break-words text-xs text-text-muted">
                              {offering.deliveryMode} · {offering.sharedClassKey ?? 'Independent class'}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-1.5">
                            {offering.participants.length > 1 ? <Badge variant="success">Shared</Badge> : null}
                            <Badge variant={state.variant}>{state.label}</Badge>
                          </div>
                        </div>

                        <div className="mt-4 grid items-stretch gap-3 md:grid-cols-3">

                          <div className="flex min-w-0 flex-col rounded-xl bg-surface-subtle px-3 py-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                              Demand
                            </p>

                            <p className="mt-1 font-semibold text-text-primary">
                              {offering.weeklySessions} × {offering.sessionDurationMinutes} min
                            </p>

                            <p className="mt-auto pt-1 text-xs text-text-muted">
                              {(offering.weeklySessions * offering.sessionDurationMinutes) / 60} hrs/week
                            </p>
                          </div>

                          <div className="flex min-w-0 flex-col rounded-xl border border-border bg-surface-subtle px-3 py-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                              Participants
                            </p>

                            {offering.participants.length > 0 ? (
                              <div className="mt-1 space-y-1.5">
                                {offering.participants.map((participant) => (
                                  <div key={participant.id} className="min-w-0">
                                    <p className="break-words font-medium leading-5 text-text-primary">
                                      {participant.cohortName}
                                    </p>

                                    <p className="break-words text-xs text-text-muted">
                                      {participant.unitCode} · {participant.cohortSize} learners
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-1 text-sm font-medium text-danger">
                                No participants
                              </p>
                            )}
                          </div>

                          <div className="flex min-w-0 flex-col rounded-xl bg-surface-subtle px-3 py-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                              Capacity
                            </p>

                            <p className="mt-1 font-semibold text-text-primary">
                              {requiredCapacity} learners
                            </p>

                            <p className="mt-auto pt-1 text-xs text-text-muted">
                              Across {offering.participants.length} cohort{offering.participants.length === 1 ? '' : 's'}
                            </p>
                          </div>

                        </div>

                        {issues.length > 0 ? (
                          <p
                            className={`mt-3 text-xs font-medium ${
                              roomTooSmall ? 'text-danger' : 'text-warning'
                            }`}
                          >
                            {issues.join(' · ')}
                          </p>
                        ) : (
                          <p className="mt-3 text-xs font-medium text-success">
                            Allocation complete
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-border bg-surface-subtle p-3 sm:p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Allocation</p>
                    <form action={updateTeachingOfferingReadinessAction} className="grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="offeringId" value={offering.id} />
                      <input type="hidden" name="academicPeriodId" value={readiness.academicPeriodId} />

                      <label className="min-w-0 space-y-1.5">
                        <span className="text-xs font-medium text-text-secondary">Trainer</span>
                        <Select name="trainerId" defaultValue={offering.trainerId ?? ''} aria-label={`Trainer for ${offering.title}`} className="h-10 w-full min-w-0 text-sm">
                          <option value="">Select trainer</option>
                          {readiness.trainerOptions.map((trainer) => (
  <option key={trainer.id} value={trainer.id}>
    {trainer.label.replace(/\s*\(TR-[^)]+\)\s*$/, '')}
  </option>
))}
                        </Select>
                      </label>

                      <label className="min-w-0 space-y-1.5">
                        <span className="text-xs font-medium text-text-secondary">Room</span>
                        <Select name="preferredRoomId" defaultValue={offering.preferredRoomId ?? ''} aria-label={`Preferred room for ${offering.title}`} className="h-10 w-full min-w-0 text-sm">
                          <option value="">No room assigned</option>
                          {readiness.roomOptions.filter((room) => room.capacity >= requiredCapacity).map((room) => <option key={room.id} value={room.id}>{room.label}</option>)}
                        </Select>
                      </label>

                      <label className="min-w-0 space-y-1.5">
                        <span className="text-xs font-medium text-text-secondary">Status</span>
                        <Select name="status" defaultValue={offering.status} aria-label={`Status for ${offering.title}`} className="h-10 w-full min-w-0 text-sm">
                          <option value="draft">Draft</option>
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                          <option value="completed">Completed</option>
                          <option value="archived">Archived</option>
                        </Select>
                      </label>

                      <label className="min-w-0 space-y-1.5">
                        <span className="text-xs font-medium text-text-secondary">Scheduling</span>
                        <Select name="isTimetableEnabled" defaultValue={String(offering.isTimetableEnabled)} aria-label={`Timetable state for ${offering.title}`} className="h-10 w-full min-w-0 text-sm">
                          <option value="true">Timetable enabled</option>
                          <option value="false">Excluded</option>
                        </Select>
                      </label>

                      <div className="sm:col-span-2 sm:flex sm:justify-end">
                        <Button type="submit" size="sm" className="w-full sm:w-auto">Save</Button>
                      </div>
                    </form>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <UsersRound className="size-5 text-primary" aria-hidden="true" />
            <h2 className="font-semibold text-text-primary">Trainer workload</h2>
          </div>
          <div className="mt-4 space-y-3">
            {readiness.trainerWorkloads.map((workload) => (
              <div key={workload.trainerId} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-text-primary">{workload.trainerName}</p>
                    <p className="text-xs text-text-muted">{workload.staffNumber}</p>
                  </div>
                  <Badge variant={workload.overloaded ? 'warning' : workload.utilizationPercentage > 85 ? 'warning' : 'success'}>{workload.utilizationPercentage}%</Badge>
                </div>
                <p className="mt-2 text-xs text-text-muted">{workload.allocatedWeeklyHours}h allocated · {workload.maximumWeeklyHours}h target</p>
                {workload.extraWeeklyHours > 0 ? <p className="mt-1 text-xs font-semibold text-warning">Extra +{workload.extraWeeklyHours}h</p> : null}
              </div>
            ))}
            {readiness.trainerWorkloads.length === 0 ? <p className="text-sm text-text-muted">Workloads appear after trainer allocation.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-primary" aria-hidden="true" />
            <h2 className="font-semibold text-text-primary">Next step</h2>
          </div>
          <p className="mt-3 text-sm text-text-secondary">Resolve blockers, then generate the timetable.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/timetable/generator" className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold ${readiness.isReady ? 'bg-primary text-primary-foreground' : 'pointer-events-none bg-surface-muted text-text-muted'}`}>Open generator</Link>
            <Link href="/timetable/rooms" className="inline-flex h-10 items-center justify-center rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary">Rooms</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
