'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import {
  batchRegisterExpectedUnits,
  confirmReportedStudents,
  dropUnconfirmedStudentUnits,
} from './batch-actions';
import { CohortStageAssignment } from './cohort-stage-assignment';
import type { CohortStageSetup } from './cohort-stage-types';
import type { BatchRegistrationContext } from './batch-types';

interface BatchRegistrationSummary {
  selected: number;
  eligible: number;
  created: number;
  skipped: number;
  attention: number;
}

function eligibilityLabel(
  reason:
    | 'ready'
    | 'no_stage'
    | 'no_stage_units'
    | 'no_units_on_offer',
  expectedUnits: number,
) {
  switch (reason) {
    case 'ready':
      return `${expectedUnits} units ready`;
    case 'no_stage':
      return 'No stage';
    case 'no_stage_units':
      return 'No stage units';
    case 'no_units_on_offer':
      return 'No matching units on offer';
  }
}
interface BatchUnitRegistrationProps {
  context: BatchRegistrationContext;
  
  cohortStageSetups: CohortStageSetup[];
  summary: BatchRegistrationSummary | null;
  error: string | null;
  notice: {
    type: 'confirmed' | 'dropped';
    students: number;
    registrations: number;
  } | null;
}

export function BatchUnitRegistration({
  context,
  cohortStageSetups,
  summary,
  error,
  notice,
}: BatchUnitRegistrationProps) {
  const [mode, setMode] = useState<'cohort' | 'selected'>('cohort');
  const [cohortId, setCohortId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(),
  );

  const cohortStudents = useMemo(
    () =>
      cohortId
        ? context.students.filter(
            (student) => student.cohortId === cohortId,
          )
        : [],
    [cohortId, context.students],
  );

  const visibleStudents =
    mode === 'cohort'
      ? cohortStudents
      : context.students;

  const eligibleVisible = visibleStudents.filter(
    (student) => student.eligible,
  );

  const selectedStudents = context.students.filter(
    (student) => selectedIds.has(student.id),
  );

  const selectedExpectedUnits = selectedStudents.reduce(
    (sum, student) => sum + student.expectedUnits,
    0,
  );


  const toggleStudent = (studentId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(studentId)) {
        next.delete(studentId);
      }
      else {
        next.add(studentId);
      }

      return next;
    });
  };

  const selectAllEligible = () => {
    setSelectedIds(
      new Set(
        context.students
          .filter((student) => student.eligible)
          .map((student) => student.id),
      ),
    );
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {summary ? (
        <section
          aria-live="polite"
          className="grid divide-y divide-emerald-200 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/50 sm:grid-cols-5 sm:divide-x sm:divide-y-0"
        >
          <div className="px-4 py-3">
            <div className="text-lg font-semibold text-emerald-950">
              {summary.selected}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
              Selected
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="text-lg font-semibold text-emerald-950">
              {summary.eligible}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
              Eligible
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="text-lg font-semibold text-emerald-950">
              {summary.created}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
              Created
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="text-lg font-semibold text-emerald-950">
              {summary.skipped}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
              Already registered
            </div>
          </div>

          <div className="px-4 py-3">
            <div
              className={
                summary.attention > 0
                  ? 'text-lg font-semibold text-amber-900'
                  : 'text-lg font-semibold text-emerald-950'
              }
            >
              {summary.attention}
            </div>
            <div
              className={
                summary.attention > 0
                  ? 'text-[11px] font-medium uppercase tracking-wide text-amber-700'
                  : 'text-[11px] font-medium uppercase tracking-wide text-emerald-700'
              }
            >
              Need attention
            </div>
          </div>
        </section>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          <span className="font-semibold">Registration was not completed.</span>{' '}
          {decodeURIComponent(error)}
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
        >
          <span className="font-semibold">
            {notice.type === 'confirmed'
              ? `${notice.students} students confirmed as reported.`
              : `${notice.students} unconfirmed students removed from active unit rosters.`}
          </span>{' '}
          {notice.registrations > 0
            ? `${notice.registrations} unit registrations were ${notice.type === 'confirmed' ? 'restored' : 'marked dropped'}.`
            : null}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-border bg-[#eef3f3] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dce7e7]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-[#426a6a]"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>

            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                Batch unit registration
              </h1>

              <p className="mt-0.5 text-sm text-slate-600">
                Register expected units by cohort or selected students.
              </p>
            </div>
          </div>
        </div>

        <div className="grid divide-y divide-slate-200 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="px-4 py-3">
            <div className="text-lg font-semibold text-slate-950">
              {context.students.length}
            </div>
            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Students
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="text-lg font-semibold text-slate-950">
              {
                context.students.filter(
                  (student) => student.eligible,
                ).length
              }
            </div>
            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Eligible
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="text-lg font-semibold text-slate-950">
              {context.cohorts.length}
            </div>
            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Cohorts
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="text-sm font-semibold text-slate-950 uppercase">
              {context.period?.code ?? 'No active period'}
            </div>
            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Academic period
            </div>
          </div>
        </div>
      </section>

      {!context.period ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          An active academic period is required before batch registration can run.
        </div>
      ) : null}

      <form
        action={batchRegisterExpectedUnits}
        className="space-y-4"
      >
        {context.period ? (
          <input
            type="hidden"
            name="academicPeriodId"
            value={context.period.id}
          />
        ) : null}

        <input type="hidden" name="mode" value={mode} />

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold text-slate-950">
            Registration scope
          </h2>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode('cohort')}
              className={
                mode === 'cohort'
                  ? 'rounded-lg border-2 border-slate-950 bg-slate-50 p-3 text-left'
                  : 'rounded-lg border border-slate-200 p-3 text-left transition hover:bg-slate-50'
              }
            >
              <span className="block text-sm font-semibold text-slate-950">
                Entire cohort
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                Register every eligible student in one cohort.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMode('selected')}
              className={
                mode === 'selected'
                  ? 'rounded-lg border-2 border-slate-950 bg-slate-50 p-3 text-left'
                  : 'rounded-lg border border-slate-200 p-3 text-left transition hover:bg-slate-50'
              }
            >
              <span className="block text-sm font-semibold text-slate-950">
                Selected students
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                Check only the students you want to process.
              </span>
            </button>
          </div>

          {mode === 'cohort' ? (
            <div className="mt-4">
              <label
                htmlFor="cohortId"
                className="text-xs font-semibold text-slate-700"
              >
                Cohort
              </label>

              <select
                id="cohortId"
                name="cohortId"
                value={cohortId}
                onChange={(event) => {
                  const nextCohortId = event.target.value;
                  setCohortId(nextCohortId);

                  const eligibleIds = context.students
                    .filter(
                      (student) =>
                        student.cohortId === nextCohortId &&
                        student.eligible,
                    )
                    .map((student) => student.id);

                  setSelectedIds(new Set(eligibleIds));
                }}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-500"
              >
                <option value="">Select cohort</option>

                {context.cohorts.map((cohort) => (
                  <option
                    key={cohort.id}
                    value={cohort.id}
                  >
                    {cohort.name} ({cohort.studentCount})
                  </option>
                ))}
              </select>
              {cohortId ? (
                <CohortStageAssignment
                  cohortId={cohortId}
                  setups={cohortStageSetups}
                />
              ) : null}
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">
                  {selectedIds.size} selected
                </div>
                <div className="text-xs text-slate-500">
                  {selectedExpectedUnits} expected unit registrations
                </div>
              </div>

              <div className="flex gap-2">
                {selectedIds.size > 0 ? (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Clear
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={selectAllEligible}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Select all eligible
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                Students
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Registration blockers are shown against each student.
              </p>
            </div>

            {mode === 'cohort' && cohortId ? (
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-950">
                  {selectedIds.size} selected
                </div>
                <div className="text-xs text-slate-500">
                  {eligibleVisible.length} eligible in cohort
                </div>
                {visibleStudents.some(
                  (student) =>
                    student.eligibilityReason !== 'ready',
                ) ? (
                  <div className="mt-1 text-[11px] text-amber-700">
                    {visibleStudents.filter(
                      (student) =>
                        student.eligibilityReason === 'no_stage',
                    ).length > 0
                      ? `${visibleStudents.filter(
                          (student) =>
                            student.eligibilityReason === 'no_stage',
                        ).length} no stage`
                      : ''}
                    {visibleStudents.filter(
                      (student) =>
                        student.eligibilityReason === 'no_stage_units',
                    ).length > 0
                      ? `${visibleStudents.filter(
                          (student) =>
                            student.eligibilityReason === 'no_stage_units',
                        ).length} no stage units`
                      : ''}
                    {visibleStudents.filter(
                      (student) =>
                        student.eligibilityReason === 'no_units_on_offer',
                    ).length > 0
                      ? `${visibleStudents.filter(
                          (student) =>
                            student.eligibilityReason === 'no_units_on_offer',
                        ).length} no matching units on offer`
                      : ''}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="divide-y divide-slate-200">
            {visibleStudents.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                {mode === 'cohort'
                  ? 'Select a cohort to view its students.'
                  : 'No students are available.'}
              </div>
            ) : (
              visibleStudents.map((student) => (
                <label
                  key={student.id}
                  className="grid gap-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_80px_80px_120px] sm:items-center sm:px-5"
                >
                  <input
                    type="checkbox"
                    name="studentIds"
                    value={student.id}
                    checked={selectedIds.has(student.id)}
                    onChange={() =>
                      toggleStudent(student.id)
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />

                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-950">
                      {student.fullName}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {student.admissionNumber}
                    </span>
                  </span>

                  <span className="text-xs font-semibold text-slate-700">
                    {student.programmeCode}
                  </span>

                  <span className="text-xs font-semibold text-slate-700">
                    {student.stageCode ?? 'No stage'}
                  </span>

                  <span className="flex flex-col items-start gap-1">
                    {student.eligibilityReason === 'ready' ? (
                      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                        {eligibilityLabel(
                          student.eligibilityReason,
                          student.expectedUnits,
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                        {eligibilityLabel(
                          student.eligibilityReason,
                          student.expectedUnits,
                        )}
                      </span>
                    )}
                    <span
                      className={
                        student.reportingStatus === 'reported'
                          ? 'inline-flex rounded-full bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-800 ring-1 ring-inset ring-sky-200'
                          : student.reportingStatus === 'pending'
                            ? 'inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-200'
                            : 'inline-flex rounded-full bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-800 ring-1 ring-inset ring-rose-200'
                      }
                    >
                      {student.reportingStatus === 'reported'
                        ? 'Reported · Active'
                        : student.reportingStatus === 'deferred'
                          ? 'Deferred'
                          : student.reportingStatus === 'dropped_out'
                            ? 'Dropped out'
                            : 'Reporting pending'}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
        </section>

        <div className="sticky bottom-3 flex flex-wrap justify-end gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <button
            type="submit"
            formAction={dropUnconfirmedStudentUnits}
            onClick={(event) => {
              if (!window.confirm('Mark the selected unconfirmed students’ unit registrations as dropped?')) {
                event.preventDefault();
              }
            }}
            disabled={!context.period || selectedIds.size === 0}
            className="inline-flex min-h-10 items-center justify-center rounded-full px-5 text-sm font-medium text-rose-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Drop unconfirmed units
          </button>

          <button
            type="submit"
            formAction={confirmReportedStudents}
            disabled={!context.period || selectedIds.size === 0}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#82b4a1] px-5 text-sm font-medium text-white transition hover:bg-[#6e9b8a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm reported
          </button>

          <button
            type="submit"
            disabled={
              !context.period ||
              (mode === 'cohort' && !cohortId) ||
              selectedIds.size === 0
            }
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#cbd5e1] px-5 text-sm font-medium text-white transition hover:bg-[#94a3b8] disabled:cursor-not-allowed disabled:bg-[#cbd5e1]"
          >
            {`Register Units (${selectedIds.size})`}
          </button>
        </div>
      </form>
    </div>
  );
}
