$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$utf8 = New-Object System.Text.UTF8Encoding($false)
$backupRoot = Join-Path $PWD.Path (".ui-table-backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))

function Read-Text([string]$Path) {
    if (-not (Test-Path $Path)) {
        throw "Required file not found: $Path"
    }
    return [System.IO.File]::ReadAllText((Resolve-Path $Path))
}

function Write-Text([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText((Resolve-Path $Path), $Content, $utf8)
}

function Backup-File([string]$Path) {
    if (-not (Test-Path $Path)) {
        return
    }

    $resolved = (Resolve-Path $Path).Path

    $relative = $resolved.Substring(
        $PWD.Path.TrimEnd('\').Length
    ).TrimStart('\')

    $destination = Join-Path $backupRoot $relative
    $parent = Split-Path -Parent $destination

    if (-not (Test-Path $parent)) {
        New-Item `
            -ItemType Directory `
            -Path $parent `
            -Force |
            Out-Null
    }

    Copy-Item `
        -LiteralPath $resolved `
        -Destination $destination `
        -Force
}

Write-Host ""
Write-Host "Applying v12.14.4 Timetabler Table Layout Repair..." -ForegroundColor Cyan

$dataTable = "src\components\ui\data-table.tsx"
$unitTable = "src\features\units\unit-table.tsx"
$cohortTable = "src\features\cohorts\cohort-table.tsx"

$programmeTable = Get-ChildItem ".\src\features\programmes" -File -Filter "*table*.tsx" -ErrorAction SilentlyContinue |
    Select-Object -First 1

$targets = @($dataTable, $unitTable, $cohortTable)

if ($programmeTable) {
    $targets += $programmeTable.FullName
}

foreach ($target in $targets) {
    if (Test-Path $target) {
        Backup-File $target
    }
}

# 1. GLOBAL DATATABLE
$data = Read-Text $dataTable
$data = $data.Replace("table-fixed", "table-auto")

$tableRegex = [System.Text.RegularExpressions.Regex]::new(
    '<table\s+className="([^"]*)"',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
)

$tableMatch = $tableRegex.Match($data)

if (-not $tableMatch.Success) {
    throw "Could not locate the DataTable <table className=...> element."
}

$tableClasses = $tableMatch.Groups[1].Value

if ($tableClasses -notmatch '\bmin-w-max\b') {
    $tableClasses = ($tableClasses + " min-w-max table-auto").Trim()
}

$data =
    $data.Substring(0, $tableMatch.Groups[1].Index) +
    $tableClasses +
    $data.Substring(
        $tableMatch.Groups[1].Index +
        $tableMatch.Groups[1].Length
    )

if ($data -notmatch 'overflow-x-auto') {
    $data = [regex]::Replace(
        $data,
        '(<table\s+className="[^"]*")',
        '<div className="w-full overflow-x-auto">$1',
        1
    )

    $data = [regex]::Replace(
        $data,
        '(</table>)',
        '$1</div>',
        1
    )
}

Write-Text $dataTable $data
Write-Host "DataTable now preserves column width and scrolls horizontally." -ForegroundColor Green

# 2. CURRICULUM UNITS
$units = Read-Text $unitTable

$units = $units.Replace(" Ã‚Â· ", " Â· ")
$units = $units.Replace("Ãƒâ€šÃ‚Â·", "Â·")
$units = $units.Replace("Ã‚Â·", "Â·")

$units = $units.Replace(
    '<div className="min-w-64">',
    '<div className="w-[210px] min-w-[210px] max-w-[240px]">'
)

$unitNameOld = '<p className="font-semibold text-text-primary">'
$unitNameNew = '<p className="font-semibold leading-5 text-text-primary [overflow-wrap:normal] break-normal">'
$unitNameIndex = $units.IndexOf($unitNameOld)
if ($unitNameIndex -ge 0) {
    $units =
        $units.Substring(0, $unitNameIndex) +
        $unitNameNew +
        $units.Substring($unitNameIndex + $unitNameOld.Length)
}

$programmePattern = [System.Text.RegularExpressions.Regex]::new(
    "\{\s*id:\s*'programme'[\s\S]*?\n\s*\},\s*\n\s*\{\s*accessorKey:\s*'category'",
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

$programmeMatch = $programmePattern.Match($units)

if ($programmeMatch.Success) {
    $compactProgramme = @'
{
    id: 'programme',
    accessorFn: (row) =>
      row.programme?.code ?? '',
    header: 'Programme',
    size: 90,
    minSize: 80,
    cell: ({ row }) => (
      <span className="inline-flex min-w-[64px] font-semibold text-text-primary">
        {row.original.programme?.code ?? 'â€”'}
      </span>
    ),
  },
  {
    accessorKey: 'category'
'@

    $units =
        $units.Substring(0, $programmeMatch.Index) +
        $compactProgramme +
        $units.Substring($programmeMatch.Index + $programmeMatch.Length)
}
else {
    Write-Warning "Programme column in Unit table was not replaced automatically."
}

$units = $units.Replace(
    'className="flex min-w-max flex-wrap justify-end gap-2"',
    'className="flex w-[126px] min-w-[126px] flex-col items-stretch gap-1.5"'
)

Write-Text $unitTable $units
Write-Host "Curriculum Units table compacted." -ForegroundColor Green

# 3. COHORTS
$cohorts = Read-Text $cohortTable

$cohorts = $cohorts.Replace(
    '<div className="min-w-56">',
    '<div className="w-[150px] min-w-[150px]">'
)

$cohortProgrammePattern = [System.Text.RegularExpressions.Regex]::new(
    "\{\s*id:\s*'programme'[\s\S]*?\n\s*\},\s*\n\s*\{\s*id:\s*'dates'",
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

$cohortProgrammeMatch = $cohortProgrammePattern.Match($cohorts)

if ($cohortProgrammeMatch.Success) {
    $compactCohortProgramme = @'
{
    id: 'programme',
    accessorFn: (row) =>
      row.programme?.code ?? '',
    header: 'Programme',
    cell: ({ row }) => (
      <span className="inline-flex min-w-[72px] font-semibold text-text-primary">
        {row.original.programme?.code ?? 'â€”'}
      </span>
    ),
  },
  {
    id: 'dates'
'@

    $cohorts =
        $cohorts.Substring(0, $cohortProgrammeMatch.Index) +
        $compactCohortProgramme +
        $cohorts.Substring($cohortProgrammeMatch.Index + $cohortProgrammeMatch.Length)
}
else {
    Write-Warning "Programme column in Cohort table was not replaced automatically."
}

$cohorts = $cohorts.Replace(
    '<div className="min-w-44 text-sm text-text-primary">',
    '<div className="w-[150px] min-w-[150px] text-xs leading-5 text-text-primary">'
)

$cohorts = $cohorts.Replace(
    '<div className="min-w-32">',
    '<div className="w-[90px] min-w-[90px]">'
)

$cohorts = $cohorts.Replace(
    '<div className="min-w-36">',
    '<div className="w-[110px] min-w-[110px]">'
)

$cohorts = $cohorts.Replace(
    'className="flex min-w-max flex-wrap justify-end gap-2"',
    'className="flex w-[132px] min-w-[132px] flex-col items-stretch gap-1.5"'
)

$cohorts = $cohorts.Replace(
    'className="h-9 min-w-32 text-xs"',
    'className="h-9 w-full min-w-[120px] text-xs"'
)

Write-Text $cohortTable $cohorts
Write-Host "Classes and Cohorts table compacted." -ForegroundColor Green

# 4. PROGRAMMES
if ($programmeTable) {
    $programmePath = $programmeTable.FullName
    $programmes = [System.IO.File]::ReadAllText($programmePath)

    $programmes = $programmes.Replace(
        'className="font-semibold text-text-primary"',
        'className="font-semibold leading-5 text-text-primary [overflow-wrap:normal] break-normal"'
    )

    $programmes = $programmes.Replace(
        'className="font-medium text-text-primary"',
        'className="font-medium leading-5 text-text-primary [overflow-wrap:normal] break-normal"'
    )

    $programmes = $programmes.Replace(
        'className="flex min-w-max flex-wrap justify-end gap-2"',
        'className="flex w-[126px] min-w-[126px] flex-col items-stretch gap-1.5"'
    )

    [System.IO.File]::WriteAllText(
        $programmePath,
        $programmes,
        $utf8
    )

    Write-Host "Programmes table readability improved." -ForegroundColor Green
}

Write-Host ""
Write-Host "v12.14.4 UI patch applied." -ForegroundColor Green
Write-Host "Backup: $backupRoot" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Expected result:" -ForegroundColor Cyan
Write-Host "  - no overlapping columns" -ForegroundColor Gray
Write-Host "  - no letter-by-letter unit/programme wrapping" -ForegroundColor Gray
Write-Host "  - programme short codes in Units/Cohorts tables" -ForegroundColor Gray
Write-Host "  - compact vertical action controls" -ForegroundColor Gray
Write-Host "  - horizontal scrolling only when table genuinely exceeds the viewport" -ForegroundColor Gray
