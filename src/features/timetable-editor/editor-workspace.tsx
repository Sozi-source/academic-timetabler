import Link from 'next/link';
import { AlertTriangle, History, Lock, LockOpen, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { bulkLockTimetableSessionsAction, undoLastTimetableEditAction } from './actions';
import { ScheduleAllocationDialog } from './schedule-allocation-dialog';
import { SessionEditorCard } from './session-editor-card';
import type { EditorData } from './types';

export function TimetableEditorWorkspace({
  academicPeriodId,
  data,
}: {
  academicPeriodId: string;
  data: EditorData;
}) {
  const lockedCount = data.sessions.filter((s) => s.isLocked).length;
  const totalCount = data.sessions.length;
  const allLocked = totalCount > 0 && lockedCount === totalCount;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-bold text-text-primary">{totalCount} Timetable Sessions</h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft/60 px-2 py-0.5 text-xs font-bold text-primary border border-primary/20">
              <Lock className="size-3" />
              {lockedCount} of {totalCount} Hard-Fixed
            </span>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Locked sessions cannot be moved or altered by the auto-generator. Moves are checked atomically against clashes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {totalCount > 0 ? (
            <form action={bulkLockTimetableSessionsAction}>
              <input type="hidden" name="academicPeriodId" value={academicPeriodId} />
              <input type="hidden" name="lock" value={allLocked ? 'false' : 'true'} />
              <Button
                type="submit"
                variant={allLocked ? 'outline' : 'primary'}
                size="sm"
                leadingIcon={allLocked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
              >
                {allLocked ? 'Unlock All Sessions' : 'Lock All Sessions'}
              </Button>
            </form>
          ) : null}
          <form action={undoLastTimetableEditAction}>
            <input type="hidden" name="academicPeriodId" value={academicPeriodId} />
            <Button type="submit" variant="outline" size="sm" leadingIcon={<History className="size-4" />}>
              Undo last edit
            </Button>
          </form>
          <Link
            href="/timetable/generator"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-surface-subtle border border-border px-3 text-xs font-semibold text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
          >
            <ShieldCheck className="size-4" /> Generator Workspace
          </Link>
        </div>
      </div>

      {data.missingAllocations.length > 0 ? (
        <section className="rounded-2xl border border-warning/30 bg-warning-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-text-primary">
                <AlertTriangle className="size-4 text-warning" /> Units missing from timetable ({data.missingAllocations.length})
              </h2>
              <p className="mt-1 text-xs text-text-muted">
                These allocations are not yet placed on the grid. Click <strong>Place on Timetable</strong> to assign their Day, Slot, and Room directly from your physical master timetable.
              </p>
            </div>
            <Link href="/timetable/generator" className="text-xs font-semibold text-primary hover:underline">
              Review generator diagnosis
            </Link>
          </div>
          <div className="mt-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.missingAllocations.map((allocation) => (
              <div
                key={allocation.id}
                className="flex flex-col justify-between rounded-xl border border-warning/30 bg-surface p-3.5 text-sm shadow-sm hover:border-warning/50 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-primary">{allocation.unitCode}</span>
                    <span className="text-[10px] font-semibold text-text-muted bg-surface-subtle px-1.5 py-0.5 rounded border border-border-soft">
                      {allocation.cohortCode}
                    </span>
                  </div>
                  <p className="mt-1.5 font-bold text-text-primary text-xs leading-snug line-clamp-2" title={allocation.unitName}>
                    {allocation.unitName}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">{allocation.trainerName}</p>
                  <p className="mt-2 text-xs font-bold text-warning">
                    {allocation.missingSessionCount} of {allocation.expectedSessionCount} session{allocation.expectedSessionCount === 1 ? '' : 's'} missing
                  </p>
                </div>
                <ScheduleAllocationDialog allocation={allocation} data={data} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="overflow-x-auto pb-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 min-w-[1050px]">
          {data.workingDays.map((day) => {
            const sessions = data.sessions.filter((session) => session.workingDayId === day.id);
            const dayLockedCount = sessions.filter((s) => s.isLocked).length;
            return (
              <section
                key={day.id}
                className="min-w-[200px] rounded-2xl border border-border bg-surface-subtle p-3 border-t-4 border-t-institutional-yellow shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-text-primary">{day.label}</h2>
                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <span className="rounded-full bg-surface px-2 py-0.5 font-medium">{sessions.length}</span>
                    {dayLockedCount > 0 ? (
                      <span className="flex items-center gap-0.5 text-[10px] text-primary font-semibold" title={`${dayLockedCount} locked`}>
                        <Lock className="size-2.5" />
                        {dayLockedCount}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-3">
                  {sessions.length > 0 ? (
                    sessions.map((session) => (
                      <SessionEditorCard key={session.id} session={session} data={data} />
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-text-muted">
                      No sessions
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
