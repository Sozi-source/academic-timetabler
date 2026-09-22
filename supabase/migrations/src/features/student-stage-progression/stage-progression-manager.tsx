'use client';

import { useMemo, useState } from 'react';

import { progressSelectedStudents } from './actions';
import type { StageProgressionContext } from './types';

interface ProgressionSummary {
  requested: number;
  progressed: number;
  skipped: number;
}

interface StageProgressionManagerProps {
  context: StageProgressionContext;
  summary: ProgressionSummary | null;
  error: string | null;
}

export function StageProgressionManager({
  context,
  summary,
  error,
}: StageProgressionManagerProps) {
  const [cohortId, setCohortId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const students = useMemo(
    () =>
      cohortId
        ? context.students.filter((student) => student.cohortId === cohortId)
        : [],
    [cohortId, context.students],
  );

  const eligible = students.filter((student) => student.eligible);

  const selectCohort = (nextCohortId: string) => {
    setCohortId(nextCohortId);
    setSelectedIds(
      new Set(
        context.students
          .filter(
            (student) =>
              student.cohortId === nextCohortId && student.eligible,
          )
          .map((student) => student.id),
      ),
    );
  };

  const toggle = (studentId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {summary ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-emerald-950">
            Progression completed
          </h2>
          <p className="mt-1 text-xs text-emerald-800">
            {summary.progressed} progressed · {summary.skipped} skipped ·{' '}
            {summary.requested} selected
          </p>
        </section>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {decodeURIComponent(error)}
        </div>
      ) : null}

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-primary" />
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              Lifecycle progression
            </p>
          </div>

          <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Progress students
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Review the next stage and select who progresses.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <label htmlFor="cohortId" className="text-xs font-semibold text-foreground">
          Cohort
        </label>

        <select
          id="cohortId"
          value={cohortId}
          onChange={(event) => selectCohort(event.target.value)}
          className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="">Select cohort</option>
          {context.cohorts.map((cohort) => (
            <option key={cohort.id} value={cohort.id}>
              {cohort.name} ({cohort.studentCount})
            </option>
          ))}
        </select>

        {cohortId ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {eligible.length} eligible · {selectedIds.size} selected
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={() =>
                  setSelectedIds(new Set(eligible.map((student) => student.id)))
                }
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Select all eligible
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <form action={progressSelectedStudents} className="space-y-4">
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_80px_100px_100px] gap-3 border-b border-border bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-5">
            <span />
            <span>Student</span>
            <span>Programme</span>
            <span>Current</span>
            <span>Next</span>
          </div>

          <div className="divide-y divide-border">
            {students.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Select a cohort to review students.
              </div>
            ) : (
              students.map((student) => (
                <label
                  key={student.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)_80px_100px_100px] items-center gap-3 px-4 py-3 sm:px-5"
                >
                  <input
                    type="checkbox"
                    name="studentIds"
                    value={student.id}
                    checked={selectedIds.has(student.id)}
                    onChange={() => toggle(student.id)}
                    disabled={!student.eligible}
                    className="h-4 w-4 rounded border-border"
                  />

                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {student.fullName}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {student.admissionNumber}
                    </span>
                  </span>

                  <span className="text-xs font-semibold text-foreground">
                    {student.programmeCode}
                  </span>

                  <span className="text-xs font-semibold text-foreground">
                    {student.currentStageCode ?? 'Not set'}
                  </span>

                  <span>
                    {student.nextStageCode ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                        {student.nextStageCode}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
                        {student.terminal ? 'Final stage' : 'Needs stage'}
                      </span>
                    )}
                  </span>
                </label>
              ))
            )}
          </div>
        </section>

        {cohortId ? (
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <label htmlFor="note" className="text-xs font-semibold text-foreground">
              Progression note
              <span className="ml-1 font-normal text-muted-foreground">
                optional
              </span>
            </label>

            <input
              id="note"
              name="note"
              type="text"
              placeholder="e.g. Approved semester progression"
              className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </section>
        ) : null}

        <div className="sticky bottom-3 flex justify-end rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
          <button
            type="submit"
            disabled={selectedIds.size === 0}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Progress {selectedIds.size} selected
          </button>
        </div>
      </form>
    </div>
  );
}
