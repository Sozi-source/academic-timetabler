$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$file = "src\features\units\unit-table.tsx"

if (-not (Test-Path $file)) {
    throw "Could not find $file"
}

$utf8 = New-Object System.Text.UTF8Encoding($false)

$content = [System.IO.File]::ReadAllText(
    (Resolve-Path $file),
    $utf8
)

Write-Host ""
Write-Host "Applying compact Programme-code Units table UI..." -ForegroundColor Cyan

# ============================================================
# 1. Replace the Programme table column renderer.
#
# The registry does not need the full programme name repeated
# on every row. Use only the official short code (CHN, CND,
# DHN, DND, DNDT, etc.) and keep the column compact.
# ============================================================

$programmePattern = '(?s)\{\s*id:\s*[''"]programme[''"],\s*accessorFn:\s*\(row\)\s*=>.*?header:\s*[''"]Programme[''"],\s*cell:\s*\(\{\s*row\s*\}\)\s*=>\s*\(.*?\),\s*\},'

$programmeReplacement = @'
{
    id: 'programme',
    accessorFn: (row) =>
      row.programme?.code ?? '',
    header: 'Programme',
    size: 92,
    minSize: 82,
    maxSize: 110,
    cell: ({ row }) => (
      <div
        className="min-w-[72px] whitespace-nowrap pr-4"
        title={
          row.original.programme?.name ??
          'Programme unavailable'
        }
      >
        <span className="inline-flex rounded-md border border-border bg-surface-subtle px-2 py-1 text-xs font-bold tracking-wide text-text-primary">
          {row.original.programme?.code ?? '—'}
        </span>
      </div>
    ),
  },
'@

$matches = [regex]::Matches(
    $content,
    $programmePattern
)

if ($matches.Count -ne 1) {
    throw "Expected exactly one Programme column definition in $file, found $($matches.Count). No file was changed."
}

$content = [regex]::Replace(
    $content,
    $programmePattern,
    [System.Text.RegularExpressions.MatchEvaluator]{
        param($match)
        return $programmeReplacement
    },
    1
)

# ============================================================
# 2. Ensure the Unit cell owns enough width so long unit names
# wrap inside their own column rather than colliding visually
# with Programme.
# ============================================================

$unitPattern = '(?s)(accessorKey:\s*[''"]name[''"],\s*header:\s*[''"]Unit[''"],\s*cell:\s*\(\{\s*row\s*\}\)\s*=>\s*\(\s*<div)(\s+className="[^"]*")?'

if ([regex]::IsMatch($content, $unitPattern)) {
    $content = [regex]::Replace(
        $content,
        $unitPattern,
        {
            param($m)

            $prefix = $m.Groups[1].Value
            $class = $m.Groups[2].Value

            if ($class) {
                $existing = $class -replace '^\s+className="', '' -replace '"$', ''
                if ($existing -notmatch 'min-w-\[') {
                    $existing = "min-w-[220px] max-w-[320px] pr-6 " + $existing
                }
                return $prefix + ' className="' + $existing.Trim() + '"'
            }

            return $prefix + ' className="min-w-[220px] max-w-[320px] pr-6"'
        },
        1
    )

    Write-Host "  [OK] Unit column protected from adjacent-column overlap." -ForegroundColor Green
}
else {
    Write-Warning "Unit renderer shape was not changed; Programme compaction was still applied."
}

# ============================================================
# 3. Keep Programme filtering/search useful even though the
# visible cell now displays only the short code.
# ============================================================

# No business logic is changed. The accessor now indexes the
# programme code, which is what the user sees and searches for.

[System.IO.File]::WriteAllText(
    (Resolve-Path $file),
    $content,
    $utf8
)

Write-Host ""
Write-Host "v12.9.0 Units table Programme-code UI applied." -ForegroundColor Green
Write-Host "Programme cells now show only short codes such as DHN / CND / DNDT." -ForegroundColor DarkCyan
