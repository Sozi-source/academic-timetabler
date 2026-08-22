#requires -Version 5.1
[CmdletBinding()]
param(
    [switch]$SkipFullTests,
    [switch]$SkipBuild,
    [switch]$SkipSupabaseDryRun
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$ScriptDirectory = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($ScriptDirectory)) {
    $ScriptDirectory = (Get-Location).Path
}

$ProjectRoot = Split-Path -Parent $ScriptDirectory

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'package.json'))) {
    if (Test-Path -LiteralPath (Join-Path (Get-Location).Path 'package.json')) {
        $ProjectRoot = (Get-Location).Path
    }
    else {
        throw "Could not locate the Academic Planner project root."
    }
}

Set-Location $ProjectRoot

$script:Failures = New-Object System.Collections.Generic.List[string]
$script:Warnings = New-Object System.Collections.Generic.List[string]
$script:PassCount = 0

function Write-Section {
    param([Parameter(Mandatory)][string]$Title)
    Write-Host ""
    Write-Host ("=" * 68) -ForegroundColor DarkGray
    Write-Host (" " + $Title) -ForegroundColor Cyan
    Write-Host ("=" * 68) -ForegroundColor DarkGray
}

function Add-Pass {
    param([Parameter(Mandatory)][string]$Message)
    $script:PassCount += 1
    Write-Host ("PASS  " + $Message) -ForegroundColor Green
}

function Add-Warning {
    param([Parameter(Mandatory)][string]$Message)
    $script:Warnings.Add($Message)
    Write-Host ("WARN  " + $Message) -ForegroundColor Yellow
}

function Add-Failure {
    param([Parameter(Mandatory)][string]$Message)
    $script:Failures.Add($Message)
    Write-Host ("FAIL  " + $Message) -ForegroundColor Red
}

function Assert-PathExists {
    param([Parameter(Mandatory)][string]$RelativePath)

    if (Test-Path -LiteralPath $RelativePath) {
        Add-Pass $RelativePath
        return
    }

    Add-Failure ("Missing required file: " + $RelativePath)
}

function Assert-FileContains {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)][string[]]$Patterns,
        [string]$Description = ''
    )

    if (-not (Test-Path -LiteralPath $RelativePath)) {
        Add-Failure ("Cannot inspect missing file: " + $RelativePath)
        return
    }

    $Content = Get-Content -LiteralPath $RelativePath -Raw

    foreach ($Pattern in $Patterns) {
        if ($Content.IndexOf($Pattern, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
            Add-Failure ("Missing invariant '$Pattern' in $RelativePath")
            return
        }
    }

    if ([string]::IsNullOrWhiteSpace($Description)) {
        Add-Pass ("Architectural invariant: " + $RelativePath)
    }
    else {
        Add-Pass $Description
    }
}

function Assert-FileDoesNotContain {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)][string[]]$Patterns,
        [string]$Description = ''
    )

    if (-not (Test-Path -LiteralPath $RelativePath)) {
        Add-Failure ("Cannot inspect missing file: " + $RelativePath)
        return
    }

    $Content = Get-Content -LiteralPath $RelativePath -Raw

    foreach ($Pattern in $Patterns) {
        if ($Content.IndexOf($Pattern, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            Add-Failure ("Forbidden value '$Pattern' found in $RelativePath")
            return
        }
    }

    if ([string]::IsNullOrWhiteSpace($Description)) {
        Add-Pass ("Forbidden-pattern check: " + $RelativePath)
    }
    else {
        Add-Pass $Description
    }
}

function Invoke-NativeCheck {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][scriptblock]$Command
    )

    Write-Host ""
    Write-Host ("Running: " + $Name) -ForegroundColor Cyan

    $PreviousErrorActionPreference = $ErrorActionPreference

    try {
        # Prevent harmless native STDERR progress from becoming
        # NativeCommandError under Windows PowerShell 5.1.
        $ErrorActionPreference = 'Continue'
        & $Command
        $ExitCode = $LASTEXITCODE
    }
    catch {
        $ExitCode = 1
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
    finally {
        $ErrorActionPreference = $PreviousErrorActionPreference
    }

    if ($null -eq $ExitCode) {
        $ExitCode = 0
    }

    if ($ExitCode -eq 0) {
        Add-Pass $Name
    }
    else {
        Add-Failure ("$Name exited with code $ExitCode")
    }
}

function Get-NpxCommand {
    if (Get-Command npx.cmd -ErrorAction SilentlyContinue) {
        return 'npx.cmd'
    }

    if (Get-Command npx -ErrorAction SilentlyContinue) {
        return 'npx'
    }

    return $null
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " ACADEMIC PLANNER - RELEASE CANDIDATE V20 VERIFICATION" -ForegroundColor Cyan
Write-Host " READ ONLY - NO DATABASE WRITES - NO GIT WRITES" -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host ("Project: " + $ProjectRoot) -ForegroundColor Gray
Write-Host ("Started: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) -ForegroundColor Gray

$Npx = Get-NpxCommand
if ($null -eq $Npx) {
    throw "npx was not found on PATH."
}

Write-Section "1. CORE RELEASE STRUCTURE"

$RequiredFiles = @(
    'package.json',
    'tsconfig.json',
    'src\proxy.ts',
    'src\lib\supabase\proxy.ts',
    'src\features\auth\actions.ts',
    'src\features\auth\routing.ts',
    'src\features\assessment\marks\workbook.ts',
    'src\features\assessment\marks\actions.ts',
    'src\features\staff-assessment\workflow-domain.ts',
    'src\features\teaching-documents\storage.ts',
    'src\features\teaching-documents\domain.ts',
    'src\features\student-portal\domain.ts',
    'src\features\student-access\domain.ts',
    'supabase\migrations\20260821202000_teaching_document_template_ingestion_v15.sql',
    'supabase\migrations\20260821211500_teaching_document_workflow_v16.sql',
    'supabase\migrations\20260821214500_student_portal_access_admin_v17.sql',
    'supabase\migrations\20260821223000_online_marks_entry_v18_2.sql',
    'supabase\migrations\20260821230000_class_attendance_v19.sql'
)

foreach ($RequiredFile in $RequiredFiles) {
    Assert-PathExists $RequiredFile
}

Write-Section "2. ARCHITECTURE INVARIANTS"

Assert-FileContains `
    -RelativePath 'src\features\assessment\marks\workbook.ts' `
    -Patterns @(
        'Assignments /5',
        'Presentations / Practicals /10',
        'RAT /15',
        'CAT 1 /15',
        'End Term Exam /70',
        'Total /100'
    ) `
    -Description 'Existing institutional Excel mark sheet remains intact'

if (Test-Path -LiteralPath 'src\features\staff-assessment\online-marks-domain.ts') {
    Assert-FileContains `
        -RelativePath 'src\features\staff-assessment\online-marks-domain.ts' `
        -Patterns @(
            "'assignment'",
            "'presentation'",
            "'rat'",
            "'cat'",
            "'exam'",
            'calculateRatCatAverage'
        ) `
        -Description 'Online marks mirrors Assignment, Presentation, RAT, CAT and Exam'
}
else {
    Add-Warning 'Online marks domain is not present; V18.2 may not yet be merged.'
}

if (Test-Path -LiteralPath 'src\features\class-attendance\domain.ts') {
    Assert-FileContains `
        -RelativePath 'src\features\class-attendance\domain.ts' `
        -Patterns @("'present'", "'absent'") `
        -Description 'Class attendance includes Present / Absent'

    Assert-FileDoesNotContain `
        -RelativePath 'src\features\class-attendance\domain.ts' `
        -Patterns @("'late'", "'excused'") `
        -Description 'Class attendance is limited to Present / Absent'
}
else {
    Add-Warning 'Class attendance domain is not present; V19.1 may not yet be merged.'
}

Assert-FileContains `
    -RelativePath 'supabase\migrations\20260821202000_teaching_document_template_ingestion_v15.sql' `
    -Patterns @('teaching-documents-private') `
    -Description 'Teaching documents use controlled private storage'

Assert-FileContains `
    -RelativePath 'supabase\migrations\20260821211500_teaching_document_workflow_v16.sql' `
    -Patterns @(
        'teaching_document_revisions',
        'teaching_document_submissions',
        'teaching_document_reviews'
    ) `
    -Description 'Teaching document revision/submission/review audit chain exists'

Assert-FileContains `
    -RelativePath 'supabase\migrations\20260821214500_student_portal_access_admin_v17.sql' `
    -Patterns @(
        'student_portal_access_events',
        'set_student_portal_pin',
        'set_student_portal_access_state'
    ) `
    -Description 'Student portal access administration is guarded and auditable'

Write-Section "3. SOURCE HYGIENE"

$MergeMarkerMatches = @()

foreach ($SearchRoot in @('src', 'supabase', 'scripts')) {
    if (-not (Test-Path -LiteralPath $SearchRoot)) {
        continue
    }

    $CandidateFiles =
        Get-ChildItem `
            -LiteralPath $SearchRoot `
            -Recurse `
            -File `
            -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Extension -in @(
                '.ts', '.tsx', '.js', '.jsx',
                '.sql', '.ps1', '.json', '.css', '.md'
            )
        }

    foreach ($CandidateFile in $CandidateFiles) {
        $Matches =
            Select-String `
                -LiteralPath $CandidateFile.FullName `
                -Pattern '^(<<<<<<<|=======|>>>>>>>)' `
                -ErrorAction SilentlyContinue

        if ($Matches) {
            $MergeMarkerMatches += $Matches
        }
    }
}

if ($MergeMarkerMatches.Count -eq 0) {
    Add-Pass 'No unresolved Git merge markers'
}
else {
    Add-Failure ("Unresolved Git merge markers found: " + $MergeMarkerMatches.Count)
}

$BackupFiles = @()

foreach ($SearchRoot in @('src', 'supabase')) {
    if (-not (Test-Path -LiteralPath $SearchRoot)) {
        continue
    }

    $BackupFiles +=
        Get-ChildItem `
            -LiteralPath $SearchRoot `
            -Recurse `
            -File `
            -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -match '\.(bak|backup|orig|rej|tmp)$' -or
            $_.Name -match '~$'
        }
}

if ($BackupFiles.Count -eq 0) {
    Add-Pass 'No .bak/.backup/.orig/.rej/.tmp source artifacts'
}
else {
    Add-Warning ("Backup/temp source artifacts found: " + $BackupFiles.Count)
}

Write-Section "4. GIT INTEGRITY"

Invoke-NativeCheck `
    -Name 'git diff --check' `
    -Command {
        & git diff --check
    }

try {
    $Branch = (& git branch --show-current).Trim()
}
catch {
    $Branch = ''
}

if ([string]::IsNullOrWhiteSpace($Branch)) {
    Add-Warning 'Could not determine current Git branch.'
}
else {
    Add-Pass ("Git branch: " + $Branch)
}

$Porcelain = @(& git status --porcelain)

if ($Porcelain.Count -eq 0) {
    Add-Pass 'Git working tree is clean'
}
else {
    Add-Warning ("Git working tree has " + $Porcelain.Count + " uncommitted item(s).")
}

Write-Section "5. FOCUSED RELEASE REGRESSION"

$FocusedTests = @(
    'src/tests/auth-role-routing.test.ts',
    'src/tests/student-portal-domain.test.ts',
    'src/tests/student-access-domain.test.ts',
    'src/tests/trainer-assessment-workflow.test.ts',
    'src/tests/online-marks-domain.test.ts',
    'src/tests/class-attendance-domain.test.ts',
    'src/tests/assessment-markbook-commit.test.ts',
    'src/tests/assessment-analysis-engine.test.ts',
    'src/tests/teaching-document-workflow.test.ts',
    'src/tests/teaching-document-template-policy.test.ts',
    'src/tests/teaching-documents-domain.test.ts'
)

$ExistingFocusedTests =
    @(
        $FocusedTests |
        Where-Object {
            Test-Path -LiteralPath $_
        }
    )

if ($ExistingFocusedTests.Count -eq 0) {
    Add-Failure 'No focused release-regression tests were found.'
}
else {
    $TestArguments = @('vitest', 'run') + $ExistingFocusedTests

    Invoke-NativeCheck `
        -Name ("Focused release tests (" + $ExistingFocusedTests.Count + " files)") `
        -Command {
            & $Npx @TestArguments
        }
}

Write-Section "6. FULL TEST SUITE"

if ($SkipFullTests) {
    Add-Warning 'Full Vitest suite skipped by -SkipFullTests.'
}
else {
    Invoke-NativeCheck `
        -Name 'Full Vitest suite' `
        -Command {
            & $Npx vitest run
        }
}

Write-Section "7. TYPESCRIPT"

Invoke-NativeCheck `
    -Name 'npm run typecheck' `
    -Command {
        & npm run typecheck
    }

Write-Section "8. LINT"

$PackageJson =
    Get-Content `
        -LiteralPath 'package.json' `
        -Raw |
    ConvertFrom-Json

$HasLint =
    $null -ne $PackageJson.scripts -and
    $null -ne $PackageJson.scripts.PSObject.Properties['lint']

if ($HasLint) {
    Invoke-NativeCheck `
        -Name 'npm run lint' `
        -Command {
            & npm run lint
        }
}
else {
    Add-Warning 'No lint script is configured in package.json.'
}

Write-Section "9. PRODUCTION BUILD"

if ($SkipBuild) {
    Add-Warning 'Production build skipped by -SkipBuild.'
}
else {
    Invoke-NativeCheck `
        -Name 'npm run build' `
        -Command {
            & npm run build
        }
}

Write-Section "10. SUPABASE MIGRATION SAFETY"

if ($SkipSupabaseDryRun) {
    Add-Warning 'Supabase dry-run skipped by -SkipSupabaseDryRun.'
}
else {
    Invoke-NativeCheck `
        -Name 'Supabase db push --dry-run' `
        -Command {
            & $Npx supabase db push --dry-run
        }
}

Write-Section "11. RELEASE-CANDIDATE VERDICT"

Write-Host ("Passes:   " + $script:PassCount) -ForegroundColor Green
Write-Host ("Warnings: " + $script:Warnings.Count) -ForegroundColor Yellow

if ($script:Failures.Count -eq 0) {
    Write-Host ("Failures: " + $script:Failures.Count) -ForegroundColor Green
}
else {
    Write-Host ("Failures: " + $script:Failures.Count) -ForegroundColor Red
}

if ($script:Warnings.Count -gt 0) {
    Write-Host ""
    Write-Host "Warnings:" -ForegroundColor Yellow

    foreach ($WarningMessage in $script:Warnings) {
        Write-Host ("  - " + $WarningMessage) -ForegroundColor Yellow
    }
}

if ($script:Failures.Count -gt 0) {
    Write-Host ""
    Write-Host "Blocking failures:" -ForegroundColor Red

    foreach ($FailureMessage in $script:Failures) {
        Write-Host ("  - " + $FailureMessage) -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "RELEASE CANDIDATE V20: NOT READY" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "RELEASE CANDIDATE V20: VERIFIED" -ForegroundColor Green

if ($script:Warnings.Count -gt 0) {
    Write-Host "Review warnings before production deployment." -ForegroundColor Yellow
}
else {
    Write-Host "No blocking issues or warnings were detected." -ForegroundColor Green
}

Write-Host ""
Write-Host "No migrations were pushed and no Git/app data was modified." -ForegroundColor Gray
Write-Host ("Completed: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) -ForegroundColor Gray
