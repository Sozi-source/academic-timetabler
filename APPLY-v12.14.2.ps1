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
Write-Host "Applying v12.14.2 Cohort Stage Integration Regex Fix..." -ForegroundColor Cyan

$componentFile =
    "src\features\student-unit-registration\batch-unit-registration.tsx"

$component = Read-Text $componentFile

# ============================================================
# 1. Ensure cohort-stage imports exist.
# ============================================================

$batchActionImport =
    "import { batchRegisterExpectedUnits } from './batch-actions';"

$assignmentImport =
    "import { CohortStageAssignment } from './cohort-stage-assignment';"

$typeImport =
    "import type { CohortStageSetup } from './cohort-stage-types';"

if (-not $component.Contains($assignmentImport)) {
    if (-not $component.Contains($batchActionImport)) {
        throw "Could not locate batch-actions import in $componentFile."
    }

    $component = $component.Replace(
        $batchActionImport,
        $batchActionImport + "`n" +
        $assignmentImport + "`n" +
        $typeImport
    )
}
elseif (-not $component.Contains($typeImport)) {
    $component = $component.Replace(
        $assignmentImport,
        $assignmentImport + "`n" + $typeImport
    )
}

# ============================================================
# 2. Add cohortStageSetups prop safely.
#    Use a Regex instance so PowerShell does not select the
#    Regex.Replace overload whose final argument is TimeSpan.
# ============================================================

if (
    $component -notmatch
    'cohortStageSetups:\s*CohortStageSetup\[\]'
) {
    $propsPattern =
        '(interface\s+BatchUnitRegistrationProps\s*\{\s*context:\s*BatchRegistrationContext;\s*)'

    $propsRegex = [System.Text.RegularExpressions.Regex]::new(
        $propsPattern,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if (-not $propsRegex.IsMatch($component)) {
        throw "Could not locate BatchUnitRegistrationProps context field."
    }

    $component = $propsRegex.Replace(
        $component,
        '$1' + "`n  cohortStageSetups: CohortStageSetup[];",
        1
    )
}

# ============================================================
# 3. Add cohortStageSetups to component function destructuring.
# ============================================================

if (
    $component -notmatch
    'export\s+function\s+BatchUnitRegistration\s*\(\s*\{[\s\S]*?\bcohortStageSetups\b'
) {
    $signaturePattern =
        '(export\s+function\s+BatchUnitRegistration\s*\(\s*\{\s*context\s*,)'

    $signatureRegex = [System.Text.RegularExpressions.Regex]::new(
        $signaturePattern,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if (-not $signatureRegex.IsMatch($component)) {
        throw "Could not locate BatchUnitRegistration function signature."
    }

    $component = $signatureRegex.Replace(
        $component,
        '$1' + "`n  cohortStageSetups,",
        1
    )
}

# ============================================================
# 4. Insert CohortStageAssignment under cohort selector.
# ============================================================

if ($component -notmatch '<CohortStageAssignment') {
    $selectRegex = [System.Text.RegularExpressions.Regex]::new(
        '<select[\s\S]*?id="cohortId"[\s\S]*?</select>',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    $selectMatch = $selectRegex.Match($component)

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

Write-Host "BatchUnitRegistration component integration completed." -ForegroundColor Green

# ============================================================
# 5. Verify route page was integrated by v12.14.1.
#    If not, repair it here too.
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

$stageQueryImport =
    "import { getCohortStageSetups } from '@/features/student-unit-registration/cohort-stage-queries';"

if (-not $page.Contains($stageQueryImport)) {
    $page = $stageQueryImport + "`n" + $page
}

if ($page -notmatch '\bcohortStageSetups\b') {
    $promisePattern =
        'const\s+\[\s*context\s*,\s*params\s*\]\s*=\s*await\s+Promise\.all\(\s*\[\s*getBatchRegistrationContext\(\)\s*,\s*searchParams\s*,?\s*\]\s*\);'

    $promiseRegex = [System.Text.RegularExpressions.Regex]::new(
        $promisePattern,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if (-not $promiseRegex.IsMatch($page)) {
        throw "Could not locate the Batch Registration Promise.all block."
    }

    $page = $promiseRegex.Replace(
        $page,
@'
const [context, cohortStageSetups, params] = await Promise.all([
    getBatchRegistrationContext(),
    getCohortStageSetups(),
    searchParams,
  ]);
'@,
        1
    )
}

if (
    $page -notmatch
    '<BatchUnitRegistration[\s\S]*?cohortStageSetups=\{cohortStageSetups\}'
) {
    $componentRegex = [System.Text.RegularExpressions.Regex]::new(
        '<BatchUnitRegistration\s+[\s\S]*?/>',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    $match = $componentRegex.Match($page)

    if (-not $match.Success) {
        throw "Could not locate <BatchUnitRegistration /> in the batch route."
    }

    $block = $match.Value

    $patchedBlock = $block -replace '/>\s*$', @'
        cohortStageSetups={cohortStageSetups}
      />
'@

    $page =
        $page.Substring(0, $match.Index) +
        $patchedBlock +
        $page.Substring($match.Index + $match.Length)
}

[System.IO.File]::WriteAllText(
    $batchPage,
    $page,
    $utf8
)

Write-Host "Batch route integration verified." -ForegroundColor Green

# ============================================================
# 6. Verify all v12.14 feature files exist.
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
        throw "Required v12.14 file is missing: $requiredFile"
    }
}

Write-Host ""
Write-Host "v12.14.2 applied successfully." -ForegroundColor Green
Write-Host "No sidebar changes were reverted." -ForegroundColor Cyan
Write-Host "The v12.14.0 database migration is ready for db push." -ForegroundColor Cyan
