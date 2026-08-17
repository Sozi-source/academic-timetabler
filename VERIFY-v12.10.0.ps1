Write-Host "`n=== Programme stages ===" -ForegroundColor Cyan

$npx = Get-Command npx -ErrorAction Stop

Write-Host "Migration file:" -ForegroundColor DarkCyan
Get-Item ".\supabase\migrations\20260817233000_programme_stages_unit_binding_foundation.sql" |
    Select-Object FullName, Length, LastWriteTime

Write-Host "`nExpected stage counts:" -ForegroundColor Cyan
Write-Host "CHN  = 6"
Write-Host "CND  = 6"
Write-Host "DHN  = 9"
Write-Host "DND  = 9"
Write-Host "DNDT = 4"
Write-Host "DHNT = excluded"

Write-Host "`nPush the migration with:" -ForegroundColor Yellow
Write-Host "npx supabase db push"
