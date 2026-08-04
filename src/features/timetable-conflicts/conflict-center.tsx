import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  LockKeyhole,
  ShieldAlert,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/ui/metric-card';

import { setConflictReviewAction } from './actions';
import type { ConflictCenterData, TimetableConflict } from './types';

function badge(conflict: TimetableConflict) {
  if (conflict.review?.status === 'resolved') return <Badge variant="success">Resolved</Badge>;
  if (conflict.review?.status === 'acknowledged') return <Badge variant="warning">Acknowledged</Badge>;
  if (conflict.severity === 'blocked') return <Badge variant="danger">Blocked</Badge>;
  return <Badge variant="warning">Warning</Badge>;
}

export function TimetableConflictCenter({
  academicPeriodId,
  data,
}: {
  academicPeriodId: string;
  data: ConflictCenterData;
}) {
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Open conflicts" value={String(data.summary.total - data.summary.resolved)} description="Detected issues still requiring attention." icon={ShieldAlert}/>
      <MetricCard label="Blocking" value={String(data.summary.blocked)} description="Must be corrected before publication." icon={CircleAlert}/>
      <MetricCard label="Warnings" value={String(data.summary.warnings)} description="Quality or preference issues to review." icon={AlertTriangle}/>
      <MetricCard label="Resolved" value={String(data.summary.resolved)} description="Reviewed decisions retained in the audit trail." icon={CheckCircle2}/>
    </div>

    {data.conflicts.length === 0 ? <div className="rounded-2xl border border-success-border bg-success-surface p-8 text-center"><CheckCircle2 className="mx-auto size-8 text-success"/><h2 className="mt-3 font-semibold text-text-primary">No timetable conflicts detected</h2><p className="mt-1 text-sm text-text-muted">The current draft satisfies overlap, capacity and active constraint checks.</p></div> : null}

    <div className="space-y-3">
      {data.conflicts.map((conflict) => <article key={conflict.key} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">{badge(conflict)}{conflict.isLocked ? <Badge variant="neutral"><LockKeyhole className="mr-1 size-3"/>Locked session</Badge> : null}<span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{conflict.kind.replaceAll('_', ' ')}</span></div>
            <h2 className="mt-3 font-semibold text-text-primary">{conflict.title}</h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">{conflict.message}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-muted"><span>{conflict.resourceLabel}</span><span>{conflict.workingDayLabel}</span><span>{conflict.timeLabel}</span></div>
            {conflict.review?.resolutionNote ? <p className="mt-3 rounded-xl bg-surface-subtle px-3 py-2 text-xs text-text-secondary"><strong>Review note:</strong> {conflict.review.resolutionNote}</p> : null}
          </div>
          <Link href={`/timetable/editor?academicPeriodId=${academicPeriodId}&sessionId=${conflict.sessionIds[0]}`} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border-strong px-4 text-sm font-semibold text-text-primary hover:bg-surface-subtle">Open in editor <ExternalLink className="size-4"/></Link>
        </div>

        <form action={setConflictReviewAction} className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-[1fr_auto_auto_auto]">
          <input type="hidden" name="academicPeriodId" value={academicPeriodId}/><input type="hidden" name="conflictKey" value={conflict.key}/>
          <input name="resolutionNote" defaultValue={conflict.review?.resolutionNote ?? ''} placeholder="Resolution or review note" className="h-10 rounded-xl border border-border-strong bg-surface px-3 text-sm"/>
          <button name="status" value="acknowledged" className="h-10 rounded-xl border border-border-strong px-3 text-sm font-semibold">Acknowledge</button>
          <button name="status" value="resolved" className="h-10 rounded-xl bg-primary px-3 text-sm font-semibold text-white">Mark resolved</button>
          {conflict.review ? <button name="status" value="reopened" className="h-10 rounded-xl border border-border-strong px-3 text-sm font-semibold">Reopen</button> : <span/>}
        </form>
      </article>)}
    </div>
  </div>;
}
