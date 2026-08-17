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
Write-Host "Applying v12.14.10 Academic Periods Exact UI Repair..." -ForegroundColor Cyan

$file = "src\features\academic-periods\academic-period-table.tsx"
$content = Read-Text $file

# ============================================================
# 1. Add MoreVertical to the exact current lucide-react import.
# ============================================================

$oldImport = @'
import {
  CalendarDays,
  Pencil,
  RotateCcw,
} from 'lucide-react';
'@

$newImport = @'
import {
  CalendarDays,
  MoreVertical,
  Pencil,
  RotateCcw,
} from 'lucide-react';
'@

if (-not $content.Contains("MoreVertical")) {
    if (-not $content.Contains($oldImport)) {
        throw "Expected Academic Period lucide import was not found."
    }

    $content = $content.Replace(
        $oldImport,
        $newImport
    )
}

# ============================================================
# 2. Replace the exact current wide Actions cell.
# ============================================================

$oldActions = @'
  {
    id: 'actions',
    enableSorting: false,
    header: 'Actions',
    cell: ({ row }) => (
      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href={`/timetable/academic-periods/${row.original.id}/edit`}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
        >
          <Pencil
            className="size-3.5"
            aria-hidden="true"
          />
          Edit
        </Link>

        <AcademicPeriodLifecycleAction
          academicPeriod={row.original}
        />
      </div>
    ),
  },
'@

$newActions = @'
  {
    id: 'actions',
    enableSorting: false,
    header: '',
    size: 52,
    minSize: 52,
    maxSize: 52,
    cell: ({ row }) => (
      <details className="relative">
        <summary
          className="inline-flex size-8 cursor-pointer list-none items-center justify-center rounded-lg border border-border-strong bg-surface text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          aria-label={`Actions for ${row.original.name}`}
          title="Actions"
        >
          <MoreVertical
            className="size-4"
            aria-hidden="true"
          />
        </summary>

        <div className="absolute right-0 z-50 mt-1 w-56 rounded-xl border border-border bg-surface p-2 shadow-xl">
          <Link
            href={`/timetable/academic-periods/${row.original.id}/edit`}
            className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <Pencil
              className="size-3.5"
              aria-hidden="true"
            />
            Edit Academic Period
          </Link>

          <div className="mt-1 border-t border-border pt-2 [&_button]:w-full [&_button]:justify-start [&_form]:w-full [&_select]:w-full">
            <AcademicPeriodLifecycleAction
              academicPeriod={row.original}
            />
          </div>
        </div>
      </details>
    ),
  },
'@

if (-not $content.Contains($newActions)) {
    if (-not $content.Contains($oldActions)) {
        throw "Expected Academic Period Actions column was not found."
    }

    $content = $content.Replace(
        $oldActions,
        $newActions
    )

    Write-Host "Actions moved into compact overflow menu." -ForegroundColor Green
}
else {
    Write-Host "Actions menu already compact." -ForegroundColor DarkGray
}

# ============================================================
# 3. Compact filter toolbar into one desktop row.
# ============================================================

$oldToolbarOpen = @'
        <div className="flex flex-1 flex-wrap items-center gap-2">
'@

$newToolbarOpen = @'
        <div className="grid w-full gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-1 lg:flex-wrap lg:items-center">
'@

if ($content.Contains($oldToolbarOpen)) {
    $content = $content.Replace(
        $oldToolbarOpen,
        $newToolbarOpen
    )
}

# Only the two filter selects inside toolbar use className="h-11".
# Give them desktop widths so they do not consume full rows.
$selectPattern = [System.Text.RegularExpressions.Regex]::new(
    '(aria-label="Filter by Academic Year"[\s\S]*?)className="h-11"',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

if ($selectPattern.IsMatch($content)) {
    $content = $selectPattern.Replace(
        $content,
        '$1className="h-10 w-full lg:w-56"',
        1
    )
}

$statusPattern = [System.Text.RegularExpressions.Regex]::new(
    '(aria-label="Filter by status"[\s\S]*?)className="h-11"',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

if ($statusPattern.IsMatch($content)) {
    $content = $statusPattern.Replace(
        $content,
        '$1className="h-10 w-full lg:w-44"',
        1
    )
}

# ============================================================
# 4. Reduce unnecessary column minimum widths while preserving
#    readability. The Academic Period name remains prominent.
# ============================================================

$content = $content.Replace(
    '<div className="min-w-52">',
    '<div className="w-[190px] min-w-[190px] max-w-[220px]">'
)

$content = $content.Replace(
    '<div className="min-w-40">',
    '<div className="w-[110px] min-w-[110px]">'
)

# ============================================================
# 5. Verify the exact source now contains the intended pieces.
# ============================================================

$checks = @(
    "MoreVertical",
    "header: ''",
    "lg:w-56",
    "lg:w-44"
)

foreach ($check in $checks) {
    if (-not $content.Contains($check)) {
        throw "Verification failed. Expected source fragment missing: $check"
    }
}

Write-Text $file $content

Write-Host ""
Write-Host "v12.14.10 applied successfully." -ForegroundColor Green
Write-Host "Academic Periods now uses:" -ForegroundColor Cyan
Write-Host "  - compact three-dot Actions column" -ForegroundColor Gray
Write-Host "  - tighter Academic Period and Academic Year widths" -ForegroundColor Gray
Write-Host "  - compact desktop filter controls" -ForegroundColor Gray
Write-Host "No database or lifecycle logic was changed." -ForegroundColor Cyan
