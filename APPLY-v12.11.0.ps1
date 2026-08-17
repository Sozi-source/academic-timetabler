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
Write-Host "Applying v12.11.0 Programme Stage Management..." -ForegroundColor Cyan

# ============================================================
# 1. Extend stage query data with canonical stage code.
# ============================================================

$queryFile = "src\features\student-unit-registration\queries.ts"
$q = Read-Text $queryFile

$q = $q.Replace(
    ".select('id, name, code, sequence_number')",
    ".select('id, name, code, sequence_number')"
)

$q = $q.Replace(
    ".select('id, programme_id, name, code, sequence_number')",
    ".select('id, programme_id, name, code, sequence_number')"
)

# Add stage code to editor stageOptions if not already exposed.
$oldEditorMap = @'
    stageOptions: (stageResult.data ?? []).map((stage) => ({
      id: stage.id,
      name: stage.name,
      sequenceNumber: stage.sequence_number,
    })),
'@

$newEditorMap = @'
    stageOptions: (stageResult.data ?? []).map((stage) => ({
      id: stage.id,
      code: stage.code,
      name: stage.name,
      sequenceNumber: stage.sequence_number,
    })),
'@

if ($q.Contains($oldEditorMap)) {
    $q = $q.Replace($oldEditorMap, $newEditorMap)
}

# Add stage code to programme setup mapping.
$oldSetupMap = @'
      .map((stage) => ({
        id: stage.id,
        name: stage.name,
        sequenceNumber: stage.sequence_number,
        unitIds: (stageUnitResult.data ?? [])
'@

$newSetupMap = @'
      .map((stage) => ({
        id: stage.id,
        code: stage.code,
        name: stage.name,
        sequenceNumber: stage.sequence_number,
        unitIds: (stageUnitResult.data ?? [])
'@

if ($q.Contains($oldSetupMap)) {
    $q = $q.Replace($oldSetupMap, $newSetupMap)
}

Write-Text $queryFile $q

# ============================================================
# 2. Extend TypeScript stage models with canonical code.
# ============================================================

$typeFile = "src\features\student-unit-registration\types.ts"
$t = Read-Text $typeFile

$oldOption = @'
export interface ProgrammeStageOption {
  id: string;
  name: string;
  sequenceNumber: number;
}
'@

$newOption = @'
export interface ProgrammeStageOption {
  id: string;
  code: string;
  name: string;
  sequenceNumber: number;
}
'@

if ($t.Contains($oldOption)) {
    $t = $t.Replace($oldOption, $newOption)
}

$oldStage = @'
  stages: Array<{
    id: string;
    name: string;
    sequenceNumber: number;
    unitIds: string[];
  }>;
'@

$newStage = @'
  stages: Array<{
    id: string;
    code: string;
    name: string;
    sequenceNumber: number;
    unitIds: string[];
  }>;
'@

if ($t.Contains($oldStage)) {
    $t = $t.Replace($oldStage, $newStage)
}

Write-Text $typeFile $t

# ============================================================
# 3. Add professional Programme Stage Management component.
# ============================================================

$componentFile =
    "src\features\student-unit-registration\programme-stage-management.tsx"

$component = @'
import {
  saveProgrammeStageUnits,
} from '@/features/student-unit-registration/actions';

import type {
  ProgrammeStageSetup,
} from '@/features/student-unit-registration/types';

interface ProgrammeStageManagementProps {
  setups: ProgrammeStageSetup[];
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

export function ProgrammeStageManagement({
  setups,
}: ProgrammeStageManagementProps) {
  const totalStages = setups.reduce(
    (sum, setup) => sum + setup.stages.length,
    0,
  );

  const totalBindings = setups.reduce(
    (sum, setup) =>
      sum +
      setup.stages.reduce(
        (stageSum, stage) =>
          stageSum + stage.unitIds.length,
        0,
      ),
    0,
  );

  const unboundUnits = setups.reduce(
    (sum, setup) => {
      const bound = new Set(
        setup.stages.flatMap((stage) => stage.unitIds),
      );

      return (
        sum +
        setup.units.filter((unit) => !bound.has(unit.id)).length
      );
    },
    0,
  );

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
            Curriculum structure
          </p>

          <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Programme stages
              </h1>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
                Review the academic stages for each programme and confirm
                the curriculum units attached to every stage. Student unit
                registration uses these bindings to show only the expected
                units for the learner&apos;s current stage.
              </p>
            </div>

            <div className="text-xs text-slate-300">
              Stage codes follow the official Y1S1, Y1S2, Y1S3 format.
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-slate-200 sm:grid-cols-4">
          <div className="bg-white px-5 py-4">
            <div className="text-2xl font-semibold text-slate-950">
              {setups.length}
            </div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Programmes
            </div>
          </div>

          <div className="bg-white px-5 py-4">
            <div className="text-2xl font-semibold text-slate-950">
              {totalStages}
            </div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Stages
            </div>
          </div>

          <div className="bg-white px-5 py-4">
            <div className="text-2xl font-semibold text-slate-950">
              {totalBindings}
            </div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Unit bindings
            </div>
          </div>

          <div className="bg-white px-5 py-4">
            <div
              className={
                unboundUnits > 0
                  ? 'text-2xl font-semibold text-amber-700'
                  : 'text-2xl font-semibold text-emerald-700'
              }
            >
              {unboundUnits}
            </div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Unbound units
            </div>
          </div>
        </div>
      </section>

      {setups.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-slate-950">
            No programme stages available
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Programme stages will appear here after the canonical stage
            migration has been applied.
          </p>
        </section>
      ) : null}

      <div className="space-y-6">
        {setups.map((setup) => {
          const programmeBound = new Set(
            setup.stages.flatMap((stage) => stage.unitIds),
          );

          const programmeUnbound = setup.units.filter(
            (unit) => !programmeBound.has(unit.id),
          );

          return (
            <section
              key={setup.programmeId}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-md bg-slate-950 px-2.5 py-1 text-xs font-bold tracking-wide text-white">
                      {setup.programmeCode}
                    </span>

                    <h2 className="truncate text-lg font-semibold text-slate-950">
                      {setup.programmeName}
                    </h2>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {setup.stages.length}{' '}
                    {pluralize(setup.stages.length, 'stage')} ·{' '}
                    {setup.units.length}{' '}
                    {pluralize(setup.units.length, 'curriculum unit')}
                  </p>
                </div>

                <div
                  className={
                    programmeUnbound.length > 0
                      ? 'inline-flex w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200'
                      : 'inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200'
                  }
                >
                  {programmeUnbound.length > 0
                    ? `${programmeUnbound.length} unbound`
                    : 'All units bound'}
                </div>
              </header>

              <div className="divide-y divide-slate-200">
                {setup.stages
                  .slice()
                  .sort(
                    (a, b) =>
                      a.sequenceNumber - b.sequenceNumber,
                  )
                  .map((stage) => {
                    const selected = new Set(stage.unitIds);

                    return (
                      <form
                        key={stage.id}
                        action={saveProgrammeStageUnits}
                        className="px-5 py-5 sm:px-6"
                      >
                        <input
                          type="hidden"
                          name="stageId"
                          value={stage.id}
                        />

                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-11 min-w-16 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-950">
                              {stage.code}
                            </div>

                            <div className="min-w-0">
                              <h3 className="font-semibold text-slate-950">
                                {stage.name}
                              </h3>
                              <p className="mt-0.5 text-xs text-slate-500">
                                Sequence {stage.sequenceNumber} ·{' '}
                                {stage.unitIds.length}{' '}
                                {pluralize(
                                  stage.unitIds.length,
                                  'unit',
                                )}{' '}
                                currently bound
                              </p>
                            </div>
                          </div>

                          <button
                            type="submit"
                            className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                          >
                            Save stage units
                          </button>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {setup.units.map((unit) => (
                            <label
                              key={unit.id}
                              className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3.5 py-3 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                name="unitIds"
                                value={unit.id}
                                defaultChecked={selected.has(unit.id)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                              />

                              <span className="min-w-0">
                                <span className="block text-sm font-medium leading-5 text-slate-900">
                                  {unit.name}
                                </span>
                                <span className="mt-0.5 block text-xs text-slate-500">
                                  {unit.code}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </form>
                    );
                  })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
'@

Write-Text $componentFile $component

# ============================================================
# 4. Replace the existing stage route with the management page.
#    Locate it instead of assuming dashboard group naming.
# ============================================================

$stagePages = Get-ChildItem ".\src\app" -Recurse -File -Filter "page.tsx" |
    Where-Object {
        $_.FullName -replace '/', '\' -match
            '\\students\\unit-registration\\stages\\page\.tsx$'
    }

if ($stagePages.Count -ne 1) {
    throw "Expected exactly one students/unit-registration/stages/page.tsx route, found $($stagePages.Count)."
}

$stagePagePath = $stagePages[0].FullName

$stagePage = @'
import type { Metadata } from 'next';

import {
  ProgrammeStageManagement,
} from '@/features/student-unit-registration/programme-stage-management';
import {
  getProgrammeStageSetups,
} from '@/features/student-unit-registration/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Programme Stages | Academic Management',
  description:
    'Manage programme stages and curriculum unit bindings used for student unit registration.',
};

export default async function ProgrammeStagesPage() {
  const setups = await getProgrammeStageSetups();

  return (
    <main className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
      <ProgrammeStageManagement setups={setups} />
    </main>
  );
}
'@

Write-Text $stagePagePath $stagePage

Write-Host ""
Write-Host "Stage management route updated:" -ForegroundColor Green
Write-Host $stagePagePath -ForegroundColor DarkCyan

# ============================================================
# 5. Validate that the registration query is stage-filtered.
#    This is already the intended workflow in the existing code;
#    fail loudly if it has disappeared.
# ============================================================

$qCheck = Read-Text $queryFile

$requiredMarkers = @(
    "programme_stage_units",
    "row.stage_id === student.current_stage_id",
    "stageUnitIds.has(unit.id)"
)

foreach ($marker in $requiredMarkers) {
    if (-not $qCheck.Contains($marker)) {
        throw "Stage-filtered registration marker is missing: $marker"
    }
}

Write-Host "Stage-filtered student registration logic confirmed." -ForegroundColor Green

Write-Host ""
Write-Host "v12.11.0 applied successfully." -ForegroundColor Green
Write-Host "Programme stage management UI and stage-filtered registration foundation are ready." -ForegroundColor Cyan
