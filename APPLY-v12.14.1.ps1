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
Write-Host "Applying v12.14.1 Batch Page Integration Repair..." -ForegroundColor Cyan

# ============================================================
# 1. Sidebar work from v12.14.0 is intentionally preserved.
#    Re-running this script does not add duplicate sticky classes.
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

foreach ($candidate in $sidebarCandidates) {
    $text = [System.IO.File]::ReadAllText($candidate.FullName)

    if (
        $text -match '<aside className="[^"]*\bfixed\b[^"]*\blg:block\b' -or
        $text -match '<aside className="[^"]*\blg:sticky\b'
    ) {
        continue
    }

    $match = [regex]::Match(
        $text,
        '<aside className="([^"]+)"'
    )

    if (-not $match.Success) {
        continue
    }

    $classes = $match.Groups[1].Value
    $replacement =
        '<aside className="' +
        $classes +
        ' lg:sticky lg:top-0 lg:h-dvh lg:self-start lg:overflow-y-auto"'

    $updated =
        $text.Substring(0, $match.Index) +
        $replacement +
        $text.Substring($match.Index + $match.Length)

    [System.IO.File]::WriteAllText(
        $candidate.FullName,
        $updated,
        $utf8
    )
}

Write-Host "Sidebar persistence retained." -ForegroundColor Green

# ============================================================
# 2. Locate the exact Batch Unit Registration route.
# ============================================================

$batchPages = @(
    Get-ChildItem ".\src\app" -Recurse -File -Filter "page.tsx" |
        Where-Object {
            ($_.FullName -replace '/', '\') -match
                '\\students\\unit-registration\\batch\\page\.tsx$'
        }
)

if ($batchPages.Count -ne 1) {
    throw "Expected exactly one students/unit-registration/batch/page.tsx, found $($batchPages.Count)."
}

$batchPage = $batchPages[0].FullName
$page = [System.IO.File]::ReadAllText($batchPage)

# ============================================================
# 3. Add cohort-stage query import.
#    v12.14.0 failed because it searched for Environment.NewLine
#    while the TSX file uses LF line endings. This repair does not
#    depend on CRLF/LF at all.
# ============================================================

$stageQueryImport =
    "import { getCohortStageSetups } from '@/features/student-unit-registration/cohort-stage-queries';"

if (-not $page.Contains($stageQueryImport)) {
    $page =
        $stageQueryImport +
        "`n" +
        $page
}

# ============================================================
# 4. Expand page data loading.
# ============================================================

if ($page -notmatch '\bcohortStageSetups\b') {
    $promisePattern =
        'const\s+\[\s*context\s*,\s*params\s*\]\s*=\s*await\s+Promise\.all\(\s*\[\s*getBatchRegistrationContext\(\)\s*,\s*searchParams\s*,?\s*\]\s*\);'

    if (-not [regex]::IsMatch(
        $page,
        $promisePattern,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )) {
        Write-Host ""
        Write-Host "Current batch page data-loading block:" -ForegroundColor Yellow

        Select-String `
            -LiteralPath $batchPage `
            -Pattern "Promise.all|getBatchRegistrationContext|searchParams" `
            -Context 3,6

        throw "Could not locate the Batch Registration Promise.all block. No further page changes were made."
    }

    $replacement = @'
const [context, cohortStageSetups, params] = await Promise.all([
    getBatchRegistrationContext(),
    getCohortStageSetups(),
    searchParams,
  ]);
'@

    $page = [regex]::Replace(
        $page,
        $promisePattern,
        $replacement,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )
}

# ============================================================
# 5. Pass stage data to the existing client component.
# ============================================================

if (
    $page -notmatch
    '<BatchUnitRegistration[\s\S]*?cohortStageSetups=\{cohortStageSetups\}'
) {
    $componentPattern =
        '(<BatchUnitRegistration\s+)([\s\S]*?)(/>)'

    $componentMatch = [regex]::Match(
        $page,
        $componentPattern
    )

    if (-not $componentMatch.Success) {
        throw "Could not locate <BatchUnitRegistration /> in the batch route."
    }

    $existingProps = $componentMatch.Groups[2].Value

    $newComponent =
        $componentMatch.Groups[1].Value +
        $existingProps +
        "        cohortStageSetups={cohortStageSetups}`n" +
        $componentMatch.Groups[3].Value

    $page =
        $page.Substring(0, $componentMatch.Index) +
        $newComponent +
        $page.Substring(
            $componentMatch.Index +
            $componentMatch.Length
        )
}

[System.IO.File]::WriteAllText(
    $batchPage,
    $page,
    $utf8
)

Write-Host "Batch route integrated with cohort-stage data." -ForegroundColor Green

# ============================================================
# 6. Integrate the cohort-stage control into the existing
#    BatchUnitRegistration component.
# ============================================================

$componentFile =
    "src\features\student-unit-registration\batch-unit-registration.tsx"

$component = Read-Text $componentFile

$batchActionImport =
    "import { batchRegisterExpectedUnits } from './batch-actions';"

if (
    -not $component.Contains(
        "import { CohortStageAssignment } from './cohort-stage-assignment';"
    )
) {
    if (-not $component.Contains($batchActionImport)) {
        throw "Could not locate batch-actions import in $componentFile."
    }

    $component = $component.Replace(
        $batchActionImport,
        $batchActionImport +
        "`nimport { CohortStageAssignment } from './cohort-stage-assignment';" +
        "`nimport type { CohortStageSetup } from './cohort-stage-types';"
    )
}

if (
    $component -notmatch
    'cohortStageSetups:\s*CohortStageSetup\[\]'
) {
    $propsPattern =
        '(interface\s+BatchUnitRegistrationProps\s*\{\s*context:\s*BatchRegistrationContext;\s*)'

    if (-not [regex]::IsMatch(
        $component,
        $propsPattern,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )) {
        throw "Could not locate BatchUnitRegistrationProps context field."
    }

    $component = [regex]::Replace(
        $component,
        $propsPattern,
        '$1' + "`n  cohortStageSetups: CohortStageSetup[];",
        1,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )
}

if (
    $component -notmatch
    'export\s+function\s+BatchUnitRegistration\s*\(\s*\{[\s\S]*?\bcohortStageSetups\b'
) {
    $signaturePattern =
        '(export\s+function\s+BatchUnitRegistration\s*\(\s*\{\s*context\s*,)'

    if (-not [regex]::IsMatch(
        $component,
        $signaturePattern,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )) {
        throw "Could not locate BatchUnitRegistration function signature."
    }

    $component = [regex]::Replace(
        $component,
        $signaturePattern,
        '$1' + "`n  cohortStageSetups,",
        1,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )
}

if (
    $component -notmatch
    '<CohortStageAssignment'
) {
    $selectMatch = [regex]::Match(
        $component,
        '<select[\s\S]*?id="cohortId"[\s\S]*?</select>'
    )

    if (-not $selectMatch.Success) {
        throw "Could not locate the cohort selector in $componentFile."
    }

    $stageUi = @'

              {cohortId ? (
                <CohortStageAssignment
                  cohortId={cohortId}
                  setups={cohortStageSetups}
                />
              ) : null}
'@

    $insertAt =
        $selectMatch.Index +
        $selectMatch.Length

    $component =
        $component.Substring(0, $insertAt) +
        $stageUi +
        $component.Substring($insertAt)
}

Write-Text $componentFile $component

Write-Host "Cohort stage control integrated into Batch Registration." -ForegroundColor Green

# ============================================================
# 7. Verify required v12.14.0 files are present.
# ============================================================

$required = @(
    "supabase\migrations\20260818011000_cohort_stage_assignment.sql",
    "src\features\student-unit-registration\cohort-stage-types.ts",
    "src\features\student-unit-registration\cohort-stage-queries.ts",
    "src\features\student-unit-registration\cohort-stage-actions.ts",
    "src\features\student-unit-registration\cohort-stage-assignment.tsx"
)

foreach ($requiredFile in $required) {
    if (-not (Test-Path $requiredFile)) {
        throw "Required v12.14.0 file is missing: $requiredFile"
    }
}

Write-Host ""
Write-Host "v12.14.1 applied successfully." -ForegroundColor Green
Write-Host "The v12.14.0 cohort-stage migration is ready to push." -ForegroundColor Cyan
Write-Host "No sidebar changes were rolled back." -ForegroundColor Cyan
