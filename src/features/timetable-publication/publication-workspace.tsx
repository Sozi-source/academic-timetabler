import {
  Archive,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  FileClock,
  Send,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/ui/metric-card';

import {
  createTimetableVersionAction,
  transitionTimetableVersionAction,
} from './actions';
import type { TimetableVersion, TimetableVersionStatus } from './types';
import {
  getAllowedTimetableTransitions,
  getTransitionLabel,
} from './workflow';

function statusBadge(status: TimetableVersionStatus) {
  const variant = status === 'published' || status === 'approved'
    ? 'success'
    : status === 'under_review'
      ? 'warning'
      : status === 'archived'
        ? 'neutral'
        : 'primary';
  return <Badge variant={variant}>{status.replace('_', ' ')}</Badge>;
}

export function TimetablePublicationWorkspace({
  academicPeriodId,
  versions,
}: {
  academicPeriodId: string;
  versions: TimetableVersion[];
}) {
  const published = versions.find((version) => version.status === 'published');
  const latest = versions[0];

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Versions" value={String(versions.length)} description="Immutable timetable snapshots." icon={FileClock}/>
      <MetricCard label="Latest version" value={latest ? `v${latest.versionNumber}` : '—'} description={latest?.title ?? 'No version created.'} icon={Clock3}/>
      <MetricCard label="Published sessions" value={String(published?.sessionCount ?? 0)} description={published ? `Published as v${published.versionNumber}.` : 'No published timetable.'} icon={CalendarCheck2}/>
      <MetricCard label="Workflow state" value={latest?.status.replace('_', ' ') ?? 'Not started'} description="Current approval position." icon={CheckCircle2}/>
    </div>

    <form action={createTimetableVersionAction} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <input type="hidden" name="academicPeriodId" value={academicPeriodId}/>
      <h2 className="font-semibold text-text-primary">Create a controlled timetable version</h2>
      <p className="mt-1 text-sm text-text-muted">Capture the current draft as an immutable snapshot before review and publication.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.4fr_auto]">
        <input name="title" required minLength={3} placeholder="e.g. September–December 2026 master timetable" className="h-11 rounded-xl border border-border-strong bg-surface px-3 text-sm"/>
        <input name="changeSummary" placeholder="What changed in this version?" className="h-11 rounded-xl border border-border-strong bg-surface px-3 text-sm"/>
        <button type="submit" className="h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-white">Create version</button>
      </div>
    </form>

    <div className="space-y-4">
      {versions.map((version) => {
        const transitions = getAllowedTimetableTransitions(version.status);
        return <article key={version.id} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">{statusBadge(version.status)}<span className="text-xs font-semibold text-text-muted">VERSION {version.versionNumber}</span></div>
              <h2 className="mt-3 text-lg font-semibold text-text-primary">{version.title}</h2>
              <p className="mt-1 text-sm text-text-secondary">{version.changeSummary ?? 'No change summary supplied.'}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-text-muted"><span>{version.sessionCount} sessions</span><span>{version.conflictCount} blocking conflicts</span><span>Created {new Date(version.createdAt).toLocaleString()}</span></div>
            </div>
            {version.status === 'published' ? <div className="rounded-xl bg-success-surface px-4 py-3 text-sm font-semibold text-success">Current published timetable</div> : null}
          </div>

          {transitions.length > 0 ? <form action={transitionTimetableVersionAction} className="mt-5 grid gap-3 border-t border-border pt-4 md:grid-cols-[1fr_auto]">
            <input type="hidden" name="versionId" value={version.id}/>
            <input type="hidden" name="currentStatus" value={version.status}/>
            <input name="note" placeholder="Review, approval or publication note" className="h-10 rounded-xl border border-border-strong bg-surface px-3 text-sm"/>
            <div className="flex flex-wrap gap-2">{transitions.map((target) => <button key={target} name="targetStatus" value={target} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border-strong px-4 text-sm font-semibold hover:bg-surface-subtle">{target === 'published' ? <Send className="size-4"/> : target === 'archived' ? <Archive className="size-4"/> : <CheckCircle2 className="size-4"/>}{getTransitionLabel(target)}</button>)}</div>
          </form> : null}

          <details className="mt-4 border-t border-border pt-4">
            <summary className="cursor-pointer text-sm font-semibold text-text-primary">View snapshot and audit history</summary>
            <div className="mt-4 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-surface-subtle text-text-muted"><tr><th className="px-3 py-2">Day/time</th><th className="px-3 py-2">Cohort</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2">Trainer</th><th className="px-3 py-2">Room</th></tr></thead>
                  <tbody>{version.snapshot.map((session) => <tr key={session.id} className="border-t border-border"><td className="px-3 py-2 capitalize">{session.day}<br/>{session.startTime.slice(0,5)}–{session.endTime.slice(0,5)}</td><td className="px-3 py-2">{session.cohortName}</td><td className="px-3 py-2">{session.unitCode} · {session.unitName}</td><td className="px-3 py-2">{session.trainerName}</td><td className="px-3 py-2">{session.roomCode}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="space-y-2">{version.events.map((event) => <div key={event.id} className="rounded-xl bg-surface-subtle p-3 text-xs"><p className="font-semibold capitalize text-text-primary">{event.eventType.replace('_', ' ')}</p><p className="mt-1 text-text-muted">{event.fromStatus ? `${event.fromStatus} → ` : ''}{event.toStatus} · {new Date(event.performedAt).toLocaleString()}</p>{event.note ? <p className="mt-1 text-text-secondary">{event.note}</p> : null}</div>)}</div>
            </div>
          </details>
        </article>;
      })}
      {versions.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-text-muted">No timetable version has been created for this Academic Period.</div> : null}
    </div>
  </div>;
}
