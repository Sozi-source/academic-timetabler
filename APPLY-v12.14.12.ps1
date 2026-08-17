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
Write-Host "Applying v12.14.12 Remove Room Preference Column..." -ForegroundColor Cyan

$file = "src\features\units\unit-table.tsx"
$content = Read-Text $file

# Remove the Room preference column structurally.
# Match the complete column object whose header is "Room preference".
$pattern = [System.Text.RegularExpressions.Regex]::new(
    "(?s)\{\s*(?:id:\s*'[^']+'\s*,\s*)?(?:accessorKey:\s*'[^']+'\s*,\s*)?(?:accessorFn:[\s\S]*?,\s*)?header:\s*'Room preference'\s*,[\s\S]*?\n\s*\},\s*(?=\n\s*\{)",
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

$match = $pattern.Match($content)

if (-not $match.Success) {
    # Fallback: locate by visible heading text and expand to nearest column object.
    $headerIndex = $content.IndexOf("header: 'Room preference'")

    if ($headerIndex -lt 0) {
        Write-Host "Room preference column is already absent." -ForegroundColor DarkGray
        exit 0
    }

    $start = $content.LastIndexOf("  {", $headerIndex)

    if ($start -lt 0) {
        throw "Could not locate start of Room preference column."
    }

    $nextColumn = $content.IndexOf("`n  {", $headerIndex + 1)

    if ($nextColumn -lt 0) {
        throw "Could not locate end of Room preference column."
    }

    $content =
        $content.Substring(0, $start) +
        $content.Substring($nextColumn)
}
else {
    $content =
        $content.Substring(0, $match.Index) +
        $content.Substring($match.Index + $match.Length)
}

# Safety checks.
if ($content.Contains("header: 'Room preference'")) {
    throw "Room preference header still exists after patch."
}

# Do not remove room-preference business logic or fields elsewhere.
# This patch intentionally changes only the table column.

Write-Text $file $content

Write-Host "Room preference column removed from Curriculum Units table." -ForegroundColor Green
Write-Host "Underlying room-preference data and scheduling logic were preserved." -ForegroundColor Cyan
Write-Host ""
Write-Host "v12.14.12 applied successfully." -ForegroundColor Green
