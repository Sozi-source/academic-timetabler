import Link from 'next/link';
import { AlertTriangle, History, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { undoLastTimetableEditAction } from './actions';
import { SessionEditorCard } from './session-editor-card';
import type { EditorData } from './types';

export function TimetableEditorWorkspace({
  academicPeriodId,
  data,
}: {
  academicPeriodId: string;
  data: EditorData;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-text-primary">{data.sessions.length} editable timetable sessions</p>
          <p className="mt-1 text-xs text-text-muted">Moves are checked atomically against trainer, cohort and room clashes.</p>
        </div>
        <div className="flex gap-2">
          <form action={undoLastTimetableEditAction}>
            <input type="hidden" name="academicPeriodId" value={academicPeriodId} />
            <Button type="submit" variant="outline" size="sm" leadingIcon={<History className="size-4" />}>Undo last edit</Button>
          </form>
          <Link href="/timetable/generator" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-white">
            <ShieldCheck className="size-4" /> Regenerate unlocked
          </Link>
        </div>
      </div>

      {data.missingAllocations.length > 0 ? (
        <section className="rounded-2xl border border-warning/30 bg-warning-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-text-primary">
                <AlertTriangle className="size-4 text-warning" /> Units missing from timetable
              </h2>
              <p className="mt-1 text-xs text-text-muted">These allocated units have sessions that the generator could not place.</p>
            </div>
            <Link href="/timetable/generator" className="text-sm font-semibold text-primary hover:underline">Review placement issues</Link>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {data.missingAllocations.map((allocation) => (
              <div key={allocation.id} className="rounded-xl border border-warning/20 bg-surface p-3 text-sm">
                <p className="font-semibold text-text-primary">{allocation.unitCode} — {allocation.unitName}</p>
                <p className="mt-1 text-xs text-text-muted">{allocation.cohortCode} · {allocation.trainerName}</p>
                <p className="mt-2 text-xs font-semibold text-warning">{allocation.missingSessionCount} of {allocation.expectedSessionCount} sessions missing</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-5">
        {data.workingDays.map((day) => {
          const sessions = data.sessions.filter((session) => session.workingDayId === day.id);
          return (
            <section key={day.id} className="min-w-0 rounded-2xl border border-border bg-surface-subtle p-3 border-t-4 border-t-institutional-yellow shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-text-primary">{day.label}</h2>
                <span className="rounded-full bg-surface px-2 py-1 text-xs text-text-muted">{sessions.length}</span>
              </div>
              <div className="space-y-3">
                {sessions.length > 0 ? sessions.map((session) => (
                  <SessionEditorCard key={session.id} session={session} data={data} />
                )) : <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-text-muted">No sessions</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
