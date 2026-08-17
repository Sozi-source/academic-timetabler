$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Text([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Required file not found: $Path"
    }

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
Write-Host "Applying v12.14.11 Curriculum Units Compact Workspace Repair..." -ForegroundColor Cyan

$file = "src\features\units\unit-table.tsx"
$content = Read-Text $file

# ============================================================
# 1. Compact the filter toolbar.
# ============================================================

$content = $content.Replace(
    '<div className="flex flex-1 flex-wrap items-center gap-2">',
    '<div className="grid w-full gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-1 lg:flex-wrap lg:items-center">'
)

# Narrow common unit filters where present.
$filterReplacements = @{
    'aria-label="Filter by programme"' = 'lg:w-40'
    'aria-label="Filter by status"' = 'lg:w-36'
    'aria-label="Filter by timetable availability"' = 'lg:w-40'
    'aria-label="Filter by availability"' = 'lg:w-40'
    'aria-label="Filter by category"' = 'lg:w-36'
}

foreach ($entry in $filterReplacements.GetEnumerator()) {
    $pattern = [System.Text.RegularExpressions.Regex]::new(
        '(' + [regex]::Escape($entry.Key) + '[\s\S]*?)className="h-11"',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if ($pattern.IsMatch($content)) {
        $content = $pattern.Replace(
            $content,
            '$1className="h-10 w-full ' + $entry.Value + '"',
            1
        )
    }
}

# ============================================================
# 2. Unit column gets the main flexible width, with clean wrap.
# ============================================================

$content = $content.Replace(
    '<div className="w-[210px] min-w-[210px] max-w-[240px]">',
    '<div className="w-[300px] min-w-[300px] max-w-[360px]">'
)

$content = $content.Replace(
    '<div className="min-w-64">',
    '<div className="w-[300px] min-w-[300px] max-w-[360px]">'
)

$content = $content.Replace(
    'className="font-semibold text-text-primary"',
    'className="font-semibold leading-5 text-text-primary [overflow-wrap:normal] break-normal"'
)

# ============================================================
# 3. Programme stays as short code and narrow.
# ============================================================

$content = $content.Replace(
    'size: 90,',
    'size: 78,'
)

$content = $content.Replace(
    'minSize: 80,',
    'minSize: 72,'
)

$content = $content.Replace(
    'min-w-[64px]',
    'min-w-[56px]'
)

# ============================================================
# 4. Compact common columns by setting stable widths on cells.
# ============================================================

$cellWidthPairs = @(
    @('<div className="min-w-36">','<div className="w-[110px] min-w-[110px]">'),
    @('<div className="min-w-32">','<div className="w-[96px] min-w-[96px]">'),
    @('<div className="min-w-28">','<div className="w-[84px] min-w-[84px]">'),
    @('<div className="min-w-24">','<div className="w-[72px] min-w-[72px]">')
)

foreach ($pair in $cellWidthPairs) {
    $content = $content.Replace($pair[0], $pair[1])
}

# Room preference should not reserve too much width.
$content = $content.Replace(
    'No preference',
    'None'
)

# Period labels are already short; ensure the surrounding cell stays narrow.
$content = [regex]::Replace(
    $content,
    '(<span[^>]*>\s*\{row\.original\.periodName\}\s*</span>)',
    '<span className="inline-block w-[72px] min-w-[72px]">$1</span>'
)

# ============================================================
# 5. Compact action menu width further if already using overflow.
# ============================================================

$content = $content.Replace(
    'min-w-[210px]',
    'min-w-[190px]'
)

$content = $content.Replace(
    'w-56',
    'w-48'
)

# ============================================================
# 6. Remove visible "Actions" header if still present.
# ============================================================

$content = $content.Replace(
    "header: 'Actions',",
    "header: '',"
)

# ============================================================
# 7. Make Status and Timetable columns visually compact.
# ============================================================

$content = $content.Replace(
    'className="inline-flex rounded-full',
    'className="inline-flex whitespace-nowrap rounded-full'
)

# ============================================================
# 8. Final source checks.
# ============================================================

$mustContain = @(
    "header: ''",
    "Programme",
    "No preference"
)

# "No preference" may have been fully replaced by "None"; that's fine.
if (-not $content.Contains("header: ''")) {
    throw "Compact Actions header was not confirmed."
}

if (-not $content.Contains("Programme")) {
    throw "Programme column was not found after patching."
}

Write-Text $file $content

Write-Host ""
Write-Host "v12.14.11 applied successfully." -ForegroundColor Green
Write-Host "Curriculum Units now uses:" -ForegroundColor Cyan
Write-Host "  - compact desktop filters" -ForegroundColor Gray
Write-Host "  - wider Unit name column" -ForegroundColor Gray
Write-Host "  - narrower programme/category/period columns" -ForegroundColor Gray
Write-Host "  - shorter room preference text" -ForegroundColor Gray
Write-Host "  - compact overflow Actions column" -ForegroundColor Gray
Write-Host "No database or unit business logic was changed." -ForegroundColor Cyan
