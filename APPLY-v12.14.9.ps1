$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Text([string]$Path) {
    return [System.IO.File]::ReadAllText(
        (Resolve-Path -LiteralPath $Path).Path
    )
}

function Write-Text([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText(
        (Resolve-Path -LiteralPath $Path).Path,
        $Content,
        $utf8
    )
}

Write-Host ""
Write-Host "Applying v12.14.9 Academic Periods Workspace Repair..." -ForegroundColor Cyan

# ============================================================
# Locate the current Academic Period listing component from its
# actual UI text instead of assuming one historical filename.
# ============================================================

$matches = @(
    Get-ChildItem ".\src\features" -Recurse -File -Filter "*.tsx" |
        Where-Object {
            $text = [System.IO.File]::ReadAllText($_.FullName)
            $text.Contains("Search periods, codes or Academic Years")
        }
)

if ($matches.Count -ne 1) {
    throw "Expected exactly one Academic Period table component, found $($matches.Count)."
}

$file = $matches[0].FullName
$content = [System.IO.File]::ReadAllText($file)

Write-Host "Target: $file" -ForegroundColor DarkGray

# ============================================================
# 1. Add MoreVertical to the existing lucide-react import.
# ============================================================

if ($content -notmatch '\bMoreVertical\b') {
    $lucide = [System.Text.RegularExpressions.Regex]::new(
        "import\s*\{\s*([\s\S]*?)\}\s*from\s*'lucide-react';",
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    $m = $lucide.Match($content)

    if (-not $m.Success) {
        throw "Could not locate lucide-react import in Academic Period table."
    }

    $patchedImport = $m.Value -replace "import\s*\{\s*", "import {`n  MoreVertical,`n"

    $content =
        $content.Substring(0, $m.Index) +
        $patchedImport +
        $content.Substring($m.Index + $m.Length)
}

# ============================================================
# 2. Replace the wide final Actions cell with a compact overflow
#    menu while preserving every existing action control.
# ============================================================

if ($content -notmatch '<summary[\s\S]*?MoreVertical') {
    $actionsRegex = [System.Text.RegularExpressions.Regex]::new(
        "(?s)\{\s*id:\s*'actions'\s*,[\s\S]*?\n\s*\},(?=\s*\n\];)",
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    $actionsMatch = $actionsRegex.Match($content)

    if (-not $actionsMatch.Success) {
        throw "Could not isolate the Academic Period Actions column."
    }

    $block = $actionsMatch.Value

    $returnIndex = $block.IndexOf("return (")

    if ($returnIndex -lt 0) {
        throw "Academic Period Actions cell does not contain the expected return block."
    }

    $openingRegex = [System.Text.RegularExpressions.Regex]::new(
        '<div\s+className="[^"]*"[^>]*>',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    $opening = $openingRegex.Match(
        $block,
        $returnIndex
    )

    if (-not $opening.Success) {
        throw "Could not locate the outer Academic Period action container."
    }

    $lastClosing = $block.LastIndexOf("</div>")

    if ($lastClosing -le $opening.Index) {
        throw "Could not locate the end of the Academic Period action container."
    }

    $before = $block.Substring(
        0,
        $opening.Index
    )

    $inner = $block.Substring(
        $opening.Index + $opening.Length,
        $lastClosing -
            ($opening.Index + $opening.Length)
    )

    $after = $block.Substring(
        $lastClosing + "</div>".Length
    )

    # Single-quoted PowerShell here-string deliberately preserves
    # JavaScript template-literal backticks.
    $menuOpen = @'
<details className="relative">
          <summary
            className="inline-flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-border-strong bg-surface text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
            aria-label={`Actions for ${row.original.name}`}
          >
            <MoreVertical
              className="size-4"
              aria-hidden="true"
            />
          </summary>

          <div className="absolute right-0 z-50 mt-1 min-w-[220px] rounded-xl border border-border bg-surface p-2 shadow-xl [&_a]:w-full [&_a]:justify-start [&_button]:w-full [&_button]:justify-start [&_form]:w-full [&_select]:w-full">
'@

    $menuClose = @'
          </div>
        </details>
'@

    $patchedBlock =
        $before +
        $menuOpen +
        $inner +
        $menuClose +
        $after

    $content =
        $content.Substring(0, $actionsMatch.Index) +
        $patchedBlock +
        $content.Substring(
            $actionsMatch.Index +
            $actionsMatch.Length
        )

    Write-Host "Academic Period actions compacted." -ForegroundColor Green
}
else {
    Write-Host "Academic Period actions already compact." -ForegroundColor DarkGray
}

# ============================================================
# 3. Make the filter toolbar use the available desktop width.
#    Convert the common 2-column filter layout into a 3-column
#    arrangement: search | Academic Year | status.
# ============================================================

$toolbarPatterns = @(
    'lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,2fr\)\]',
    'lg:grid-cols-2',
    'xl:grid-cols-2'
)

foreach ($pattern in $toolbarPatterns) {
    if ($content -match $pattern) {
        $content = [regex]::Replace(
            $content,
            $pattern,
            'lg:grid-cols-[minmax(260px,1fr)_minmax(210px,1fr)_minmax(180px,0.7fr)]',
            1
        )
        break
    }
}

# ============================================================
# 4. Give the first Academic Period column a stable readable
#    width so its text cannot be crushed when the table narrows.
# ============================================================

$content = $content.Replace(
    '<div className="min-w-56">',
    '<div className="w-[220px] min-w-[220px]">'
)

$content = $content.Replace(
    '<div className="min-w-48">',
    '<div className="w-[190px] min-w-[190px]">'
)

# ============================================================
# 5. Ensure no malformed aria-label from the previous overflow
#    patches can survive in this component.
# ============================================================

$content = $content.Replace(
    'aria-label={Actions for ${row.original.name}}',
    'aria-label={`Actions for ${row.original.name}`}'
)

[System.IO.File]::WriteAllText(
    $file,
    $content,
    $utf8
)

Write-Host ""
Write-Host "v12.14.9 applied successfully." -ForegroundColor Green
Write-Host "Academic Periods now uses compact actions and more usable table width." -ForegroundColor Cyan
Write-Host "No database or scheduling logic was changed." -ForegroundColor Cyan
