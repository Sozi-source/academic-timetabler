$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$file = "supabase\migrations\20260818005500_controlled_student_stage_progression.sql"

if (-not (Test-Path $file)) {
    throw "Could not find $file"
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText((Resolve-Path $file))

Write-Host ""
Write-Host "Applying v12.13.1 department helper compatibility fix..." -ForegroundColor Cyan

$oldPolicy = @'
using (department_id = public.current_department_id());
'@

$newPolicy = @'
using (
  department_id = (select public.current_user_primary_department_id())
  and (
    select public.current_user_can_manage_department(department_id)
  )
);
'@

if (-not $content.Contains($oldPolicy)) {
    throw "Expected current_department_id() policy reference was not found. No file was changed."
}

$content = $content.Replace($oldPolicy, $newPolicy)

$oldAssignment = @'
  actor_department_id := public.current_department_id();
'@

$newAssignment = @'
  actor_department_id := public.current_user_primary_department_id();
'@

if (-not $content.Contains($oldAssignment)) {
    throw "Expected actor current_department_id() reference was not found. No file was changed."
}

$content = $content.Replace($oldAssignment, $newAssignment)

[System.IO.File]::WriteAllText(
    (Resolve-Path $file),
    $content,
    $utf8
)

Write-Host "Replaced unsupported current_department_id()." -ForegroundColor Green
Write-Host "Using existing current_user_primary_department_id() helper." -ForegroundColor Green
Write-Host "Added current_user_can_manage_department() check to the audit RLS policy." -ForegroundColor Green

Write-Host ""
Write-Host "Verification:" -ForegroundColor Cyan

$remaining = Select-String `
    -Path $file `
    -Pattern "current_department_id"

if ($remaining) {
    $remaining | Format-Table -AutoSize
    throw "Unsupported current_department_id references remain."
}

Select-String `
    -Path $file `
    -Pattern "current_user_primary_department_id|current_user_can_manage_department" `
    -Context 1,1

Write-Host ""
Write-Host "v12.13.1 prepared successfully." -ForegroundColor Green
Write-Host "Retry npx supabase db push." -ForegroundColor Yellow
