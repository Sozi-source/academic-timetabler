$ErrorActionPreference = "Stop"
Set-Location "C:\Users\sozi\Desktop\academic-timetabler"

$file = "src\features\units\unit-table.tsx"
if (-not (Test-Path -LiteralPath $file)) { throw "Unit table not found: $file" }

$utf8 = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText((Resolve-Path $file))

Write-Host ""
Write-Host "Applying v12.14.14 Compact Contact Hours Column..." -ForegroundColor Cyan

if ($content -match "header:\s*'Contact hours'") {
    Write-Host "Contact hours column already exists. No duplicate added." -ForegroundColor Yellow
}
else {
    # Insert immediately before the Timetable column.
    $marker = "  {`n    header: 'Timetable',"
    $markerCRLF = "  {`r`n    header: 'Timetable',"

    $column = @'
  {
    header: 'Contact hours',
    size: 105,
    minSize: 96,
    cell: ({ row }) => {
      const hours =
        row.original.theoryHours +
        row.original.practicalHours;

      return (
        <span className="whitespace-nowrap text-sm font-medium text-text-primary">
          {hours} {hours === 1 ? 'hr' : 'hrs'}
        </span>
      );
    },
  },

'@

    if ($content.Contains($marker)) {
        $content = $content.Replace($marker, $column + $marker)
    }
    elseif ($content.Contains($markerCRLF)) {
        $content = $content.Replace($markerCRLF, $column + $markerCRLF)
    }
    else {
        # Adaptive fallback: find the column object containing the Timetable header.
        $idx = $content.IndexOf("header: 'Timetable'")
        if ($idx -lt 0) {
            throw "Could not locate the Timetable column. No file was changed."
        }

        $start = $content.LastIndexOf("  {", $idx)
        if ($start -lt 0) {
            throw "Could not locate the start of the Timetable column. No file was changed."
        }

        $content = $content.Substring(0, $start) + $column + $content.Substring($start)
    }
}

# Keep Unit compact if an older wider value survived.
$content = $content.Replace("size: 340,`r`n    minSize: 280,", "size: 250,`r`n    minSize: 210,")
$content = $content.Replace("size: 340,`n    minSize: 280,", "size: 250,`n    minSize: 210,")
$content = $content.Replace(
    "w-[280px] min-w-[280px] max-w-[360px]",
    "w-[220px] min-w-[220px] max-w-[270px]"
)

if ($content -notmatch "header:\s*'Contact hours'") {
    throw "Contact hours column verification failed. No file was written."
}
if ($content -notmatch 'row\.original\.theoryHours' -or
    $content -notmatch 'row\.original\.practicalHours') {
    throw "Contact-hour calculation verification failed. No file was written."
}

[System.IO.File]::WriteAllText((Resolve-Path $file), $content, $utf8)

Write-Host "Added compact Contact hours column." -ForegroundColor Green
Write-Host "Value = theory hours + practical hours." -ForegroundColor Gray
Write-Host "Unit column remains compact." -ForegroundColor Gray
Write-Host "No database or scheduling logic changed." -ForegroundColor Cyan
