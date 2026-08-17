$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$source = "supabase\migrations\20260802132136_add_unit_import_transaction.sql"
if (-not (Test-Path $source)) { throw "Could not find $source" }

function Write-Utf8WithoutBom {
    param([string]$Path,[string]$Content)

    $utf8 = New-Object System.Text.UTF8Encoding($false)

    $fullPath = if ([System.IO.Path]::IsPathRooted($Path)) {
        $Path
    }
    else {
        Join-Path -Path $PWD.Path -ChildPath $Path
    }

    $parent = Split-Path -Parent $fullPath

    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    [System.IO.File]::WriteAllText(
        $fullPath,
        $Content,
        $utf8
    )
}

$sql = Get-Content -LiteralPath $source -Raw

$pattern = '(?is)create\s+or\s+replace\s+function\s+public\.import_valid_unit_rows\s*\(\s*target_batch_id\s+uuid\s*\).*?\$\$;'
$m = [regex]::Match($sql,$pattern)
if (-not $m.Success) {
    throw "Could not extract public.import_valid_unit_rows(uuid)."
}

$f = $m.Value

$f = [regex]::Replace(
    $f,
    "(?is)(update\s+public\.import_batches\s+set\s+status\s*=\s*)'importing'(\s*,)",
    "`$1'importing'::public.import_batch_status`$2",
    1
)

$f = [regex]::Replace(
    $f,
    "(?is)(status\s*=\s*case\s+when\s+skipped_total\s*>\s*0\s+then\s*)'completed_with_errors'(\s+else\s*)'completed'(\s+end\s*,)",
    "`$1'completed_with_errors'::public.import_batch_status`$2'completed'::public.import_batch_status`$3",
    1
)

if ($f -notmatch "'importing'::public\.import_batch_status") {
    throw "Importing cast was not applied."
}
if ($f -notmatch "'completed_with_errors'::public\.import_batch_status") {
    throw "Completed-with-errors cast was not applied."
}
if ($f -notmatch "'completed'::public\.import_batch_status") {
    throw "Completed cast was not applied."
}

$out = @"
$f

revoke all
on function public.import_valid_unit_rows(uuid)
from public, anon;

grant execute
on function public.import_valid_unit_rows(uuid)
to authenticated;
"@

$dest = "supabase\migrations\20260817230000_rebuild_unit_import_enum_safe.sql"
Write-Utf8WithoutBom -Path $dest -Content ($out.Trim() + [Environment]::NewLine)

Write-Host ""
Write-Host "Created $dest" -ForegroundColor Green
Select-String -Path $dest -Pattern "import_batch_status" -Context 1,1
