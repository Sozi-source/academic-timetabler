$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$file = "supabase\migrations\20260818002000_canonical_programme_stage_sequence.sql"

if (-not (Test-Path $file)) {
    throw "Could not find $file"
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText((Resolve-Path $file))

$old = @'
    where n.nspname = 'public'
      and pg_get_functiondef(p.oid) ~ '\mstage_number\M'
'@

$new = @'
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~ '\mstage_number\M'
'@

if (-not $content.Contains($old)) {
    throw "Expected pg_proc function scan block was not found. No file was changed."
}

$content = $content.Replace($old, $new)

[System.IO.File]::WriteAllText(
    (Resolve-Path $file),
    $content,
    $utf8
)

Write-Host ""
Write-Host "v12.10.6 applied successfully." -ForegroundColor Green
Write-Host "The migration now scans only ordinary PostgreSQL functions." -ForegroundColor Cyan

Write-Host ""
Write-Host "Verifying patched function scan..." -ForegroundColor Cyan

Select-String `
    -Path $file `
    -Pattern "prokind|pg_get_functiondef" `
    -Context 1,1
