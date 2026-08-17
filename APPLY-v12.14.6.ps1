$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Text([string]$Path) {
    if (-not (Test-Path $Path)) {
        throw "Required file not found: $Path"
    }

    return [System.IO.File]::ReadAllText((Resolve-Path $Path))
}

function Write-Text([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText((Resolve-Path $Path), $Content, $utf8)
}

function Ensure-MoreVerticalImport(
    [string]$Content,
    [string]$Path
) {
    if ($Content -match '\bMoreVertical\b') {
        return $Content
    }

    $lucidePattern = [System.Text.RegularExpressions.Regex]::new(
        "import\s*\{\s*([\s\S]*?)\}\s*from\s*'lucide-react';",
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    $match = $lucidePattern.Match($Content)

    if (-not $match.Success) {
        throw "Could not locate lucide-react import in $Path"
    }

    $full = $match.Value
    $patched = $full -replace "import\s*\{\s*", "import {`n  MoreVertical,`n"

    return (
        $Content.Substring(0, $match.Index) +
        $patched +
        $Content.Substring($match.Index + $match.Length)
    )
}

function Compact-ActionColumn(
    [string]$Path,
    [string]$EntityNameExpression
) {
    $content = Read-Text $Path

    if (
        $content -match
        '<summary[\s\S]*?MoreVertical'
    ) {
        Write-Host "$Path already uses compact actions." -ForegroundColor DarkGray
        return
    }

    $content = Ensure-MoreVerticalImport `
        -Content $content `
        -Path $Path

    # Actions is the final column in the current timetabler listing tables.
    # Capture the complete final column object without depending on its
    # internal button/form markup.
    $actionsPattern = [System.Text.RegularExpressions.Regex]::new(
        "(?s)\{\s*id:\s*'actions'\s*,[\s\S]*?\n\s*\},(?=\s*\n\];)",
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    $match = $actionsPattern.Match($content)

    if (-not $match.Success) {
        throw "Could not isolate the final Actions column in $Path"
    }

    $block = $match.Value

    # Find the existing outer action container. Its exact classes may have
    # changed in earlier UI patches, so no exact class string is assumed.
    $openingDivPattern =
        [System.Text.RegularExpressions.Regex]::new(
            '<div\s+className="[^"]*"[^>]*>',
            [System.Text.RegularExpressions.RegexOptions]::Singleline
        )

    $opening = $openingDivPattern.Match($block)

    if (-not $opening.Success) {
        throw "Could not locate the Actions container in $Path"
    }

    $lastClosingDiv = $block.LastIndexOf('</div>')

    if ($lastClosingDiv -lt 0 -or $lastClosingDiv -le $opening.Index) {
        throw "Could not locate the end of the Actions container in $Path"
    }

    $menuOpen = @"
<details className="relative">
          <summary
            className="inline-flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-border-strong bg-surface text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
            aria-label={`Actions for $EntityNameExpression`}
          >
            <MoreVertical
              className="size-4"
              aria-hidden="true"
            />
          </summary>

          <div className="absolute right-0 z-40 mt-1 min-w-[210px] rounded-xl border border-border bg-surface p-2 shadow-xl [&_a]:w-full [&_a]:justify-start [&_button]:w-full [&_button]:justify-start [&_form]:w-full [&_select]:w-full">
"@

    $menuClose = @'
          </div>
        </details>
'@

    $beforeOuter =
        $block.Substring(0, $opening.Index)

    $inner =
        $block.Substring(
            $opening.Index + $opening.Length,
            $lastClosingDiv -
                ($opening.Index + $opening.Length)
        )

    $afterOuter =
        $block.Substring(
            $lastClosingDiv + '</div>'.Length
        )

    $patchedBlock =
        $beforeOuter +
        $menuOpen +
        $inner +
        $menuClose +
        $afterOuter

    $content =
        $content.Substring(0, $match.Index) +
        $patchedBlock +
        $content.Substring($match.Index + $match.Length)

    Write-Text $Path $content
    Write-Host "Compacted Actions: $Path" -ForegroundColor Green
}

Write-Host ""
Write-Host "Applying v12.14.6 Adaptive Compact Actions Repair..." -ForegroundColor Cyan

$unitTable =
    "src\features\units\unit-table.tsx"

$cohortTable =
    "src\features\cohorts\cohort-table.tsx"

Compact-ActionColumn `
    -Path $unitTable `
    -EntityNameExpression '${row.original.name}'

Compact-ActionColumn `
    -Path $cohortTable `
    -EntityNameExpression '${row.original.name}'

$programmeTable =
    Get-ChildItem `
        ".\src\features\programmes" `
        -File `
        -Filter "*table*.tsx" `
        -ErrorAction SilentlyContinue |
    Select-Object -First 1

if ($programmeTable) {
    try {
        Compact-ActionColumn `
            -Path $programmeTable.FullName `
            -EntityNameExpression '${row.original.name}'
    }
    catch {
        Write-Warning "Programmes table skipped safely: $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host "v12.14.6 applied successfully." -ForegroundColor Green
Write-Host "Existing action forms and links were preserved inside the overflow menus." -ForegroundColor Cyan
Write-Host "No database or business logic was changed." -ForegroundColor Cyan
