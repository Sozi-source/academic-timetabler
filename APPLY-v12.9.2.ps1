$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$file = "src\features\units\unit-table.tsx"

if (-not (Test-Path $file)) {
    throw "Could not find $file"
}

$path = (Resolve-Path $file).Path
$utf8 = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText($path)

Write-Host ""
Write-Host "Applying v12.9.2 Units registry UI fix..." -ForegroundColor Cyan

$oldProgramme = @'
  {
    id: 'programme',
    accessorFn: (row) =>
      row.programme?.name ?? '',
    header: 'Programme',
    size: 220,
    minSize: 180,
    cell: ({ row }) => (
      <div className="min-w-56">
        <p className="font-medium text-text-primary">
          {row.original.programme?.name ??
            'Programme unavailable'}
        </p>

        <p className="mt-1 text-[10px] leading-4 text-text-muted">
          {row.original.programme?.code ??
            row.original.programmeId}
        </p>
      </div>
    ),
  },
'@

$newProgramme = @'
  {
    id: 'programme',
    accessorFn: (row) =>
      row.programme?.code ?? '',
    header: 'Programme',
    size: 90,
    minSize: 80,
    maxSize: 105,
    cell: ({ row }) => (
      <span
        className="whitespace-nowrap font-semibold text-text-primary"
        title={
          row.original.programme?.name ??
          'Programme unavailable'
        }
      >
        {row.original.programme?.code ?? '-'}
      </span>
    ),
  },
'@

if (-not $content.Contains($oldProgramme)) {
    throw "Exact Programme column block was not found. No file was changed."
}

$content = $content.Replace(
    $oldProgramme,
    $newProgramme
)

$oldUnit = @'
    size: 230,
    minSize: 190,
    cell: ({ row }) => (
      <div className="min-w-64">
'@

$newUnit = @'
    size: 280,
    minSize: 230,
    cell: ({ row }) => (
      <div className="min-w-0 pr-5">
'@

if (-not $content.Contains($oldUnit)) {
    throw "Exact Unit column sizing block was not found. No file was changed."
}

$content = $content.Replace(
    $oldUnit,
    $newUnit
)

[System.IO.File]::WriteAllText(
    $path,
    $content,
    $utf8
)

Write-Host ""
Write-Host "v12.9.2 applied successfully." -ForegroundColor Green
Write-Host "Programme now displays short code only." -ForegroundColor Cyan
Write-Host "Unit column widened and separated cleanly." -ForegroundColor Cyan
