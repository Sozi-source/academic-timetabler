$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Write-Text([string]$Path, [string]$Content) {
    $parent = Split-Path -Parent $Path

    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

Write-Host ""
Write-Host "Applying v12.13.0 Controlled Student Stage Progression..." -ForegroundColor Cyan

$routeGroup = Get-ChildItem ".\src\app" -Directory |
    Where-Object {
        Test-Path (Join-Path $_.FullName "students")
    } |
    Select-Object -First 1

if (-not $routeGroup) {
    throw "Could not locate the dashboard route group containing students."
}

$routeDir = Join-Path $routeGroup.FullName "students\lifecycle-progression"
$pagePath = Join-Path $routeDir "page.tsx"

$pageTemplate = Get-Content ".\LIFECYCLE-PROGRESSION-PAGE.tsx" -Raw

Write-Text -Path $pagePath -Content $pageTemplate
Remove-Item ".\LIFECYCLE-PROGRESSION-PAGE.tsx" -Force

Write-Host "Created route: /students/lifecycle-progression" -ForegroundColor Green

$navMatches = Get-ChildItem ".\src" -Recurse -File |
    Where-Object { $_.Extension -in ".ts", ".tsx" } |
    Select-String -Pattern "Lifecycle & progression"

$navFiles = $navMatches | Select-Object -ExpandProperty Path -Unique

if ($navFiles.Count -eq 1) {
    $navPath = $navFiles[0]
    $nav = [System.IO.File]::ReadAllText($navPath)

    $objectPattern = "(?s)(\{[^{}]*?(?:label|title|name)\s*:\s*['""]Lifecycle & progression['""][^{}]*?\})"
    $match = [regex]::Match($nav, $objectPattern)

    if ($match.Success) {
        $object = $match.Groups[1].Value

        if ($object -match "href\s*:\s*['""][^'""]+['""]") {
            $updatedObject = [regex]::Replace(
                $object,
                "href\s*:\s*['""][^'""]+['""]",
                "href: '/students/lifecycle-progression'",
                1
            )

            $nav = $nav.Substring(0, $match.Index) +
                $updatedObject +
                $nav.Substring($match.Index + $match.Length)

            [System.IO.File]::WriteAllText($navPath, $nav, $utf8)
            Write-Host "Updated Lifecycle & progression navigation." -ForegroundColor Green
        }
        else {
            Write-Warning "Lifecycle navigation object found but no href was found."
        }
    }
    else {
        Write-Warning "Lifecycle navigation label found but object could not be patched safely."
    }
}
else {
    Write-Warning "Lifecycle navigation was not changed automatically. Route still works directly."
}

Write-Host ""
Write-Host "v12.13.0 source patch applied successfully." -ForegroundColor Green
Write-Host "Migration included: 20260818005500_controlled_student_stage_progression.sql" -ForegroundColor Cyan
