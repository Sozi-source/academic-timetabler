$ErrorActionPreference = "Stop"
Set-Location "C:\Users\sozi\Desktop\academic-timetabler"

Write-Host ""
Write-Host "Preparing v12.15.1 Stage Unit Binding Backfill..." -ForegroundColor Cyan

# Remove the failed v12.15.0 generated migration if a previous manual attempt
# happened to create it. The parser failure normally means it was never created.
$failedMigration = "supabase\migrations\20260817114500_programme_stage_unit_binding.sql"

if (Test-Path -LiteralPath $failedMigration) {
    Remove-Item -LiteralPath $failedMigration -Force
    Write-Host "Removed failed v12.15.0 migration." -ForegroundColor Yellow
}

$migration =
    "supabase\migrations\20260818011500_backfill_programme_stage_unit_bindings.sql"

if (-not (Test-Path -LiteralPath $migration)) {
    throw "v12.15.1 migration was not extracted: $migration"
}

Write-Host "Using the existing programme_stage_units table." -ForegroundColor Green
Write-Host "Binding contract: stage_id + unit_id." -ForegroundColor Gray
Write-Host "Backfill rule: unit academic_period_number = stage sequence_number." -ForegroundColor Gray

# Best-effort compatibility check for stale application references.
$sourceRoot = "src\features\student-unit-registration"

if (Test-Path -LiteralPath $sourceRoot) {
    $legacy = @(
        Get-ChildItem $sourceRoot -Recurse -File -Include "*.ts","*.tsx" |
            Select-String -Pattern "stage_number" -SimpleMatch
    )

    if ($legacy.Count -gt 0) {
        Write-Warning "Legacy stage_number references still exist in student-unit-registration."
        $legacy |
            Select-Object Path, LineNumber, Line |
            Format-Table -AutoSize
        Write-Host ""
        Write-Host "Do not delete sequence_number. The binding migration can still be pushed, but the source references above should be repaired next." -ForegroundColor Yellow
    }
    else {
        Write-Host "No legacy stage_number references found in student-unit-registration." -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "v12.15.1 prepared successfully." -ForegroundColor Green
Write-Host "Next run: npx supabase db push" -ForegroundColor Cyan
