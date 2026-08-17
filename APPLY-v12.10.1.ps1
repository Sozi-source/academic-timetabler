$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$failed = "supabase\migrations\20260817233000_programme_stages_unit_binding_foundation.sql"

if (Test-Path $failed) {
    Remove-Item -LiteralPath $failed -Force
    Write-Host "Removed failed v12.10.0 migration." -ForegroundColor Yellow
}

$newMigration = "supabase\migrations\20260817234000_adaptive_programme_stages_unit_binding.sql"

if (-not (Test-Path $newMigration)) {
    throw "v12.10.1 migration file is missing."
}

Write-Host ""
Write-Host "v12.10.1 prepared." -ForegroundColor Green
Write-Host "The migration adapts the existing programme_stages table instead of assuming a new schema." -ForegroundColor Cyan
