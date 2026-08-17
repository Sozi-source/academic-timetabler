$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Text([string]$Path) {
    if (-not (Test-Path $Path)) {
        throw "Required file not found: $Path"
    }

    return [System.IO.File]::ReadAllText((Resolve-Path $Path))
}

function Write-Text([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText((Resolve-Path $Path), $Content, $utf8)
}

Write-Host ""
Write-Host "Applying v12.14.5 Compact Overflow Actions..." -ForegroundColor Cyan

# ============================================================
# Helper: replace a table Actions cell with a compact overflow menu
# where the existing action block is known and congested.
# ============================================================

function Patch-UnitsTable {
    $file = "src\features\units\unit-table.tsx"
    $content = Read-Text $file

    if ($content -match "MoreVertical") {
        Write-Host "Units table already appears patched." -ForegroundColor DarkGray
        return
    }

    $content = $content.Replace(
        "  Pencil,",
        "  MoreVertical,`n  Pencil,"
    )

    $old = @'
      return (
        <div className="flex min-w-max flex-wrap justify-end gap-2">
          <Link
            href={`/timetable/units/${row.original.id}/edit`}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
          >
            <Pencil
              className="size-3.5"
              aria-hidden="true"
            />
            Edit
          </Link>

          <form
            action={
              setUnitTimetableAvailabilityAction
            }
          >
            <input
              type="hidden"
              name="id"
              value={row.original.id}
            />

            <input
              type="hidden"
              name="isTimetableAvailable"
              value={
                row.original.isTimetableAvailable
                  ? 'false'
                  : 'true'
              }
            />

            <Button
              type="submit"
              variant="outline"
              size="sm"
              leadingIcon={
                row.original.isTimetableAvailable ? (
                  <CalendarX2
                    className="size-3.5"
                    aria-hidden="true"
                  />
                ) : (
                  <CalendarCheck2
                    className="size-3.5"
                    aria-hidden="true"
                  />
                )
              }
            >
              {row.original.isTimetableAvailable
                ? 'Unavailable'
                : 'Available'}
            </Button>
          </form>

          <form action={setUnitActiveAction}>
            <input
              type="hidden"
              name="id"
              value={row.original.id}
            />

            <input
              type="hidden"
              name="isActive"
              value={
                row.original.isActive
                  ? 'false'
                  : 'true'
              }
            />

            <Button
              type="submit"
              variant="outline"
              size="sm"
              leadingIcon={
                row.original.isActive ? (
                  <CircleOff
                    className="size-3.5"
                    aria-hidden="true"
                  />
                ) : (
                  <CircleCheck
                    className="size-3.5"
                    aria-hidden="true"
                  />
                )
              }
            >
              {row.original.isActive
                ? 'Deactivate'
                : 'Activate'}
            </Button>
          </form>
        </div>
      );
'@

    $new = @'
      return (
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

          <div className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
            <Link
              href={`/timetable/units/${row.original.id}/edit`}
              className="flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
            >
              <Pencil
                className="size-3.5"
                aria-hidden="true"
              />
              Edit
            </Link>

            <form action={setUnitTimetableAvailabilityAction}>
              <input type="hidden" name="id" value={row.original.id} />
              <input
                type="hidden"
                name="isTimetableAvailable"
                value={row.original.isTimetableAvailable ? 'false' : 'true'}
              />
              <button
                type="submit"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
              >
                {row.original.isTimetableAvailable ? (
                  <CalendarX2 className="size-3.5" aria-hidden="true" />
                ) : (
                  <CalendarCheck2 className="size-3.5" aria-hidden="true" />
                )}
                {row.original.isTimetableAvailable
                  ? 'Remove availability'
                  : 'Make available'}
              </button>
            </form>

            <form action={setUnitActiveAction}>
              <input type="hidden" name="id" value={row.original.id} />
              <input
                type="hidden"
                name="isActive"
                value={row.original.isActive ? 'false' : 'true'}
              />
              <button
                type="submit"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
              >
                {row.original.isActive ? (
                  <CircleOff className="size-3.5" aria-hidden="true" />
                ) : (
                  <CircleCheck className="size-3.5" aria-hidden="true" />
                )}
                {row.original.isActive
                  ? 'Deactivate'
                  : 'Activate'}
              </button>
            </form>
          </div>
        </details>
      );
'@

    if (-not $content.Contains($old)) {
        throw "Units Actions block did not match expected source."
    }

    $content = $content.Replace($old, $new)
    Write-Text $file $content
    Write-Host "Curriculum Units actions compacted." -ForegroundColor Green
}

function Patch-CohortTable {
    $file = "src\features\cohorts\cohort-table.tsx"
    $content = Read-Text $file

    if ($content -match "MoreVertical") {
        Write-Host "Cohort table already appears patched." -ForegroundColor DarkGray
        return
    }

    $content = $content.Replace(
        "  Pencil,",
        "  MoreVertical,`n  Pencil,"
    )

    $oldStart = '<div className="flex min-w-max flex-wrap justify-end gap-2">'
    if (-not $content.Contains($oldStart)) {
        throw "Cohort Actions block start was not found."
    }

    $pattern = [System.Text.RegularExpressions.Regex]::new(
        '<div className="flex min-w-max flex-wrap justify-end gap-2">[\s\S]*?</div>\s*\);\s*\},',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    $match = $pattern.Match($content)

    if (-not $match.Success) {
        throw "Cohort Actions block could not be isolated."
    }

    $replacement = @'
<details className="relative">
          <summary
            className="inline-flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-border-strong bg-surface text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
            aria-label={`Actions for ${row.original.name}`}
          >
            <MoreVertical className="size-4" aria-hidden="true" />
          </summary>

          <div className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
            <Link
              href={`/timetable/cohorts/${row.original.id}/edit`}
              className="flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit
            </Link>

            {canToggleAvailability ? (
              <form action={setCohortTimetableAvailabilityAction}>
                <input type="hidden" name="id" value={row.original.id} />
                <input
                  type="hidden"
                  name="isTimetableAvailable"
                  value={row.original.isTimetableAvailable ? 'false' : 'true'}
                />
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
                >
                  {row.original.isTimetableAvailable ? (
                    <CalendarX2 className="size-3.5" aria-hidden="true" />
                  ) : (
                    <CalendarCheck2 className="size-3.5" aria-hidden="true" />
                  )}
                  {row.original.isTimetableAvailable
                    ? 'Remove availability'
                    : 'Make available'}
                </button>
              </form>
            ) : null}

            <form action={setCohortStatusAction}>
              <input type="hidden" name="id" value={row.original.id} />
              <div className="border-t border-border px-3 py-2">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Status
                </label>
                <Select
                  name="status"
                  aria-label={`Change status for ${row.original.name}`}
                  defaultValue={row.original.status}
                  className="h-8 w-full text-xs"
                  onChange={(event) => {
                    event.currentTarget.form?.requestSubmit();
                  }}
                >
                  {cohortStatusOptions.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </form>
          </div>
        </details>
      );
    },
'@

    $content =
        $content.Substring(0, $match.Index) +
        $replacement +
        $content.Substring($match.Index + $match.Length)

    Write-Text $file $content
    Write-Host "Classes and Cohorts actions compacted." -ForegroundColor Green
}

function Patch-ProgrammeTable {
    $file = Get-ChildItem ".\src\features\programmes" -File -Filter "*table*.tsx" -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if (-not $file) {
        Write-Warning "Programme table file not found; skipped."
        return
    }

    $content = [System.IO.File]::ReadAllText($file.FullName)

    if ($content -match "MoreVertical") {
        Write-Host "Programme table already appears patched." -ForegroundColor DarkGray
        return
    }

    if ($content.Contains("  Pencil,")) {
        $content = $content.Replace(
            "  Pencil,",
            "  MoreVertical,`n  Pencil,"
        )
    }

    $pattern = [System.Text.RegularExpressions.Regex]::new(
        '<div className="flex min-w-max flex-wrap justify-end gap-2">[\s\S]*?</div>\s*\)\s*,',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    $match = $pattern.Match($content)

    if (-not $match.Success) {
        Write-Warning "Programme actions block not matched safely; skipped to avoid regression."
        return
    }

    # Preserve the inner existing actions by placing them in dropdown.
    $inner = $match.Value
    $inner = $inner -replace '^<div className="flex min-w-max flex-wrap justify-end gap-2">', ''
    $inner = $inner -replace '</div>\s*\)\s*,\s*$', ''

    $replacement = @"
<details className="relative">
          <summary
            className="inline-flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-border-strong bg-surface text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
            aria-label={`Actions for `${row.original.name}``}
          >
            <MoreVertical className="size-4" aria-hidden="true" />
          </summary>

          <div className="absolute right-0 z-30 mt-1 w-56 space-y-1 rounded-xl border border-border bg-surface p-2 shadow-lg">
$inner
          </div>
        </details>
      ),
"@

    $content =
        $content.Substring(0, $match.Index) +
        $replacement +
        $content.Substring($match.Index + $match.Length)

    [System.IO.File]::WriteAllText(
        $file.FullName,
        $content,
        $utf8
    )

    Write-Host "Programmes actions compacted." -ForegroundColor Green
}

Patch-UnitsTable
Patch-CohortTable
Patch-ProgrammeTable

Write-Host ""
Write-Host "v12.14.5 applied successfully." -ForegroundColor Green
Write-Host "No database changes were made." -ForegroundColor Cyan
Write-Host "Only congested listing-table action areas were compacted." -ForegroundColor Cyan
