import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  FileClock,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';

import {
  PublishCurrentTimetableForm,
} from './publication-action-forms';
import type { TimetableVersion, TimetableVersionStatus } from './types';
import {
  getAutomaticTimetableVersionTitle,
  getNextTimetableVersionNumber,
} from './workflow';

const HISTORY_PREVIEW_COUNT = 4;

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

function VersionSnapshot({ version }: { version: TimetableVersion }) {
  return (
    <details className="mt-3 border-t border-border-soft pt-3">
      <summary className="cursor-pointer text-xs font-semibold text-primary">View snapshot and audit history</summary>
      <div className="mt-3 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="w-full overflow-hidden rounded-xl border border-border">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="bg-surface-subtle text-text-muted"><tr><th className="px-3 py-2">Day/time</th><th className="px-3 py-2">Cohort</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2">Trainer</th><th className="px-3 py-2">Room</th></tr></thead>
            <tbody>{version.snapshot.map((session) => <tr key={session.id} className="border-t border-border"><td className="px-3 py-2 capitalize">{session.day}<br/>{session.startTime.slice(0,5)}–{session.endTime.slice(0,5)}</td><td className="px-3 py-2">{session.cohortName}</td><td className="px-3 py-2">{session.unitCode} · {session.unitName}</td><td className="px-3 py-2">{session.trainerId ? session.trainerName : <Badge variant="warning">Unassigned</Badge>}</td><td className="px-3 py-2">{session.roomCode ?? 'No room assigned'}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="space-y-2">{version.events.map((event) => <div key={event.id} className="rounded-xl bg-surface-subtle p-3 text-xs"><p className="font-semibold capitalize text-text-primary">{event.eventType.replace('_', ' ')}</p><p className="mt-1 text-text-muted">{event.fromStatus ? `${event.fromStatus} → ` : ''}{event.toStatus} · {new Date(event.performedAt).toLocaleString()}</p>{event.note ? <p className="mt-1 text-text-secondary">{event.note}</p> : null}</div>)}</div>
      </div>
    </details>
  );
}

function HistoryRow({ version }: { version: TimetableVersion }) {
  return (
    <div className="px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {statusBadge(version.status)}
          <span className="text-xs font-semibold text-text-muted">V{version.versionNumber}</span>
          <span className="truncate text-sm font-medium text-text-primary">{version.title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs text-text-muted">
          <span>{version.sessionCount} sessions</span>
          <span>{new Date(version.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <VersionSnapshot version={version} />
    </div>
  );
}

export function TimetablePublicationWorkspace({
  academicPeriodId,
  academicPeriodName,
  canPublish,
  versions,
}: {
  academicPeriodId: string;
  academicPeriodName: string;
  canPublish: boolean;
  versions: TimetableVersion[];
}) {
  const published = versions.find((version) => version.status === 'published');
  const latest = versions[0];
  const history = versions.filter((version) => version.id !== published?.id);
  const visibleHistory = history.slice(0, HISTORY_PREVIEW_COUNT);
  const overflowHistory = history.slice(HISTORY_PREVIEW_COUNT);
  const nextVersionNumber = getNextTimetableVersionNumber(
    versions.map((version) => version.versionNumber),
  );
  const nextVersionTitle = getAutomaticTimetableVersionTitle(
    academicPeriodName,
    nextVersionNumber,
  );

  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Versions" value={String(versions.length)} description="Saved snapshots" icon={FileClock}/>
      <MetricCard label="Next version" value={`v${nextVersionNumber}`} description={nextVersionTitle} icon={Clock3}/>
      <MetricCard label="Published sessions" value={String(published?.sessionCount ?? 0)} description={published ? `Live as v${published.versionNumber}` : 'Draft only'} icon={CalendarCheck2}/>
      <MetricCard label="Publishing" value="Direct" description={latest ? `Status: ${latest.status.replace('_', ' ')}` : 'Direct publish'} icon={CheckCircle2}/>
    </div>

    {canPublish ? (
      <PublishCurrentTimetableForm
        academicPeriodId={academicPeriodId}
        nextVersionTitle={nextVersionTitle}
      />
    ) : (
      <Card className="p-4 text-sm text-text-muted">
        This Academic Period is archived. Its timetable history remains available, but it cannot receive a new published version.
      </Card>
    )}

    {published ? (
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Current published timetable</h2>
        <Card className="border-success-border bg-success-surface p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">{statusBadge(published.status)}<span className="text-xs font-semibold text-text-muted">VERSION {published.versionNumber}</span></div>
              <h3 className="mt-2 text-lg font-semibold text-text-primary">{published.title}</h3>
              <p className="mt-1 text-sm text-text-secondary">{published.changeSummary ?? 'Published from the validated live timetable.'}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-text-muted"><span>{published.sessionCount} sessions</span><span>{published.conflictCount} blocking conflicts</span><span>Created {new Date(published.createdAt).toLocaleString()}</span></div>
            </div>
          </div>
          <VersionSnapshot version={published} />
        </Card>
      </section>
    ) : null}

    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Version history</h2>
      {history.length === 0 ? (
        published ? null : (
          <EmptyState icon={FileClock} title="No timetable version yet" description="No timetable version has been created for this Academic Period." />
        )
      ) : (
        <div className="divide-y divide-border-soft rounded-2xl border border-border bg-surface">
          {visibleHistory.map((version) => <HistoryRow key={version.id} version={version} />)}
          {overflowHistory.length > 0 ? (
            <details className="group">
              <summary className="cursor-pointer list-none px-3 py-2.5 text-center text-sm font-semibold text-primary hover:bg-surface-subtle">
                Show {overflowHistory.length} more version{overflowHistory.length === 1 ? '' : 's'}
              </summary>
              <div className="divide-y divide-border-soft border-t border-border-soft">
                {overflowHistory.map((version) => <HistoryRow key={version.id} version={version} />)}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </section>
  </div>;
}
