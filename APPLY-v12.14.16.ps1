$ErrorActionPreference = "Stop"
Set-Location "C:\Users\sozi\Desktop\academic-timetabler"

$file = "src\features\units\unit-table.tsx"

if (-not (Test-Path -LiteralPath $file)) {
    throw "Unit table not found: $file"
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText((Resolve-Path $file))

Write-Host ""
Write-Host "Applying v12.14.16 Exact Balanced Unit Table Repair..." -ForegroundColor Cyan

# ============================================================
# 1. Clean obvious source artifacts first.
# ============================================================

# Known mojibake middle-dot variants in the current Unit code line.
$content = $content.Replace(" ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ", " · ")
$content = $content.Replace(" Ã‚Â· ", " · ")
$content = $content.Replace("Â·", "·")

# Fix import indentation left by earlier patches.
$content = $content.Replace(
    "  MoreVertical,`r`nBookOpen,",
    "  MoreVertical,`r`n  BookOpen,"
)
$content = $content.Replace(
    "  MoreVertical,`nBookOpen,",
    "  MoreVertical,`n  BookOpen,"
)

# Earlier patch accidentally put unit-name wrapping classes on Edit link.
$content = $content.Replace(
    'className="max-w-[190px] whitespace-normal break-words font-semibold leading-5 text-text-primary"',
    'className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"',
    1
)

# Restore the Unit name class specifically.
$unitNamePattern = [System.Text.RegularExpressions.Regex]::new(
    '(<p\s+className=")[^"]*("\>\s*\{row\.original\.name\})',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

if ($unitNamePattern.IsMatch($content)) {
    $content = $unitNamePattern.Replace(
        $content,
        '$1max-w-[220px] whitespace-normal break-words font-semibold leading-5 text-text-primary$2',
        1
    )
}

# ============================================================
# 2. Build the three missing columns as one exact block.
#    Insert before Contact hours, which definitely exists.
# ============================================================

$missingProgramme = -not $content.Contains("header: 'Programme'")
$missingCategory  = -not $content.Contains("header: 'Category'")
$missingPeriod    = -not $content.Contains("header: 'Period'")

if ($missingProgramme -or $missingCategory -or $missingPeriod) {
    $contactHeader = "header: 'Contact hours'"
    $contactIndex = $content.IndexOf($contactHeader)

    if ($contactIndex -lt 0) {
        throw "Contact hours column was not found. No file was changed."
    }

    $contactStart = $content.LastIndexOf("  {", $contactIndex)

    if ($contactStart -lt 0) {
        throw "Could not locate the start of Contact hours column."
    }

    $columnsToInsert = ""

    if ($missingProgramme) {
        $columnsToInsert += @'
  {
    id: 'programme',
    accessorFn: (row) =>
      row.programme?.code ?? '',
    header: 'Programme',
    size: 92,
    minSize: 84,
    maxSize: 104,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm font-semibold text-text-primary">
        {row.original.programme?.code ?? '—'}
      </span>
    ),
  },

'@
    }

    if ($missingCategory) {
        $columnsToInsert += @'
  {
    accessorKey: 'category',
    header: 'Category',
    size: 96,
    minSize: 88,
    maxSize: 108,
    cell: ({ row }) => (
      <Badge variant="neutral">
        {getCategoryLabel(row.original.category)}
      </Badge>
    ),
  },

'@
    }

    if ($missingPeriod) {
        $columnsToInsert += @'
  {
    accessorKey: 'academicPeriodNumber',
    header: 'Period',
    size: 88,
    minSize: 82,
    maxSize: 96,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm font-medium text-text-primary">
        Period {row.original.academicPeriodNumber}
      </span>
    ),
  },

'@
    }

    $content =
        $content.Substring(0, $contactStart) +
        $columnsToInsert +
        $content.Substring($contactStart)

    Write-Host "Missing Programme/Category/Period columns restored." -ForegroundColor Green
}
else {
    Write-Host "Programme, Category and Period columns already present." -ForegroundColor DarkGray
}

# ============================================================
# 3. Force exact balanced sizing on every visible column.
# ============================================================

function Force-ColumnSizing(
    [string]$Text,
    [string]$Header,
    [int]$Size,
    [int]$MinSize,
    [int]$MaxSize
) {
    $token = "header: '$Header'"
    $idx = $Text.IndexOf($token)

    if ($idx -lt 0) {
        throw "Expected '$Header' column was not found."
    }

    $start = $Text.LastIndexOf("  {", $idx)
    $next = $Text.IndexOf("`n  {", $idx + $token.Length)

    if ($next -lt 0) {
        $next = $Text.IndexOf("`r`n  {", $idx + $token.Length)
    }

    if ($start -lt 0 -or $next -lt 0) {
        throw "Could not isolate '$Header' column."
    }

    $block = $Text.Substring($start, $next - $start)

    $block = [regex]::Replace($block, '\s*size:\s*\d+\s*,', '')
    $block = [regex]::Replace($block, '\s*minSize:\s*\d+\s*,', '')
    $block = [regex]::Replace($block, '\s*maxSize:\s*\d+\s*,', '')

    $block = $block.Replace(
        $token,
        "$token`n    size: $Size,`n    minSize: $MinSize,`n    maxSize: $MaxSize,"
    )

    return (
        $Text.Substring(0, $start) +
        $block +
        $Text.Substring($next)
    )
}

$content = Force-ColumnSizing $content "Unit" 220 190 240
$content = Force-ColumnSizing $content "Programme" 92 84 104
$content = Force-ColumnSizing $content "Category" 96 88 108
$content = Force-ColumnSizing $content "Period" 88 82 96
$content = Force-ColumnSizing $content "Contact hours" 108 96 118
$content = Force-ColumnSizing $content "Timetable" 118 108 128
$content = Force-ColumnSizing $content "Status" 96 88 108

# ============================================================
# 4. Actions column must stay narrow.
# ============================================================

$actionsIndex = $content.IndexOf("id: 'actions'")

if ($actionsIndex -lt 0) {
    throw "Actions column was not found."
}

$actionsStart = $content.LastIndexOf("  {", $actionsIndex)
$actionsNext = $content.IndexOf("`n  {", $actionsIndex + 1)

if ($actionsNext -lt 0) {
    $actionsNext = $content.IndexOf("`r`n  {", $actionsIndex + 1)
}

if ($actionsNext -lt 0) {
    $actionsNext = $content.IndexOf("`n];", $actionsIndex)
}

if ($actionsStart -lt 0 -or $actionsNext -lt 0) {
    throw "Could not isolate Actions column."
}

$actionsBlock = $content.Substring(
    $actionsStart,
    $actionsNext - $actionsStart
)

$actionsBlock = [regex]::Replace(
    $actionsBlock,
    '\s*size:\s*\d+\s*,',
    ''
)
$actionsBlock = [regex]::Replace(
    $actionsBlock,
    '\s*minSize:\s*\d+\s*,',
    ''
)
$actionsBlock = [regex]::Replace(
    $actionsBlock,
    '\s*maxSize:\s*\d+\s*,',
    ''
)

$actionsBlock = $actionsBlock.Replace(
    "header: '',",
    "header: '',`n    size: 52,`n    minSize: 52,`n    maxSize: 52,"
)

$content =
    $content.Substring(0, $actionsStart) +
    $actionsBlock +
    $content.Substring($actionsNext)

# ============================================================
# 5. Ensure Unit wrapper itself does not reserve extra width.
# ============================================================

$content = $content.Replace(
    '<div className="min-w-0 pr-5">',
    '<div className="w-[220px] min-w-[190px] max-w-[240px] pr-3">'
)

# ============================================================
# 6. Final verification.
# ============================================================

$required = @(
    "header: 'Unit'",
    "header: 'Programme'",
    "header: 'Category'",
    "header: 'Period'",
    "header: 'Contact hours'",
    "header: 'Timetable'",
    "header: 'Status'",
    "maxSize: 52"
)

foreach ($item in $required) {
    if (-not $content.Contains($item)) {
        throw "Verification failed: missing $item"
    }
}

if ($content.Contains("Ãƒ")) {
    throw "Mojibake remains in unit-table.tsx. No file was written."
}

[System.IO.File]::WriteAllText(
    (Resolve-Path $file),
    $content,
    $utf8
)

Write-Host ""
Write-Host "v12.14.16 applied successfully." -ForegroundColor Green
Write-Host "Final columns:" -ForegroundColor Cyan
Write-Host "  Unit | Programme | Category | Period | Contact hours | Timetable | Status | menu" -ForegroundColor Gray
Write-Host "Actions max width corrected to 52px." -ForegroundColor Gray
Write-Host "Mojibake cleaned." -ForegroundColor Gray
Write-Host "No database or scheduling logic changed." -ForegroundColor Cyan
