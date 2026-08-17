$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Write-Text([string]$Path, [string]$Content) {
    $parent = Split-Path -Parent $Path
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    [System.IO.File]::WriteAllText(
        $Path,
        $Content,
        $utf8
    )
}

Write-Host ""
Write-Host "Applying v12.12.0 Batch Student Unit Registration..." -ForegroundColor Cyan

# Find the existing /students/unit-registration route so this patch
# works regardless of the dashboard route-group folder name.
$registrationPages = Get-ChildItem ".\src\app" -Recurse -File -Filter "page.tsx" |
    Where-Object {
        $_.FullName -replace '/', '\' -match
            '\\students\\unit-registration\\page\.tsx$'
    }

if ($registrationPages.Count -ne 1) {
    throw "Expected exactly one students/unit-registration/page.tsx route, found $($registrationPages.Count)."
}

$registrationDir = Split-Path -Parent $registrationPages[0].FullName
$batchDir = Join-Path $registrationDir "batch"
$batchPage = Join-Path $batchDir "page.tsx"

$pageTemplate = Get-Content ".\BATCH-PAGE-v12.12.0.tsx" -Raw

Write-Text `
    -Path $batchPage `
    -Content $pageTemplate

Remove-Item ".\BATCH-PAGE-v12.12.0.tsx" -Force

Write-Host "Batch route created: $batchPage" -ForegroundColor Green

# Make the batch route discoverable from the existing registration page.
$mainPage = $registrationPages[0].FullName
$content = [System.IO.File]::ReadAllText($mainPage)

if ($content -notmatch "/students/unit-registration/batch") {
    if ($content -match "from 'next/link'") {
        # Link already imported.
    }
    elseif ($content -match "from `"next/link`"") {
        # Link already imported.
    }
    else {
        $content = "import Link from 'next/link';" + [Environment]::NewLine + $content
    }

    $returnIndex = $content.IndexOf("return (")

    if ($returnIndex -lt 0) {
        throw "Could not find return block in the Unit Registration page."
    }

    $insertion = @'
      <div className="mb-4 flex justify-end">
        <Link
          href="/students/unit-registration/batch"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Batch registration
        </Link>
      </div>

'@

    $openParen = $content.IndexOf("(", $returnIndex)

    if ($openParen -lt 0) {
        throw "Could not locate registration page return opening."
    }

    $content =
        $content.Substring(0, $openParen + 1) +
        [Environment]::NewLine +
        $insertion +
        $content.Substring($openParen + 1)

    [System.IO.File]::WriteAllText(
        $mainPage,
        $content,
        $utf8
    )

    Write-Host "Added Batch registration link to main registration page." -ForegroundColor Green
}
else {
    Write-Host "Batch registration link already present." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "v12.12.0 source patch applied successfully." -ForegroundColor Green
Write-Host "Database migration included: 20260818004000_batch_student_unit_registration.sql" -ForegroundColor Cyan
