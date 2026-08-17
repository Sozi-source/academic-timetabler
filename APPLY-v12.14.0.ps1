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
Write-Host "Applying v12.14.0 Fixed Sidebars + Cohort Stage Assignment..." -ForegroundColor Cyan

# ============================================================
# 1. Make module sidebars persistent on desktop.
#    The main DashboardSidebar is already fixed in the current shell.
#    Nested module sidebars stay in normal layout flow but become
#    sticky full-height, avoiding overlap/offset regressions.
# ============================================================

$sidebarCandidates = Get-ChildItem ".\src" -Recurse -File -Filter "*.tsx" |
    Where-Object {
        $text = [System.IO.File]::ReadAllText($_.FullName)
        (
            $text.Contains("<aside") -and
            (
                $text.Contains("Back to module hub") -or
                $_.Name -match "sidebar"
            )
        )
    }

$patchedSidebars = @()

foreach ($candidate in $sidebarCandidates) {
    $text = [System.IO.File]::ReadAllText($candidate.FullName)

    # Do not modify a desktop sidebar that is already genuinely fixed.
    if (
        $text -match '<aside className="[^"]*\bfixed\b[^"]*\blg:block\b'
    ) {
        continue
    }

    $asidePattern = '<aside className="([^"]+)"'
    $match = [regex]::Match($text, $asidePattern)

    if (-not $match.Success) {
        continue
    }

    $classes = $match.Groups[1].Value

    if ($classes -match '\blg:sticky\b|\blg:fixed\b') {
        continue
    }

    $persistentClasses =
        "$classes lg:sticky lg:top-0 lg:h-dvh lg:self-start lg:overflow-y-auto"

    $replacement = '<aside className="' + $persistentClasses + '"'

    $updated =
        $text.Substring(0, $match.Index) +
        $replacement +
        $text.Substring($match.Index + $match.Length)

    [System.IO.File]::WriteAllText(
        $candidate.FullName,
        $updated,
        $utf8
    )

    $patchedSidebars += $candidate.FullName
}

if ($patchedSidebars.Count -gt 0) {
    Write-Host "Persistent desktop module sidebars updated:" -ForegroundColor Green
    $patchedSidebars | ForEach-Object {
        Write-Host "  $_" -ForegroundColor DarkGreen
    }
}
else {
    Write-Host "No additional module sidebar needed adjustment." -ForegroundColor DarkGray
}

$dashboardSidebar = "src\components\layout\dashboard-sidebar.tsx"

if (Test-Path $dashboardSidebar) {
    $dashboardText = Read-Text $dashboardSidebar

    if (
        $dashboardText -notmatch
        'fixed inset-y-0 left-0.*lg:block'
    ) {
        Write-Warning "The global DashboardSidebar is not in the expected fixed-desktop form. It was not changed automatically."
    }
    else {
        Write-Host "Global DashboardSidebar already fixed on desktop." -ForegroundColor Green
    }
}

# ============================================================
# 2. Add cohort stage data to the Batch Registration page.
# ============================================================

$batchPages = Get-ChildItem ".\src\app" -Recurse -File -Filter "page.tsx" |
    Where-Object {
        $_.FullName -replace '/', '\' -match
            '\\students\\unit-registration\\batch\\page\.tsx$'
    }

if ($batchPages.Count -ne 1) {
    throw "Expected exactly one batch unit-registration page, found $($batchPages.Count)."
}

$batchPage = $batchPages[0].FullName
$page = [System.IO.File]::ReadAllText($batchPage)

if ($page -notmatch "getCohortStageSetups") {
    $queryImport = @'
import { getCohortStageSetups } from '@/features/student-unit-registration/cohort-stage-queries';
'@

    $firstImportEnd = $page.IndexOf([Environment]::NewLine)

    if ($firstImportEnd -lt 0) {
        throw "Could not locate import section in batch page."
    }

    $page =
        $page.Substring(0, $firstImportEnd + [Environment]::NewLine.Length) +
        $queryImport +
        $page.Substring($firstImportEnd + [Environment]::NewLine.Length)

    $oldPromise = @'
  const [context, params] = await Promise.all([
    getBatchRegistrationContext(),
    searchParams,
  ]);
'@

    $newPromise = @'
  const [context, cohortStageSetups, params] = await Promise.all([
    getBatchRegistrationContext(),
    getCohortStageSetups(),
    searchParams,
  ]);
'@

    if (-not $page.Contains($oldPromise)) {
        throw "Expected batch page Promise.all block was not found."
    }

    $page = $page.Replace($oldPromise, $newPromise)

    $oldProps = @'
        context={context}
        summary={summary}
        error={error}
'@

    $newProps = @'
        context={context}
        cohortStageSetups={cohortStageSetups}
        summary={summary}
        error={error}
'@

    if (-not $page.Contains($oldProps)) {
        throw "Expected BatchUnitRegistration props block was not found."
    }

    $page = $page.Replace($oldProps, $newProps)
    [System.IO.File]::WriteAllText($batchPage, $page, $utf8)

    Write-Host "Batch page now loads cohort stage setup." -ForegroundColor Green
}

# ============================================================
# 3. Add cohort stage control to existing BatchUnitRegistration.
# ============================================================

$componentFile =
    "src\features\student-unit-registration\batch-unit-registration.tsx"

$component = Read-Text $componentFile

if ($component -notmatch "CohortStageAssignment") {
    $importAnchor =
        "import { batchRegisterExpectedUnits } from './batch-actions';"

    if (-not $component.Contains($importAnchor)) {
        throw "Batch action import anchor was not found."
    }

    $component = $component.Replace(
        $importAnchor,
        $importAnchor + [Environment]::NewLine +
        "import { CohortStageAssignment } from './cohort-stage-assignment';" +
        [Environment]::NewLine +
        "import type { CohortStageSetup } from './cohort-stage-types';"
    )

    $oldProps = @'
interface BatchUnitRegistrationProps {
  context: BatchRegistrationContext;
  summary: BatchRegistrationSummary | null;
  error: string | null;
}
'@

    $newProps = @'
interface BatchUnitRegistrationProps {
  context: BatchRegistrationContext;
  cohortStageSetups: CohortStageSetup[];
  summary: BatchRegistrationSummary | null;
  error: string | null;
}
'@

    if (-not $component.Contains($oldProps)) {
        throw "BatchUnitRegistrationProps block was not found."
    }

    $component = $component.Replace($oldProps, $newProps)

    $oldSignature = @'
export function BatchUnitRegistration({
  context,
  summary,
  error,
}: BatchUnitRegistrationProps) {
'@

    $newSignature = @'
export function BatchUnitRegistration({
  context,
  cohortStageSetups,
  summary,
  error,
}: BatchUnitRegistrationProps) {
'@

    if (-not $component.Contains($oldSignature)) {
        throw "BatchUnitRegistration function signature was not found."
    }

    $component = $component.Replace($oldSignature, $newSignature)

    $selectIndex = $component.IndexOf('id="cohortId"')

    if ($selectIndex -lt 0) {
        throw "Cohort selector was not found."
    }

    $selectClose = $component.IndexOf("</select>", $selectIndex)

    if ($selectClose -lt 0) {
        throw "Cohort selector closing tag was not found."
    }

    $insertAt = $selectClose + "</select>".Length

    $stageUi = @'

              {cohortId ? (
                <CohortStageAssignment
                  cohortId={cohortId}
                  setups={cohortStageSetups}
                />
              ) : null}
'@

    $component =
        $component.Substring(0, $insertAt) +
        $stageUi +
        $component.Substring($insertAt)

    Write-Text $componentFile $component

    Write-Host "Cohort stage assignment added to Batch Registration." -ForegroundColor Green
}

Write-Host ""
Write-Host "v12.14.0 source patch applied successfully." -ForegroundColor Green
Write-Host "Migration included: 20260818011000_cohort_stage_assignment.sql" -ForegroundColor Cyan
