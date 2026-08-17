$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Text([string]$Path) {
    if (-not (Test-Path $Path)) {
        throw "Required file not found: $Path"
    }

    return [System.IO.File]::ReadAllText(
        (Resolve-Path $Path),
        [System.Text.Encoding]::UTF8
    )
}

function Write-Text([string]$Path, [string]$Content) {
    $fullPath = if ([System.IO.Path]::IsPathRooted($Path)) {
        $Path
    }
    else {
        Join-Path $PWD.Path $Path
    }

    $parent = Split-Path -Parent $fullPath

    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    [System.IO.File]::WriteAllText(
        $fullPath,
        $Content,
        $utf8
    )
}

Write-Host ""
Write-Host "Applying v12.12.2 Batch Registration UI Completion..." -ForegroundColor Cyan

# ============================================================
# 1. Locate current registration routes safely.
# ============================================================

$mainPages = Get-ChildItem ".\src\app" -Recurse -File -Filter "page.tsx" |
    Where-Object {
        $_.FullName -replace '/', '\' -match
            '\\students\\unit-registration\\page\.tsx$'
    }

if ($mainPages.Count -ne 1) {
    throw "Expected exactly one students/unit-registration/page.tsx route, found $($mainPages.Count)."
}

$mainPage = $mainPages[0].FullName
$registrationDir = Split-Path -Parent $mainPage
$batchPage = Join-Path $registrationDir "batch\page.tsx"

if (-not (Test-Path $batchPage)) {
    throw "The v12.12 batch registration page was not found: $batchPage"
}

# ============================================================
# 2. Rewrite the batch page to support post-action summaries.
# ============================================================

$batchPageSource = @'
import type { Metadata } from 'next';

import { BatchUnitRegistration } from '@/features/student-unit-registration/batch-unit-registration';
import { getBatchRegistrationContext } from '@/features/student-unit-registration/batch-queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Batch Unit Registration | Academic Management',
  description:
    'Register expected units for selected students or an entire cohort.',
};

interface BatchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function numberParam(
  value: string | string[] | undefined,
): number {
  const parsed = Number(first(value) ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function BatchUnitRegistrationPage({
  searchParams,
}: BatchPageProps) {
  const [context, params] = await Promise.all([
    getBatchRegistrationContext(),
    searchParams,
  ]);

  const success = first(params.success) === '1';

  const summary = success
    ? {
        selected: numberParam(params.selected),
        eligible: numberParam(params.eligible),
        created: numberParam(params.created),
        skipped: numberParam(params.skipped),
        attention: numberParam(params.attention),
      }
    : null;

  const error = first(params.error) ?? null;

  return (
    <main className="mx-auto w-full max-w-[1500px] px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
      <BatchUnitRegistration
        context={context}
        summary={summary}
        error={error}
      />
    </main>
  );
}
'@

Write-Text $batchPage $batchPageSource

Write-Host "Batch page now reads success/error summaries." -ForegroundColor Green

# ============================================================
# 3. Upgrade the existing client component.
# ============================================================

$componentFile =
    "src\features\student-unit-registration\batch-unit-registration.tsx"

$componentSource = @'
'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { batchRegisterExpectedUnits } from './batch-actions';
import type { BatchRegistrationContext } from './batch-types';

interface BatchRegistrationSummary {
  selected: number;
  eligible: number;
  created: number;
  skipped: number;
  attention: number;
}

interface BatchUnitRegistrationProps {
  context: BatchRegistrationContext;
  summary: BatchRegistrationSummary | null;
  error: string | null;
}

export function BatchUnitRegistration({
  context,
  summary,
  error,
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

  const cohortExpectedUnits = cohortStudents.reduce(
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/students/unit-registration"
          className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Back to Unit Registration
        </Link>

        <Link
          href="/students/unit-registration/stages"
          className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          Programme stages
        </Link>
      </div>

      {summary ? (
        <section
          aria-live="polite"
          className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50"
        >
          <div className="border-b border-emerald-200 px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold text-emerald-950">
              Batch registration completed
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-emerald-800">
              Existing unit registrations were preserved and skipped automatically.
            </p>
          </div>

          <div className="grid gap-px bg-emerald-200 sm:grid-cols-5">
            <div className="bg-emerald-50 px-4 py-3">
              <div className="text-lg font-semibold text-emerald-950">
                {summary.selected}
              </div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                Selected
              </div>
            </div>

            <div className="bg-emerald-50 px-4 py-3">
              <div className="text-lg font-semibold text-emerald-950">
                {summary.eligible}
              </div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                Eligible
              </div>
            </div>

            <div className="bg-emerald-50 px-4 py-3">
              <div className="text-lg font-semibold text-emerald-950">
                {summary.created}
              </div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                Created
              </div>
            </div>

            <div className="bg-emerald-50 px-4 py-3">
              <div className="text-lg font-semibold text-emerald-950">
                {summary.skipped}
              </div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                Already registered
              </div>
            </div>

            <div
              className={
                summary.attention > 0
                  ? 'bg-amber-50 px-4 py-3'
                  : 'bg-emerald-50 px-4 py-3'
              }
            >
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

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-950 px-5 py-4 text-white sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
            Unit registration
          </p>

          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            Batch student registration
          </h1>

          <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-300">
            Register an entire cohort or selected students. Every learner is resolved
            independently using programme, current stage, stage-unit bindings and
            units on offer.
          </p>
        </div>

        <div className="grid gap-px bg-slate-200 sm:grid-cols-4">
          <div className="bg-white px-4 py-3">
            <div className="text-xl font-semibold text-slate-950">
              {context.students.length}
            </div>
            <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Students
            </div>
          </div>

          <div className="bg-white px-4 py-3">
            <div className="text-xl font-semibold text-slate-950">
              {
                context.students.filter(
                  (student) => student.eligible,
                ).length
              }
            </div>
            <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Eligible
            </div>
          </div>

          <div className="bg-white px-4 py-3">
            <div className="text-xl font-semibold text-slate-950">
              {context.cohorts.length}
            </div>
            <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Cohorts
            </div>
          </div>

          <div className="bg-white px-4 py-3">
            <div className="text-sm font-semibold text-slate-950">
              {context.period?.code ?? 'No active period'}
            </div>
            <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
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
                onChange={(event) =>
                  setCohortId(event.target.value)
                }
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
                Missing stages or unavailable expected units are flagged for attention.
              </p>
            </div>

            {mode === 'cohort' && cohortId ? (
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-950">
                  {eligibleVisible.length} eligible
                </div>
                <div className="text-xs text-slate-500">
                  {cohortExpectedUnits} expected registrations
                </div>
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
                  {mode === 'selected' ? (
                    <input
                      type="checkbox"
                      name="studentIds"
                      value={student.id}
                      checked={selectedIds.has(student.id)}
                      onChange={() =>
                        toggleStudent(student.id)
                      }
                      disabled={!student.eligible}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  )}

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

                  <span>
                    {student.eligible ? (
                      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                        {student.expectedUnits} expected
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                        Needs attention
                      </span>
                    )}
                  </span>
                </label>
              ))
            )}
          </div>
        </section>

        <div className="sticky bottom-3 flex justify-end rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <button
            type="submit"
            disabled={
              !context.period ||
              (mode === 'cohort' && !cohortId) ||
              (mode === 'selected' &&
                selectedIds.size === 0)
            }
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {mode === 'cohort'
              ? 'Register eligible cohort students'
              : `Register ${selectedIds.size} selected students`}
          </button>
        </div>
      </form>
    </div>
  );
}
'@

Write-Text $componentFile $componentSource

Write-Host "Batch registration UI upgraded." -ForegroundColor Green

# ============================================================
# 4. Safely put Batch Registration inside the FINAL main return.
#    This avoids the conditional-return JSX problem from v12.12.0.
# ============================================================

$main = Read-Text $mainPage

if ($main -notmatch "BatchRegistrationLink") {
    $importLine =
        "import { BatchRegistrationLink } from '@/features/student-unit-registration/batch-registration-link';"

    # Insert after import block, before the first non-import statement.
    $lines = $main -split "`r?`n"
    $lastImport = -1

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if (
            $lines[$i] -match '^\s*import\b' -or
            ($lastImport -ge 0 -and
             $lines[$i] -match '^\s+.*from\s+[''"]')
        ) {
            $lastImport = $i
        }
        elseif (
            $lastImport -ge 0 -and
            $lines[$i] -match '^\s*};?\s*$'
        ) {
            $lastImport = $i
        }
        elseif (
            $lastImport -ge 0 -and
            $lines[$i].Trim().Length -gt 0
        ) {
            break
        }
    }

    if ($lastImport -lt 0) {
        $main = $importLine + [Environment]::NewLine + $main
    }
    else {
        $before = $lines[0..$lastImport]
        $after =
            if ($lastImport + 1 -lt $lines.Count) {
                $lines[($lastImport + 1)..($lines.Count - 1)]
            }
            else {
                @()
            }

        $main =
            (@($before) + $importLine + @($after)) -join
            [Environment]::NewLine
    }
}

if ($main -notmatch "<BatchRegistrationLink\s*/>") {
    $lastReturn = $main.LastIndexOf("return (")

    if ($lastReturn -lt 0) {
        throw "Could not find the main Unit Registration return block."
    }

    $tail = $main.Substring($lastReturn)

    # Prefer inserting inside the root <div> or <main>.
    $rootMatch = [regex]::Match(
        $tail,
        '<(main|div)\b[^>]*>',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if ($rootMatch.Success) {
        $insertAt =
            $lastReturn +
            $rootMatch.Index +
            $rootMatch.Length

        $button = @'

      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <BatchRegistrationLink />
      </div>
'@

        $main =
            $main.Substring(0, $insertAt) +
            $button +
            $main.Substring($insertAt)
    }
    else {
        # Fragment root fallback.
        $fragmentIndex = $tail.IndexOf("<>")

        if ($fragmentIndex -lt 0) {
            throw "Could not identify the final Unit Registration JSX root safely."
        }

        $insertAt =
            $lastReturn +
            $fragmentIndex +
            2

        $main =
            $main.Substring(0, $insertAt) +
            [Environment]::NewLine +
            "      <div className=`"mb-4 flex justify-end`"><BatchRegistrationLink /></div>" +
            $main.Substring($insertAt)
    }

    Write-Host "Batch Registration action added inside the final page root." -ForegroundColor Green
}
else {
    Write-Host "Batch Registration action already present." -ForegroundColor DarkGray
}

Write-Text $mainPage $main

Write-Host ""
Write-Host "v12.12.2 applied successfully." -ForegroundColor Green
Write-Host "No database migration is required for this UI-completion patch." -ForegroundColor Cyan
