$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$file = "src\app\(dashboard)\students\unit-registration\page.tsx"

if (-not (Test-Path $file)) {
    throw "Could not find $file"
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText((Resolve-Path $file))

Write-Host ""
Write-Host "Repairing v12.12.0 Unit Registration page JSX..." -ForegroundColor Cyan

$badBlock = @'
      <div className="mb-4 flex justify-end">
        <Link
          href="/students/unit-registration/batch"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Batch registration
        </Link>
      </div>

'@

if (-not $content.Contains($badBlock)) {
    throw "The v12.12.0 injected Batch registration block was not found. No file was changed."
}

# Remove the misplaced sibling JSX block.
$content = $content.Replace($badBlock, "")

# Remove Link import only if it is no longer used anywhere in this file.
if ($content -notmatch "<Link[\s>]") {
    $content = $content.Replace("import Link from 'next/link';" + [Environment]::NewLine, "")
    $content = $content.Replace("import Link from 'next/link';`n", "")
    $content = $content.Replace("import Link from 'next/link';`r`n", "")
}

[System.IO.File]::WriteAllText(
    (Resolve-Path $file),
    $content,
    $utf8
)

Write-Host "Misplaced JSX removed." -ForegroundColor Green

# Add a safe, dedicated navigation entry as a small route card component
# that can be imported later without touching conditional return branches.
$navFile = "src\features\student-unit-registration\batch-registration-link.tsx"

$nav = @'
import Link from 'next/link';

export function BatchRegistrationLink() {
  return (
    <Link
      href="/students/unit-registration/batch"
      className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
    >
      Batch registration
    </Link>
  );
}
'@

$navParent = Split-Path -Parent $navFile
if (-not (Test-Path $navParent)) {
    New-Item -ItemType Directory -Path $navParent -Force | Out-Null
}

[System.IO.File]::WriteAllText(
    (Join-Path $PWD.Path $navFile),
    $nav,
    $utf8
)

Write-Host "Reusable BatchRegistrationLink component created." -ForegroundColor Green
Write-Host ""
Write-Host "v12.12.1 JSX repair applied successfully." -ForegroundColor Green
Write-Host "Batch route remains available at /students/unit-registration/batch" -ForegroundColor Cyan
