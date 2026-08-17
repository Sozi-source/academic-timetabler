$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$actions = "src\features\imports\units\actions.ts"

if (-not (Test-Path $actions)) {
    throw "Could not find $actions. Run this patch from the project root after extracting it there."
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText(
    (Resolve-Path $actions),
    $utf8
)

Write-Host ""
Write-Host "Patching Units importer duplicate reconciliation..." -ForegroundColor Cyan

# ============================================================
# A. VALIDATION/STAGING: reconcile AFTER staged rows exist and
# BEFORE the browser is sent to the review page.
# ============================================================

$stageMarker = @'
  revalidatePath(
    `/timetable/units/import/${batch.id}`,
  );

  return {
    status: 'success',
    message:
      'Units workbook validated successfully.',
    batchId: batch.id,
  };
'@

$stageReplacement = @'
  const {
    error: duplicateReconciliationError,
  } = await supabase.rpc(
    'reconcile_unit_import_duplicates',
    {
      target_batch_id: batch.id,
    },
  );

  if (duplicateReconciliationError) {
    return {
      status: 'error',
      message:
        `Units database duplicate reconciliation failed: ${duplicateReconciliationError.message}`,
    };
  }

  revalidatePath(
    `/timetable/units/import/${batch.id}`,
  );

  return {
    status: 'success',
    message:
      'Units workbook validated successfully.',
    batchId: batch.id,
  };
'@

if ($content.Contains($stageMarker)) {
    $content = $content.Replace(
        $stageMarker,
        $stageReplacement
    )
    Write-Host "  [OK] Validation now reconciles database code/name duplicates." -ForegroundColor Green
}
elseif ($content.Contains("'reconcile_unit_import_duplicates'")) {
    Write-Host "  [SKIP] Validation reconciliation already present." -ForegroundColor DarkGray
}
else {
    throw "Could not locate the Units validation completion block. No source changes were written."
}

# ============================================================
# B. CONFIRMATION: call the SAFE wrapper instead of the raw
# import RPC, and stop for review if anything was reclassified.
# ============================================================

$oldRpc = @'
  } = await supabase.rpc(
    'import_valid_unit_rows',
    {
      target_batch_id: batchId,
    },
  );
'@

$newRpc = @'
  } = await supabase.rpc(
    'safe_import_valid_unit_rows',
    {
      target_batch_id: batchId,
    },
  );
'@

if ($content.Contains($oldRpc)) {
    $content = $content.Replace(
        $oldRpc,
        $newRpc
    )
    Write-Host "  [OK] Confirmation now uses safe database preflight." -ForegroundColor Green
}
elseif ($content.Contains("'safe_import_valid_unit_rows'")) {
    Write-Host "  [SKIP] Safe confirmation RPC already present." -ForegroundColor DarkGray
}
else {
    throw "Could not locate import_valid_unit_rows RPC call. No source changes were written."
}

# Insert reclassification guard immediately after the existing
# result-null check and before revalidation/success handling.
$guardAnchor = @'
  revalidatePath('/dashboard');
'@

$guard = @'
  const reclassifiedCount =
    Number(
      (
        result as {
          reclassified_count?: number;
        }
      ).reclassified_count ?? 0,
    );

  if (reclassifiedCount > 0) {
    revalidatePath(
      `/timetable/units/import/${batchId}`,
    );

    return {
      status: 'error',
      message:
        `${reclassifiedCount} row${
          reclassifiedCount === 1 ? '' : 's'
        } matched an existing Unit Code or Unit Name and ${
          reclassifiedCount === 1 ? 'has' : 'have'
        } been moved to Duplicates. Review the updated batch, then confirm the remaining Ready rows.`,
      batchId,
      importedCount: 0,
      skippedCount: reclassifiedCount,
      failedCount: 0,
    };
  }

  revalidatePath('/dashboard');
'@

if (-not $content.Contains("reclassifiedCount =")) {
    $confirmStart = $content.IndexOf(
        "export async function confirmUnitImportAction"
    )

    if ($confirmStart -lt 0) {
        throw "Could not locate confirmUnitImportAction."
    }

    $anchorPos = $content.IndexOf(
        $guardAnchor,
        $confirmStart
    )

    if ($anchorPos -lt 0) {
        throw "Could not locate confirmation revalidation anchor."
    }

    $content =
        $content.Substring(0, $anchorPos) +
        $guard +
        $content.Substring(
            $anchorPos + $guardAnchor.Length
        )

    Write-Host "  [OK] Confirmation stops for review when new duplicates are found." -ForegroundColor Green
}
else {
    Write-Host "  [SKIP] Reclassification review guard already present." -ForegroundColor DarkGray
}

[System.IO.File]::WriteAllText(
    (Resolve-Path $actions),
    $content,
    $utf8
)

Write-Host ""
Write-Host "v12.8.7 source patch applied." -ForegroundColor Green
