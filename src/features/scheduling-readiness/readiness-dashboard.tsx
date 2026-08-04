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

import { updateTeachingOfferingReadinessAction } from './actions';
import type { SchedulingReadiness } from './types';

function percentage(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export function ReadinessDashboard({ readiness }: { readiness: SchedulingReadiness }) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Readiness score"
          value={`${readiness.score}%`}
          description={readiness.isReady ? 'Ready for timetable generation' : `${readiness.blockerCount} blocking issue${readiness.blockerCount === 1 ? '' : 's'} remain`}
          icon={readiness.isReady ? CheckCircle2 : ShieldAlert}
          status={readiness.isReady ? 'Ready' : 'Blocked'}
        />
        <MetricCard
          label="Teaching offerings"
          value={String(readiness.enabledOfferingCount)}
          description={`${readiness.sharedOfferingCount} shared class${readiness.sharedOfferingCount === 1 ? '' : 'es'} · ${readiness.participantCount} cohort participants`}
          icon={BookOpenCheck}
          status="Scope"
        />
        <MetricCard
          label="Weekly teaching"
          value={`${readiness.requestedWeeklyHours}h`}
          description={`${readiness.requestedWeeklySessions} scheduled session requirements`}
          icon={Clock3}
          status="Demand"
        />
        <MetricCard
          label="Resources"
          value={`${readiness.availableTrainerCount}/${readiness.availableRoomCount}`}
          description="Timetable-available trainers / rooms"
          icon={UsersRound}
          status="Capacity"
        />
      </section>

      <section className={`rounded-2xl border p-5 ${readiness.isReady ? 'border-success-border bg-success-surface' : 'border-warning-border bg-warning-surface'}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            {readiness.isReady ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            )}
            <div>
              <h2 className="font-semibold text-text-primary">
                {readiness.isReady ? 'Generation prerequisites satisfied' : 'Resolve blockers before generation'}
              </h2>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                {readiness.academicPeriodName} ({readiness.academicPeriodCode}) has {readiness.workingDayCount} enabled working days and {readiness.teachingSlotCount} teaching slots.
              </p>
            </div>
          </div>
          <div className="w-full max-w-xs">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-text-muted">
              <span>Enterprise readiness</span>
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
          <div>
            <h2 id="readiness-issues-title" className="text-lg font-semibold text-text-primary">Readiness issues</h2>
            <p className="mt-1 text-sm text-text-muted">Blocking issues prevent generation; warnings should be reviewed before publication.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {readiness.issues.map((entry) => (
              <article key={entry.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${entry.severity === 'blocker' ? 'text-danger' : 'text-warning'}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-text-primary">{entry.title}</h3>
                      <Badge variant={entry.severity === 'blocker' ? 'danger' : 'warning'}>{entry.severity === 'blocker' ? 'Blocker' : 'Warning'}</Badge>
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
        <div>
          <h2 id="offering-readiness-title" className="text-lg font-semibold text-text-primary">Teaching offering allocation workspace</h2>
          <p className="mt-1 text-sm text-text-muted">Assign trainers, preferred rooms and lifecycle status. Shared offerings remain one schedulable class with several cohort participants.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
              <thead className="bg-surface-subtle text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-5 py-3">Offering</th>
                  <th className="px-5 py-3">Participants</th>
                  <th className="px-5 py-3">Demand</th>
                  <th className="px-5 py-3">Allocation</th>
                  <th className="px-5 py-3">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {readiness.offerings.map((offering) => {
                  const requiredCapacity = offering.participants.reduce((total, participant) => total + participant.cohortSize, 0);
                  const roomTooSmall = offering.preferredRoomCapacity !== null && offering.preferredRoomCapacity < requiredCapacity;
                  return (
                    <tr key={offering.id} className="align-top">
                      <td className="min-w-64 px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><GraduationCap className="size-4" aria-hidden="true" /></div>
                          <div>
                            <p className="font-semibold text-text-primary">{offering.title}</p>
                            <p className="mt-1 text-xs text-text-muted">{offering.deliveryMode} · {offering.sharedClassKey ?? 'Independent class'}</p>
                            {offering.participants.length > 1 ? <Badge variant="success">Shared class</Badge> : null}
                          </div>
                        </div>
                      </td>
                      <td className="min-w-72 px-5 py-4">
                        <div className="space-y-2">
                          {offering.participants.map((participant) => (
                            <div key={participant.id} className="rounded-xl bg-surface-subtle px-3 py-2">
                              <p className="font-medium text-text-primary">{participant.cohortName}</p>
                              <p className="mt-0.5 text-xs text-text-muted">{participant.unitCode} · {participant.cohortSize} learners</p>
                            </div>
                          ))}
                          {offering.participants.length === 0 ? <span className="text-sm text-danger">No participants</span> : null}
                        </div>
                      </td>
                      <td className="min-w-40 px-5 py-4">
                        <p className="font-semibold text-text-primary">{offering.weeklySessions} × {offering.sessionDurationMinutes} min</p>
                        <p className="mt-1 text-xs text-text-muted">{offering.weeklySessions * offering.sessionDurationMinutes / 60} hours/week</p>
                        <p className="mt-2 text-xs text-text-muted">Capacity needed: {requiredCapacity}</p>
                      </td>
                      <td className="min-w-[360px] px-5 py-4">
                        <form action={updateTeachingOfferingReadinessAction} className="grid gap-2 sm:grid-cols-2">
                          <input type="hidden" name="offeringId" value={offering.id} />
                          <input type="hidden" name="academicPeriodId" value={readiness.academicPeriodId} />
                          <Select name="trainerId" defaultValue={offering.trainerId ?? ''} aria-label={`Trainer for ${offering.title}`} className="h-9 text-xs">
                            <option value="">Select trainer</option>
                            {readiness.trainerOptions.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.label}</option>)}
                          </Select>
                          <Select name="preferredRoomId" defaultValue={offering.preferredRoomId ?? ''} aria-label={`Preferred room for ${offering.title}`} className="h-9 text-xs">
                            <option value="">Automatic room</option>
                            {readiness.roomOptions.filter((room) => room.capacity >= requiredCapacity).map((room) => <option key={room.id} value={room.id}>{room.label}</option>)}
                          </Select>
                          <Select name="status" defaultValue={offering.status} aria-label={`Status for ${offering.title}`} className="h-9 text-xs">
                            <option value="draft">Draft</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="completed">Completed</option><option value="archived">Archived</option>
                          </Select>
                          <Select name="isTimetableEnabled" defaultValue={String(offering.isTimetableEnabled)} aria-label={`Timetable state for ${offering.title}`} className="h-9 text-xs">
                            <option value="true">Timetable enabled</option><option value="false">Excluded</option>
                          </Select>
                          <Button type="submit" variant="outline" size="sm" className="sm:col-span-2">Save allocation</Button>
                        </form>
                        {roomTooSmall ? <p className="mt-2 text-xs font-medium text-danger">Current preferred room is below required capacity.</p> : null}
                      </td>
                      <td className="min-w-40 px-5 py-4">
                        <div className="flex flex-col items-start gap-2">
                          <Badge variant={offering.isTimetableEnabled ? 'success' : 'neutral'}>{offering.isTimetableEnabled ? 'Enabled' : 'Excluded'}</Badge>
                          <Badge variant={offering.status === 'active' ? 'success' : offering.status === 'draft' ? 'warning' : 'neutral'}>{offering.status}</Badge>
                          {!offering.trainerId ? <Badge variant="danger">Trainer missing</Badge> : null}
                          {roomTooSmall ? <Badge variant="danger">Room capacity</Badge> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2"><UsersRound className="size-5 text-primary" aria-hidden="true" /><h2 className="font-semibold text-text-primary">Trainer workload</h2></div>
          <div className="mt-4 space-y-3">
            {readiness.trainerWorkloads.map((workload) => (
              <div key={workload.trainerId} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-3"><div><p className="font-medium text-text-primary">{workload.trainerName}</p><p className="text-xs text-text-muted">{workload.staffNumber}</p></div><Badge variant={workload.overloaded ? 'danger' : workload.utilizationPercentage > 85 ? 'warning' : 'success'}>{workload.utilizationPercentage}%</Badge></div>
                <p className="mt-2 text-xs text-text-muted">{workload.allocatedWeeklyHours} of {workload.maximumWeeklyHours} hours allocated</p>
              </div>
            ))}
            {readiness.trainerWorkloads.length === 0 ? <p className="text-sm text-text-muted">Trainer workloads will appear after assignments are made.</p> : null}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2"><Building2 className="size-5 text-primary" aria-hidden="true" /><h2 className="font-semibold text-text-primary">Next action</h2></div>
          <p className="mt-3 text-sm leading-6 text-text-secondary">Complete every blocking allocation issue, then run the generator. Warnings may remain when automatic room assignment is acceptable.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/timetable/generator" className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold ${readiness.isReady ? 'bg-primary text-primary-foreground' : 'pointer-events-none bg-surface-muted text-text-muted'}`}>Open generator</Link>
            <Link href="/timetable/rooms" className="inline-flex h-10 items-center justify-center rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary">Manage rooms</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
