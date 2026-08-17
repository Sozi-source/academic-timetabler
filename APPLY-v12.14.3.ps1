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
    [System.IO.File]::WriteAllText(
        (Resolve-Path $Path),
        $Content,
        $utf8
    )
}

Write-Host ""
Write-Host "Applying v12.14.3 Batch Registration Eligibility Diagnostics..." -ForegroundColor Cyan

# ============================================================
# 1. Extend BatchRegistrationStudent type with diagnostic state.
# ============================================================

$typeFile =
    "src\features\student-unit-registration\batch-types.ts"

$types = Read-Text $typeFile

if ($types -notmatch "eligibilityReason") {
    $old = @'
  expectedUnits: number;
  eligible: boolean;
}
'@

    $new = @'
  expectedUnits: number;
  eligible: boolean;
  eligibilityReason:
    | 'ready'
    | 'no_stage'
    | 'no_stage_units'
    | 'no_units_on_offer';
}
'@

    if (-not $types.Contains($old)) {
        throw "Could not locate BatchRegistrationStudent eligibility fields."
    }

    $types = $types.Replace($old, $new)
    Write-Text $typeFile $types

    Write-Host "BatchRegistrationStudent diagnostics added." -ForegroundColor Green
}

# ============================================================
# 2. Update batch query to distinguish stage bindings from
#    offered units.
# ============================================================

$queryFile =
    "src\features\student-unit-registration\batch-queries.ts"

$query = Read-Text $queryFile

$oldReturn = @'
    return {
      id: student.id,
      admissionNumber: student.admission_number,
      fullName: student.full_name,
      programmeCode:
        programmeCode.get(student.programme_id) ?? '-',
      cohortId: student.current_cohort_id,
      cohortName: cohort?.name ?? null,
      stageId: student.current_stage_id,
      stageCode: stage?.code ?? null,
      expectedUnits,
      eligible:
        Boolean(student.current_stage_id) &&
        Boolean(student.current_cohort_id) &&
        expectedUnits > 0,
    };
'@

$newReturn = @'
    const hasStage = Boolean(student.current_stage_id);
    const hasStageUnits = stageUnits.size > 0;
    const hasMatchingOfferings = expectedUnits > 0;

    const eligibilityReason:
      | 'ready'
      | 'no_stage'
      | 'no_stage_units'
      | 'no_units_on_offer' =
      !hasStage
        ? 'no_stage'
        : !hasStageUnits
          ? 'no_stage_units'
          : !hasMatchingOfferings
            ? 'no_units_on_offer'
            : 'ready';

    return {
      id: student.id,
      admissionNumber: student.admission_number,
      fullName: student.full_name,
      programmeCode:
        programmeCode.get(student.programme_id) ?? '-',
      cohortId: student.current_cohort_id,
      cohortName: cohort?.name ?? null,
      stageId: student.current_stage_id,
      stageCode: stage?.code ?? null,
      expectedUnits,
      eligible:
        Boolean(student.current_cohort_id) &&
        eligibilityReason === 'ready',
      eligibilityReason,
    };
'@

if (-not $query.Contains($oldReturn)) {
    throw "Could not locate mapped student return block in batch-queries.ts."
}

$query = $query.Replace($oldReturn, $newReturn)
Write-Text $queryFile $query

Write-Host "Eligibility diagnostic logic added." -ForegroundColor Green

# ============================================================
# 3. Upgrade Batch Registration UI to show exact reason.
# ============================================================

$componentFile =
    "src\features\student-unit-registration\batch-unit-registration.tsx"

$component = Read-Text $componentFile

if ($component -notmatch "function eligibilityLabel") {
    $anchor = "interface BatchUnitRegistrationProps {"

    $helper = @'
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

'@

    if (-not $component.Contains($anchor)) {
        throw "Could not locate BatchUnitRegistrationProps anchor."
    }

    $component = $component.Replace(
        $anchor,
        $helper + $anchor
    )
}

$oldBadge = @'
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
'@

$newBadge = @'
                  <span>
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
                  </span>
'@

if (-not $component.Contains($oldBadge)) {
    throw "Could not locate generic Needs attention badge."
}

$component = $component.Replace($oldBadge, $newBadge)

$oldHelp = @'
              <p className="mt-0.5 text-xs text-slate-500">
                Missing stages or unavailable expected units are flagged for attention.
              </p>
'@

$newHelp = @'
              <p className="mt-0.5 text-xs text-slate-500">
                Registration blockers are shown against each student.
              </p>
'@

$component = $component.Replace($oldHelp, $newHelp)

# ============================================================
# 4. Add cohort diagnostic summary.
# ============================================================

$summaryAnchor = @'
            {mode === 'cohort' && cohortId ? (
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-950">
                  {selectedIds.size} selected
                </div>
                <div className="text-xs text-slate-500">
                  {eligibleVisible.length} eligible in cohort
                </div>
              </div>
            ) : null}
'@

$summaryReplacement = @'
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
'@

if ($component.Contains($summaryAnchor)) {
    $component = $component.Replace(
        $summaryAnchor,
        $summaryReplacement
    )
}

Write-Text $componentFile $component

Write-Host "Batch Registration diagnostic UI updated." -ForegroundColor Green

Write-Host ""
Write-Host "v12.14.3 applied successfully." -ForegroundColor Green
Write-Host "No database migration is required." -ForegroundColor Cyan
