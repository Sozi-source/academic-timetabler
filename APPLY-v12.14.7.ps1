$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$utf8 = New-Object System.Text.UTF8Encoding($false)

Write-Host ""
Write-Host "Applying v12.14.7 Overflow Menu JSX Repair..." -ForegroundColor Cyan

$files = @(
    "src\features\units\unit-table.tsx",
    "src\features\cohorts\cohort-table.tsx",
    "src\features\programmes\programme-table.tsx"
)

foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        throw "Required file not found: $file"
    }

    $path = (Resolve-Path $file).Path
    $content = [System.IO.File]::ReadAllText($path)

    $bad = 'aria-label={Actions for ${row.original.name}}'
    $good = 'aria-label={`Actions for ${row.original.name}`}'

    if ($content.Contains($bad)) {
        $content = $content.Replace($bad, $good)

        [System.IO.File]::WriteAllText(
            $path,
            $content,
            $utf8
        )

        Write-Host "Repaired JSX interpolation: $file" -ForegroundColor Green
    }
    elseif ($content.Contains($good)) {
        Write-Host "Already repaired: $file" -ForegroundColor DarkGray
    }
    else {
        throw "Expected malformed overflow-menu aria-label was not found in $file"
    }
}

Write-Host ""
Write-Host "Checking repaired overflow menus..." -ForegroundColor Cyan

$remaining = Get-ChildItem `
    ".\src\features\units\unit-table.tsx",
    ".\src\features\cohorts\cohort-table.tsx",
    ".\src\features\programmes\programme-table.tsx" |
    Select-String `
        -SimpleMatch `
        -Pattern 'aria-label={Actions for ${row.original.name}}'

if ($remaining) {
    $remaining | Format-Table -AutoSize
    throw "Malformed JSX remains."
}

Write-Host ""
Write-Host "v12.14.7 source repair completed." -ForegroundColor Green
Write-Host "Run npm run typecheck next." -ForegroundColor Yellow
