$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$failed = "supabase\migrations\20260817234000_adaptive_programme_stages_unit_binding.sql"
if (Test-Path $failed) {
    Remove-Item -LiteralPath $failed -Force
    Write-Host "Removed failed v12.10.1 migration." -ForegroundColor Yellow
}

$new = "supabase\migrations\20260817235000_department_aware_programme_stages_unit_binding.sql"
if (-not (Test-Path $new)) {
    throw "v12.10.2 migration file is missing."
}

Write-Host ""
Write-Host "v12.10.2 prepared successfully." -ForegroundColor Green
Write-Host "Programme stages will inherit department_id from programmes." -ForegroundColor Cyan
