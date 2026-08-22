$ErrorActionPreference = 'Stop'

$ProjectRoot =
    Split-Path `
        -Parent `
        $PSScriptRoot

Set-Location $ProjectRoot

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " ACADEMIC PLANNER RELEASE CANDIDATE VERIFICATION" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

function Invoke-CheckedNative {
    param(
        [Parameter(Mandatory)]
        [scriptblock]$Command,

        [Parameter(Mandatory)]
        [string]$FailureMessage
    )

    $previous =
        $ErrorActionPreference

    try {
        $ErrorActionPreference =
            'Continue'

        & $Command

        $exitCode =
            $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference =
            $previous
    }

    if ($exitCode -ne 0) {
        throw $FailureMessage
    }
}

function Get-NativeText {
    param(
        [Parameter(Mandatory)]
        [scriptblock]$Command
    )

    $previous =
        $ErrorActionPreference

    try {
        $ErrorActionPreference =
            'Continue'

        $output =
            & $Command

        if ($LASTEXITCODE -ne 0) {
            return $null
        }

        return (
            $output |
            Out-String
        ).Trim()
    }
    finally {
        $ErrorActionPreference =
            $previous
    }
}

$commit =
    Get-NativeText {
        & git rev-parse --short HEAD
    }

$branch =
    Get-NativeText {
        & git branch --show-current
    }

$workingTree =
    Get-NativeText {
        & git status --porcelain
    }

$workingTreeClean =
    [string]::IsNullOrWhiteSpace(
        $workingTree
    )

$checks =
    [ordered]@{}

Write-Host "1/7 Critical workflow contract..." -ForegroundColor Cyan
Invoke-CheckedNative `
    -Command { & node scripts/verify-critical-workflows.mjs } `
    -FailureMessage "Critical workflow verification failed."
$checks.criticalWorkflowContract = 'pass'
Write-Host "PASS critical workflow contract" -ForegroundColor Green
Write-Host ""

Write-Host "2/7 Full Vitest suite..." -ForegroundColor Cyan
Invoke-CheckedNative `
    -Command { & npx.cmd vitest run } `
    -FailureMessage "Full Vitest suite failed."
$checks.vitest = 'pass'
Write-Host "PASS tests" -ForegroundColor Green
Write-Host ""

Write-Host "3/7 TypeScript..." -ForegroundColor Cyan
Invoke-CheckedNative `
    -Command { & npm.cmd run typecheck } `
    -FailureMessage "TypeScript validation failed."
$checks.typecheck = 'pass'
Write-Host "PASS TypeScript" -ForegroundColor Green
Write-Host ""

Write-Host "4/7 ESLint..." -ForegroundColor Cyan
Invoke-CheckedNative `
    -Command { & npm.cmd run lint } `
    -FailureMessage "ESLint validation failed."
$checks.lint = 'pass'
Write-Host "PASS lint" -ForegroundColor Green
Write-Host ""

Write-Host "5/7 Production build..." -ForegroundColor Cyan
Invoke-CheckedNative `
    -Command { & npm.cmd run build } `
    -FailureMessage "Production build failed."
$checks.productionBuild = 'pass'
Write-Host "PASS production build" -ForegroundColor Green
Write-Host ""

Write-Host "6/7 Git diff whitespace check..." -ForegroundColor Cyan
Invoke-CheckedNative `
    -Command { & git diff --check } `
    -FailureMessage "git diff --check failed."
$checks.gitDiffCheck = 'pass'
Write-Host "PASS diff check" -ForegroundColor Green
Write-Host ""

Write-Host "7/7 Supabase migration dry-run..." -ForegroundColor Cyan
Invoke-CheckedNative `
    -Command { & npx.cmd supabase db push --dry-run } `
    -FailureMessage "Supabase migration dry-run failed."
$checks.supabaseDryRun = 'pass'
Write-Host "PASS Supabase dry-run" -ForegroundColor Green
Write-Host ""

$timestamp =
    Get-Date `
        -Format "yyyyMMddHHmmss"

$commitLabel =
    if ([string]::IsNullOrWhiteSpace($commit)) {
        'unknown'
    }
    else {
        $commit
    }

$verificationId =
    "RC-$timestamp-$commitLabel"

$report =
    [ordered]@{
        verificationId = $verificationId
        generatedAt = (Get-Date).ToString('o')
        project = 'Academic Planner'
        commit = $commit
        branch = $branch
        workingTreeClean = $workingTreeClean
        checks = $checks
        result = 'passed'
    }

$downloads =
    Join-Path `
        ([Environment]::GetFolderPath('UserProfile')) `
        'Downloads'

$reportPath =
    Join-Path `
        $downloads `
        "Academic_Planner_Release_Verification_$verificationId.json"

$utf8 =
    New-Object `
        System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    $reportPath,
    ($report | ConvertTo-Json -Depth 8),
    $utf8
)

Write-Host "============================================================" -ForegroundColor Green
Write-Host " RELEASE CANDIDATE LOCAL VERIFICATION PASSED" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Verification ID:" -ForegroundColor Yellow
Write-Host "  $verificationId" -ForegroundColor Cyan
Write-Host ""
Write-Host "Verification report:" -ForegroundColor Yellow
Write-Host "  $reportPath" -ForegroundColor Cyan
Write-Host ""

if (-not $workingTreeClean) {
    Write-Host "WARNING: Git working tree contains uncommitted changes." -ForegroundColor Yellow
    Write-Host "Commit the intended release state and rerun verification before final production sign-off." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Next: complete UAT and sign-off, record Pilot deployment evidence, test the pilot, then record Production deployment when approved." -ForegroundColor Yellow
