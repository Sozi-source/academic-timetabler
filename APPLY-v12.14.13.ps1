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

function Remove-ColumnByHeader(
    [string]$Content,
    [string]$Header
) {
    $headerToken = "header: '$Header'"
    $headerIndex = $Content.IndexOf($headerToken)

    if ($headerIndex -lt 0) {
        return $Content
    }

    $start = $Content.LastIndexOf("  {", $headerIndex)

    if ($start -lt 0) {
        throw "Could not locate start of '$Header' column."
    }

    $next = $Content.IndexOf("`n  {", $headerIndex + $headerToken.Length)

    if ($next -lt 0) {
        throw "Could not locate end of '$Header' column."
    }

    return (
        $Content.Substring(0, $start) +
        $Content.Substring($next)
    )
}

function Set-ColumnSize(
    [string]$Content,
    [string]$Header,
    [int]$Size,
    [int]$MinSize
) {
    $pattern = [System.Text.RegularExpressions.Regex]::new(
        "(?s)(header:\s*'$([regex]::Escape($Header))'\s*,)([\s\S]*?)(?=\n\s*\},\s*\n\s*\{)",
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    $match = $pattern.Match($Content)

    if (-not $match.Success) {
        return $Content
    }

    $block = $match.Value

    if ($block -match '\bsize:\s*\d+\s*,') {
        $block = [regex]::Replace(
            $block,
            '\bsize:\s*\d+\s*,',
            "size: $Size,",
            1
        )
    }
    else {
        $block = $block.Replace(
            "header: '$Header',",
            "header: '$Header',`n    size: $Size,"
        )
    }

    if ($block -match '\bminSize:\s*\d+\s*,') {
        $block = [regex]::Replace(
            $block,
            '\bminSize:\s*\d+\s*,',
            "minSize: $MinSize,",
            1
        )
    }
    else {
        $block = $block.Replace(
            "size: $Size,",
            "size: $Size,`n    minSize: $MinSize,"
        )
    }

    return (
        $Content.Substring(0, $match.Index) +
        $block +
        $Content.Substring($match.Index + $match.Length)
    )
}

Write-Host ""
Write-Host "Applying v12.14.13 Curriculum Units Reference-Design Repair..." -ForegroundColor Cyan

$file = "src\features\units\unit-table.tsx"
$content = Read-Text $file

# ============================================================
# 1. Match the reference table: remove secondary detail columns
#    that are not needed in this overview.
# ============================================================

$content = Remove-ColumnByHeader `
    -Content $content `
    -Header "Room preference"

$content = Remove-ColumnByHeader `
    -Content $content `
    -Header "Contact hours"

Write-Host "Overview columns simplified." -ForegroundColor Green

# ============================================================
# 2. Use the clean reference-design column proportions.
# ============================================================

$content = Set-ColumnSize $content "Unit" 340 280
$content = Set-ColumnSize $content "Programme" 100 86
$content = Set-ColumnSize $content "Category" 105 90
$content = Set-ColumnSize $content "Period" 100 88
$content = Set-ColumnSize $content "Timetable" 130 115
$content = Set-ColumnSize $content "Status" 105 92

# Keep action column very narrow.
$content = $content.Replace(
    "header: 'Actions',",
    "header: '',`n    size: 52,`n    minSize: 52,`n    maxSize: 52,"
)

# Avoid duplicate sizing if previous patches already removed header label.
$actionsPattern = [System.Text.RegularExpressions.Regex]::new(
    "(?s)(id:\s*'actions'\s*,[\s\S]*?header:\s*''\s*,)([\s\S]*?)(?=\n\s*cell:)",
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

$actionsMatch = $actionsPattern.Match($content)

if ($actionsMatch.Success) {
    $prefix = $actionsMatch.Groups[1].Value
    $middle = $actionsMatch.Groups[2].Value

    $middle = [regex]::Replace($middle, '\s*\bsize:\s*\d+\s*,', '')
    $middle = [regex]::Replace($middle, '\s*\bminSize:\s*\d+\s*,', '')
    $middle = [regex]::Replace($middle, '\s*\bmaxSize:\s*\d+\s*,', '')

    $replacement =
        $prefix +
        "`n    size: 52,`n    minSize: 52,`n    maxSize: 52," +
        $middle

    $content =
        $content.Substring(0, $actionsMatch.Index) +
        $replacement +
        $content.Substring($actionsMatch.Index + $actionsMatch.Length)
}

# ============================================================
# 3. Unit text should be prominent but not force the whole table.
# ============================================================

$content = $content.Replace(
    'w-[300px] min-w-[300px] max-w-[360px]',
    'w-[280px] min-w-[280px] max-w-[360px]'
)

$content = $content.Replace(
    'w-[210px] min-w-[210px] max-w-[240px]',
    'w-[280px] min-w-[280px] max-w-[360px]'
)

$content = $content.Replace(
    'className="font-semibold text-text-primary"',
    'className="font-semibold leading-5 text-text-primary"'
)

# ============================================================
# 4. Search copy: remove room-preference wording.
# ============================================================

$content = [regex]::Replace(
    $content,
    'searchPlaceholder="[^"]*"',
    'searchPlaceholder="Search unit names, codes, programmes or categories..."',
    1
)

# ============================================================
# 5. Remove Programme from the FILTER BAR only.
#    Programme remains an important table column and is searchable.
#    This leaves four filters, matching the reference design.
# ============================================================

$programmeSelect = [System.Text.RegularExpressions.Regex]::new(
    '(?s)\s*<Select\s+aria-label="Filter by programme"[\s\S]*?</Select>\s*',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

if ($programmeSelect.IsMatch($content)) {
    $content = $programmeSelect.Replace(
        $content,
        "`n",
        1
    )
    Write-Host "Programme filter removed from toolbar." -ForegroundColor Green
}

# ============================================================
# 6. Rebuild the remaining filter bar as a compact desktop row.
# ============================================================

$toolbarOpenPatterns = @(
    '<div className="grid w-full gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-1 lg:flex-wrap lg:items-center">',
    '<div className="flex flex-1 flex-wrap items-center gap-2">',
    '<div className="grid w-full gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-1 lg:flex-nowrap lg:items-center">'
)

foreach ($old in $toolbarOpenPatterns) {
    if ($content.Contains($old)) {
        $content = $content.Replace(
            $old,
            '<div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-1 lg:flex-nowrap">'
        )
        break
    }
}

$filterWidths = @{
    'Filter by period' = 'lg:w-36'
    'Filter by category' = 'lg:w-40'
    'Filter by status' = 'lg:w-36'
    'Filter by timetable availability' = 'lg:w-40'
    'Filter by availability' = 'lg:w-40'
}

foreach ($pair in $filterWidths.GetEnumerator()) {
    $pattern = [System.Text.RegularExpressions.Regex]::new(
        '(aria-label="' +
        [regex]::Escape($pair.Key) +
        '"[\s\S]*?)className="[^"]*"',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if ($pattern.IsMatch($content)) {
        $content = $pattern.Replace(
            $content,
            '$1className="h-10 w-full sm:w-auto ' +
            $pair.Value +
            '"',
            1
        )
    }
}

# ============================================================
# 7. Make clear-filters compact and keep it at the far right.
# ============================================================

$content = $content.Replace(
    'variant="ghost"`n              size="sm"',
    'variant="outline"`n              size="sm"'
)

# ============================================================
# 8. Reference design uses 10-row pages for a cleaner workspace.
# ============================================================

$content = $content.Replace(
    'initialPageSize={20}',
    'initialPageSize={10}'
)

# ============================================================
# 9. Safety verification.
# ============================================================

if ($content.Contains("header: 'Room preference'")) {
    throw "Room preference column still exists."
}

if ($content.Contains("header: 'Contact hours'")) {
    throw "Contact hours column still exists."
}

if ($content.Contains('aria-label="Filter by programme"')) {
    throw "Programme filter still exists in toolbar."
}

if (-not $content.Contains("Search unit names, codes, programmes or categories...")) {
    throw "Search placeholder update was not applied."
}

Write-Text $file $content

Write-Host ""
Write-Host "v12.14.13 applied successfully." -ForegroundColor Green
Write-Host "Curriculum Units now follows the approved reference layout:" -ForegroundColor Cyan
Write-Host "  Unit | Programme | Category | Period | Timetable | Status | menu" -ForegroundColor Gray
Write-Host "  Search + Period + Category + Status + Availability in one compact toolbar" -ForegroundColor Gray
Write-Host "  10 rows per page" -ForegroundColor Gray
Write-Host "No database, unit validation, or timetable logic was changed." -ForegroundColor Cyan
