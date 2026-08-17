$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Remove failed/unapplied programme-stage migrations so Supabase does not retry them.
$failedMigrations = @(
    "supabase\migrations\20260817234000_adaptive_programme_stages_unit_binding.sql",
    "supabase\migrations\20260817235000_department_aware_programme_stages_unit_binding.sql",
    "supabase\migrations\20260817235500_programme_stages_stage_number_compatibility.sql"
)

foreach ($migration in $failedMigrations) {
    if (Test-Path $migration) {
        Remove-Item -LiteralPath $migration -Force
        Write-Host "Removed: $migration" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Checking application source for legacy stage_number references..." -ForegroundColor Cyan

$sourceMatches = Get-ChildItem ".\src" -Recurse -File |
    Select-String -Pattern "stage_number|stageNumber"

if ($sourceMatches) {
    Write-Host ""
    Write-Warning "Application source still references stage_number/stageNumber."
    $sourceMatches |
        Select-Object Path, LineNumber, Line |
        Format-Table -AutoSize

    throw "Remove/update the application references above before pushing the database column removal."
}

Write-Host "No application source references found." -ForegroundColor Green

$newMigration = "supabase\migrations\20260818000500_remove_stage_number_and_standardize_programme_stages.sql"

if (-not (Test-Path $newMigration)) {
    throw "v12.10.4 migration file is missing."
}

Write-Host ""
Write-Host "v12.10.4 prepared successfully." -ForegroundColor Green
Write-Host "Legacy stage_number will be migrated into sequence_number and removed." -ForegroundColor Cyan
