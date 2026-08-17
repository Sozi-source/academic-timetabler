$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$failed = "supabase\migrations\20260817235000_department_aware_programme_stages_unit_binding.sql"

if (-not (Test-Path $failed)) {
    throw "Could not find the v12.10.2 migration to repair: $failed"
}

$source = Get-Content -LiteralPath $failed -Raw

# Remove the failed migration before generating its corrected replacement.
Remove-Item -LiteralPath $failed -Force

# ------------------------------------------------------------
# 1. Existing rows: keep the legacy NOT NULL stage_number in
#    sync with the canonical sequence_number.
# ------------------------------------------------------------

$updateOld = @'
  sequence_number = t.sequence_number,
  year_number = t.year_number,
'@

$updateNew = @'
  stage_number = t.sequence_number,
  sequence_number = t.sequence_number,
  year_number = t.year_number,
'@

if (-not $source.Contains($updateOld)) {
    throw "Could not locate the existing-stage update block."
}

$source = $source.Replace(
    $updateOld,
    $updateNew
)

# ------------------------------------------------------------
# 2. New rows: stage_number is an existing NOT NULL legacy
#    column, so it MUST be populated in the INSERT itself.
# ------------------------------------------------------------

$insertColsOld = @'
  department_id,
  programme_id,
  code,
  name,
  sequence_number,
'@

$insertColsNew = @'
  department_id,
  programme_id,
  stage_number,
  code,
  name,
  sequence_number,
'@

if (-not $source.Contains($insertColsOld)) {
    throw "Could not locate the programme_stages INSERT column list."
}

$source = $source.Replace(
    $insertColsOld,
    $insertColsNew
)

$insertValuesOld = @'
  p.department_id,
  p.id,
  t.code,
  t.name,
  t.sequence_number,
'@

$insertValuesNew = @'
  p.department_id,
  p.id,
  t.sequence_number,
  t.code,
  t.name,
  t.sequence_number,
'@

if (-not $source.Contains($insertValuesOld)) {
    throw "Could not locate the programme_stages INSERT values."
}

$source = $source.Replace(
    $insertValuesOld,
    $insertValuesNew
)

# Update migration heading only.
$source = $source.Replace(
    "v12.10.2 - Programme stages department-aware compatibility fix",
    "v12.10.3 - Programme stages legacy stage_number compatibility fix"
)

$destination = "supabase\migrations\20260817235500_programme_stages_stage_number_compatibility.sql"

$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
    (Join-Path $PWD.Path $destination),
    $source,
    $utf8
)

Write-Host ""
Write-Host "v12.10.3 prepared successfully." -ForegroundColor Green
Write-Host "Removed failed v12.10.2 migration." -ForegroundColor Yellow
Write-Host "New migration: $destination" -ForegroundColor Cyan

Write-Host ""
Write-Host "Verifying stage_number is populated during INSERT..." -ForegroundColor Cyan

Select-String `
    -Path $destination `
    -Pattern "stage_number|insert into public.programme_stages" `
    -Context 1,3
