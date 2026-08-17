$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Text([string]$Path) {
    if (-not (Test-Path $Path)) {
        throw "Required file not found: $Path"
    }
    return [System.IO.File]::ReadAllText((Resolve-Path $Path))
}

function Write-Text([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText((Resolve-Path $Path), $Content, $utf8)
}

# Remove failed/unapplied programme-stage cleanup migrations.
$obsolete = @(
    "supabase\migrations\20260817234000_adaptive_programme_stages_unit_binding.sql",
    "supabase\migrations\20260817235000_department_aware_programme_stages_unit_binding.sql",
    "supabase\migrations\20260817235500_programme_stages_stage_number_compatibility.sql",
    "supabase\migrations\20260818000500_remove_stage_number_and_standardize_programme_stages.sql"
)

foreach ($file in $obsolete) {
    if (Test-Path $file) {
        Remove-Item -LiteralPath $file -Force
        Write-Host "Removed obsolete migration: $file" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Updating student registration queries to sequence_number..." -ForegroundColor Cyan

$queryFile = "src\features\student-unit-registration\queries.ts"
$q = Read-Text $queryFile

$replacements = @(
    @(
        "current_stage:programme_stages!students_current_stage_id_fkey(id, name, stage_number)",
        "current_stage:programme_stages!students_current_stage_id_fkey(id, name, code, sequence_number)"
    ),
    @(
        ".select('id, name, stage_number')",
        ".select('id, name, code, sequence_number')"
    ),
    @(
        ".select('id, programme_id, name, stage_number')",
        ".select('id, programme_id, name, code, sequence_number')"
    ),
    @(
        ".order('stage_number', { ascending: true })",
        ".order('sequence_number', { ascending: true })"
    ),
    @(
        "stageNumber: stage.stage_number",
        "sequenceNumber: stage.sequence_number"
    )
)

foreach ($pair in $replacements) {
    $q = $q.Replace($pair[0], $pair[1])
}

# Repair the two visible mojibake em-dash fallbacks without embedding
# corrupted bytes in this PowerShell script.
$q = [regex]::Replace(
    $q,
    "programmeCode:\s*programme\?\.code\s*\?\?\s*'[^']*'",
    "programmeCode: programme?.code ?? '-'"
)
$q = [regex]::Replace(
    $q,
    "cohortName:\s*cohort\?\.name\s*\?\?\s*'[^']*'",
    "cohortName: cohort?.name ?? '-'"
)

Write-Text $queryFile $q

$typeFile = "src\features\student-unit-registration\types.ts"
$t = Read-Text $typeFile
$t = $t.Replace("stageNumber: number;", "sequenceNumber: number;")
Write-Text $typeFile $t

Write-Host "Student registration now reads canonical sequence_number." -ForegroundColor Green

Write-Host ""
Write-Host "Removing DHNT from curriculum-import stage policy..." -ForegroundColor Cyan

$curriculumFile = "src\features\imports\curriculum\actions.ts"
$c = Read-Text $curriculumFile

$c = [regex]::Replace(
    $c,
    "(?m)^\s*DHNT:\s*4,\s*\r?\n",
    ""
)

$c = $c.Replace(
    "item.programmeCode === 'DHNT' || item.programmeCode === 'DNDT'",
    "item.programmeCode === 'DNDT'"
)

Write-Text $curriculumFile $c

Write-Host "DHNT removed from active curriculum stage policy." -ForegroundColor Green

Write-Host ""
Write-Host "Validating direct programme_stages.stage_number source dependencies..." -ForegroundColor Cyan

$blocking = Get-ChildItem ".\src" -Recurse -File |
    Select-String -Pattern `
        "programme_stages.*stage_number", `
        "\.select\([^`r`n]*stage_number[^`r`n]*\)", `
        "\.order\('stage_number'"

if ($blocking) {
    $blocking |
        Select-Object Path, LineNumber, Line |
        Format-Table -AutoSize
    throw "Direct application dependencies on programme_stages.stage_number remain."
}

Write-Host "No direct application database dependency on stage_number remains." -ForegroundColor Green

$newMigration = "supabase\migrations\20260818002000_canonical_programme_stage_sequence.sql"
if (-not (Test-Path $newMigration)) {
    throw "v12.10.5 migration file is missing."
}

Write-Host ""
Write-Host "v12.10.5 prepared successfully." -ForegroundColor Green
Write-Host "Next: npx supabase db push" -ForegroundColor Yellow
