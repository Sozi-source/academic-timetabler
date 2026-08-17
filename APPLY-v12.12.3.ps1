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
Write-Host "Applying v12.12.3 Cohort Registration Student Exclusions..." -ForegroundColor Cyan

$componentFile =
    "src\features\student-unit-registration\batch-unit-registration.tsx"

$component = Read-Text $componentFile

# ------------------------------------------------------------
# 1. Cohort selection now preselects eligible students and lets
#    the HOD uncheck individual students.
# ------------------------------------------------------------

$oldSelect = @'
              <select
                id="cohortId"
                name="cohortId"
                value={cohortId}
                onChange={(event) =>
                  setCohortId(event.target.value)
                }
'@

$newSelect = @'
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
'@

if (-not $component.Contains($oldSelect)) {
    throw "Cohort select block was not found. No file was changed."
}

$component = $component.Replace($oldSelect, $newSelect)

# ------------------------------------------------------------
# 2. Show the current number actually selected in cohort mode.
# ------------------------------------------------------------

$oldCohortSummary = @'
                <div className="text-sm font-semibold text-slate-950">
                  {eligibleVisible.length} eligible
                </div>
                <div className="text-xs text-slate-500">
                  {cohortExpectedUnits} expected registrations
                </div>
'@

$newCohortSummary = @'
                <div className="text-sm font-semibold text-slate-950">
                  {selectedIds.size} selected
                </div>
                <div className="text-xs text-slate-500">
                  {eligibleVisible.length} eligible in cohort
                </div>
'@

if ($component.Contains($oldCohortSummary)) {
    $component = $component.Replace(
        $oldCohortSummary,
        $newCohortSummary
    )
}

# ------------------------------------------------------------
# 3. Replace cohort mode dots with checkboxes so specific
#    students can be excluded before registration.
# ------------------------------------------------------------

$oldControl = @'
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
'@

$newControl = @'
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
'@

if (-not $component.Contains($oldControl)) {
    throw "Student selection control block was not found. No file was changed."
}

$component = $component.Replace($oldControl, $newControl)

# ------------------------------------------------------------
# 4. In cohort mode, submit only the students still checked.
# ------------------------------------------------------------

$oldDisabled = @'
              !context.period ||
              (mode === 'cohort' && !cohortId) ||
              (mode === 'selected' &&
                selectedIds.size === 0)
'@

$newDisabled = @'
              !context.period ||
              (mode === 'cohort' && !cohortId) ||
              selectedIds.size === 0
'@

if ($component.Contains($oldDisabled)) {
    $component = $component.Replace($oldDisabled, $newDisabled)
}

$oldButton = @'
            {mode === 'cohort'
              ? 'Register eligible cohort students'
              : `Register ${selectedIds.size} selected students`}
'@

$newButton = @'
            {`Register ${selectedIds.size} selected students`}
'@

if ($component.Contains($oldButton)) {
    $component = $component.Replace($oldButton, $newButton)
}

# ------------------------------------------------------------
# 5. Greatly reduce banner wording.
# ------------------------------------------------------------

$oldBanner = @'
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
'@

$newBanner = @'
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Batch unit registration
          </h1>

          <p className="mt-1 text-sm text-slate-300">
            Register expected units by cohort or selected students.
          </p>
'@

if (-not $component.Contains($oldBanner)) {
    throw "Batch registration banner block was not found. No file was changed."
}

$component = $component.Replace($oldBanner, $newBanner)

# Remove now-unused cohortExpectedUnits calculation if present.
$oldCalc = @'
  const cohortExpectedUnits = cohortStudents.reduce(
    (sum, student) => sum + student.expectedUnits,
    0,
  );

'@

$component = $component.Replace($oldCalc, "")

Write-Text $componentFile $component

Write-Host "Cohort mode now supports student-by-student exclusions." -ForegroundColor Green
Write-Host "Batch banner wording reduced." -ForegroundColor Green

# ------------------------------------------------------------
# 6. Server action: pass checked student IDs even in cohort mode.
# ------------------------------------------------------------

$actionFile =
    "src\features\student-unit-registration\batch-actions.ts"

$action = Read-Text $actionFile

$oldRpcIds = @'
      selected_student_ids:
        mode === 'selected'
          ? studentIds
          : [],
'@

$newRpcIds = @'
      selected_student_ids: studentIds,
'@

if (-not $action.Contains($oldRpcIds)) {
    throw "Batch RPC student ID argument block was not found."
}

$action = $action.Replace($oldRpcIds, $newRpcIds)

# Cohort mode must also contain at least one checked student.
$oldCohortValidation = @'
  if (
    mode === 'cohort' &&
    (typeof cohortId !== 'string' || !cohortId)
  ) {
    redirect(
      '/students/unit-registration/batch?error=cohort',
    );
  }

  if (
    mode === 'selected' &&
    studentIds.length === 0
  ) {
    redirect(
      '/students/unit-registration/batch?error=students',
    );
  }
'@

$newCohortValidation = @'
  if (
    mode === 'cohort' &&
    (typeof cohortId !== 'string' || !cohortId)
  ) {
    redirect(
      '/students/unit-registration/batch?error=cohort',
    );
  }

  if (studentIds.length === 0) {
    redirect(
      '/students/unit-registration/batch?error=students',
    );
  }
'@

if (-not $action.Contains($oldCohortValidation)) {
    throw "Batch selection validation block was not found."
}

$action = $action.Replace(
    $oldCohortValidation,
    $newCohortValidation
)

Write-Text $actionFile $action

Write-Host "Server action now respects cohort exclusions." -ForegroundColor Green

Write-Host ""
Write-Host "v12.12.3 applied successfully." -ForegroundColor Green
Write-Host "No database migration is required." -ForegroundColor Cyan
