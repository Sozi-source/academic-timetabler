$ErrorActionPreference = "Stop"
Set-Location "C:\Users\sozi\Desktop\academic-timetabler"

$file = "src\features\units\unit-table.tsx"
if (-not (Test-Path -LiteralPath $file)) {
    throw "Unit table not found: $file"
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText((Resolve-Path $file))

Write-Host ""
Write-Host "Applying v12.14.15 Curriculum Units Balanced Columns Repair..." -ForegroundColor Cyan

function Has-Header([string]$Text, [string]$Header) {
    return $Text.Contains("header: '$Header'")
}

function Insert-BeforeHeader(
    [string]$Text,
    [string]$BeforeHeader,
    [string]$ColumnBlock
) {
    $token = "header: '$BeforeHeader'"
    $idx = $Text.IndexOf($token)

    if ($idx -lt 0) {
        throw "Could not locate '$BeforeHeader' column."
    }

    $start = $Text.LastIndexOf("  {", $idx)

    if ($start -lt 0) {
        throw "Could not locate start of '$BeforeHeader' column."
    }

    return (
        $Text.Substring(0, $start) +
        $ColumnBlock +
        $Text.Substring($start)
    )
}

# ============================================================
# 1. Restore Programme column if missing.
# ============================================================

if (-not (Has-Header $content "Programme")) {
    $programmeColumn = @'
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

    $content = Insert-BeforeHeader `
        -Text $content `
        -BeforeHeader "Category" `
        -ColumnBlock $programmeColumn

    Write-Host "Programme column restored." -ForegroundColor Green
}

# ============================================================
# 2. Restore Category column if missing.
# ============================================================

if (-not (Has-Header $content "Category")) {
    $categoryColumn = @'
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

    $content = Insert-BeforeHeader `
        -Text $content `
        -BeforeHeader "Period" `
        -ColumnBlock $categoryColumn

    Write-Host "Category column restored." -ForegroundColor Green
}

# ============================================================
# 3. Restore Period column if missing.
# ============================================================

if (-not (Has-Header $content "Period")) {
    $periodColumn = @'
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

    $content = Insert-BeforeHeader `
        -Text $content `
        -BeforeHeader "Contact hours" `
        -ColumnBlock $periodColumn

    Write-Host "Period column restored." -ForegroundColor Green
}

# ============================================================
# 4. Force balanced widths for existing columns.
# ============================================================

function Force-ColumnSizing(
    [string]$Text,
    [string]$Header,
    [int]$Size,
    [int]$MinSize,
    [int]$MaxSize
) {
    $headerToken = "header: '$Header'"
    $idx = $Text.IndexOf($headerToken)

    if ($idx -lt 0) {
        return $Text
    }

    $start = $Text.LastIndexOf("  {", $idx)
    $next = $Text.IndexOf("`n  {", $idx + $headerToken.Length)

    if ($start -lt 0 -or $next -lt 0) {
        return $Text
    }

    $block = $Text.Substring($start, $next - $start)

    $block = [regex]::Replace($block, '\s*size:\s*\d+\s*,', '')
    $block = [regex]::Replace($block, '\s*minSize:\s*\d+\s*,', '')
    $block = [regex]::Replace($block, '\s*maxSize:\s*\d+\s*,', '')

    $block = $block.Replace(
        $headerToken,
        "$headerToken`n    size: $Size,`n    minSize: $MinSize,`n    maxSize: $MaxSize,"
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
# 5. Make Unit cell truly compact, but allow natural wrapping.
# ============================================================

$content = [regex]::Replace(
    $content,
    'w-\[\d+px\]\s+min-w-\[\d+px\]\s+max-w-\[\d+px\]',
    'w-[210px] min-w-[190px] max-w-[230px]',
    1
)

$content = [regex]::Replace(
    $content,
    'className="[^"]*font-semibold[^"]*text-text-primary[^"]*"',
    'className="max-w-[220px] whitespace-normal break-words font-semibold leading-5 text-text-primary"',
    1
)

# ============================================================
# 6. Keep Actions at 52px.
# ============================================================

$actionsPattern = [System.Text.RegularExpressions.Regex]::new(
    "(?s)(id:\s*'actions'\s*,[\s\S]*?header:\s*''\s*,)([\s\S]*?)(?=\n\s*cell:)",
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

$actionsMatch = $actionsPattern.Match($content)

if ($actionsMatch.Success) {
    $prefix = $actionsMatch.Groups[1].Value
    $middle = $actionsMatch.Groups[2].Value

    $middle = [regex]::Replace($middle, '\s*size:\s*\d+\s*,', '')
    $middle = [regex]::Replace($middle, '\s*minSize:\s*\d+\s*,', '')
    $middle = [regex]::Replace($middle, '\s*maxSize:\s*\d+\s*,', '')

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
# 7. Verification.
# ============================================================

$required = @(
    "header: 'Unit'",
    "header: 'Programme'",
    "header: 'Category'",
    "header: 'Period'",
    "header: 'Contact hours'",
    "header: 'Timetable'",
    "header: 'Status'"
)

foreach ($requiredText in $required) {
    if (-not $content.Contains($requiredText)) {
        throw "Verification failed: missing $requiredText"
    }
}

[System.IO.File]::WriteAllText(
    (Resolve-Path $file),
    $content,
    $utf8
)

Write-Host ""
Write-Host "v12.14.15 applied successfully." -ForegroundColor Green
Write-Host "Balanced table layout:" -ForegroundColor Cyan
Write-Host "  Unit | Programme | Category | Period | Contact hours | Timetable | Status | menu" -ForegroundColor Gray
Write-Host "Long unit names wrap naturally instead of consuming unused width." -ForegroundColor Gray
Write-Host "No database or scheduling logic changed." -ForegroundColor Cyan
