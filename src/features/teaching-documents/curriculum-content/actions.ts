'use server';

import { revalidatePath } from 'next/cache';
import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';
import {
  matchCurriculumUnitsV5,
  unresolvedUnitsV5,
} from '../curriculum-import-v5/staging';
import {
  parseCurriculumWorkbookV5,
} from '../curriculum-import-v5/xlsx';
import {
  type CurriculumImportBatchPayloadV5,
} from '../curriculum-import-v5/schema';
import type {
  CurriculumContentImportState,
} from './state';

export async function stageCurriculumContentImportAction(
  _previous: CurriculumContentImportState,
  formData: FormData,
): Promise<CurriculumContentImportState> {
  const profile = await requireHodAccess();

  if (!profile.activeDepartmentId) {
    return {
      status: 'error',
      message:
        'No active department selected.',
    };
  }

  const file = formData.get('workbook');

  if (
    !(file instanceof File) ||
    file.size === 0
  ) {
    return {
      status: 'error',
      message:
        'Select an Excel workbook to import.',
    };
  }

  if (
    !file.name
      .toLowerCase()
      .endsWith('.xlsx')
  ) {
    return {
      status: 'error',
      message:
        'Curriculum Import V5 currently accepts Excel (.xlsx) files.',
    };
  }

  if (file.size > 25 * 1024 * 1024) {
    return {
      status: 'error',
      message:
        'Excel workbook exceeds the 25 MB limit.',
    };
  }

  let parsed;

  try {
    parsed = await parseCurriculumWorkbookV5(
      await file.arrayBuffer(),
      file.name,
    );
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Workbook could not be parsed.',
    };
  }

  const supabase = await createClient();

  const {
    data: systemUnits,
    error: unitsError,
  } = await supabase
    .from('units')
    .select('id,code,name')
    .eq('is_active', true);

  if (unitsError) {
    return {
      status: 'error',
      message: `System units could not be loaded: ${unitsError.message}`,
    };
  }

  const payload = matchCurriculumUnitsV5(
    parsed,
    (systemUnits ?? []).map((unit) => ({
      id: String(unit.id),
      code: String(unit.code),
      name: String(unit.name),
    })),
  );

  const unresolved =
    unresolvedUnitsV5(payload);

  const warningCount =
    payload.issues.filter(
      (issue) =>
        issue.severity === 'warning',
    ).length;

  const reviewCount =
    payload.issues.filter(
      (issue) =>
        issue.severity === 'review',
    ).length;

  const importableContent =
    payload.content.filter(
      (item) =>
        !item.excludedAsCalendarActivity,
    );

  const {
    data: batch,
    error: batchError,
  } = await supabase
    .from(
      'curriculum_content_import_batches',
    )
    .insert({
      department_id:
        profile.activeDepartmentId,
      original_file_name: file.name,
      template_version: '5',
      status: 'validated',
      payload,
      validation_summary: {
        engineVersion: 5,
        units: payload.units.length,
        matchedUnits:
          payload.units.length -
          unresolved.length,
        unresolvedUnits:
          unresolved.length,
        contentRows:
          importableContent.length,
        excludedCalendarRows:
          payload.content.length -
          importableContent.length,
        warnings: warningCount,
        reviewItems: reviewCount,
      },
      created_by: profile.id,
    })
    .select('id')
    .single();

  if (batchError || !batch) {
    return {
      status: 'error',
      message:
        batchError?.message ??
        'Import staging batch could not be created.',
    };
  }

  return {
    status: 'success',
    message:
      unresolved.length > 0
        ? `Workbook staged. ${unresolved.length} unit mapping(s) need review.`
        : 'Workbook staged successfully. Review before import.',
    batchId: String(batch.id),
  };
}

export async function updateCurriculumV5UnitMappingAction(
  formData: FormData,
) {
  await requireHodAccess();

  const batchId = String(
    formData.get('batchId') ?? '',
  ).trim();

  const sourceUnitKey = String(
    formData.get('sourceUnitKey') ?? '',
  ).trim();

  const targetUnitId = String(
    formData.get('targetUnitId') ?? '',
  ).trim();

  if (
    !batchId ||
    !sourceUnitKey ||
    !targetUnitId
  ) {
    throw new Error(
      'Missing curriculum mapping information.',
    );
  }

  const supabase = await createClient();

  const {
    data: batch,
    error: batchError,
  } = await supabase
    .from(
      'curriculum_content_import_batches',
    )
    .select('payload')
    .eq('id', batchId)
    .single();

  if (batchError || !batch?.payload) {
    throw new Error(
      batchError?.message ??
        'Import batch could not be loaded.',
    );
  }

  const {
    data: target,
    error: targetError,
  } = await supabase
    .from('units')
    .select('id,code,name')
    .eq('id', targetUnitId)
    .eq('is_active', true)
    .single();

  if (targetError || !target) {
    throw new Error(
      targetError?.message ??
        'Selected system unit could not be loaded.',
    );
  }

  const payload =
    batch.payload as CurriculumImportBatchPayloadV5;

  payload.units = payload.units.map(
    (unit) =>
      unit.sourceUnitKey ===
      sourceUnitKey
        ? {
            ...unit,
            matchedUnitId: String(
              target.id,
            ),
            matchedUnitCode: String(
              target.code,
            ),
            matchedUnitName: String(
              target.name,
            ),
            matchMethod: 'manual',
          }
        : unit,
  );

  payload.issues = payload.issues.filter(
    (item) =>
      !(
        item.sourceUnitKey ===
          sourceUnitKey &&
        [
          'unit_not_mapped',
          'ambiguous_code',
          'ambiguous_name',
          'missing_unit_code',
        ].includes(item.code)
      ),
  );

  const unresolved =
    unresolvedUnitsV5(payload);

  const { error: updateError } =
    await supabase
      .from(
        'curriculum_content_import_batches',
      )
      .update({
        payload,
        validation_summary: {
          engineVersion: 5,
          units: payload.units.length,
          matchedUnits:
            payload.units.length -
            unresolved.length,
          unresolvedUnits:
            unresolved.length,
          contentRows:
            payload.content.filter(
              (item) =>
                !item
                  .excludedAsCalendarActivity,
            ).length,
          excludedCalendarRows:
            payload.content.filter(
              (item) =>
                item
                  .excludedAsCalendarActivity,
            ).length,
          warnings:
            payload.issues.filter(
              (item) =>
                item.severity ===
                'warning',
            ).length,
          reviewItems:
            payload.issues.filter(
              (item) =>
                item.severity ===
                'review',
            ).length,
        },
      })
      .eq('id', batchId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath(
    `/teaching-documents/curriculum/import/${batchId}`,
  );
}

export async function confirmCurriculumContentImportAction(
  formData: FormData,
) {
  await requireHodAccess();

  const batchId = String(
    formData.get('batchId') ?? '',
  ).trim();

  if (!batchId) {
    throw new Error(
      'Missing curriculum import batch.',
    );
  }

  const supabase = await createClient();

  const {
    data: batch,
    error: batchError,
  } = await supabase
    .from(
      'curriculum_content_import_batches',
    )
    .select(
      'payload,validation_summary,status',
    )
    .eq('id', batchId)
    .single();

  if (batchError || !batch?.payload) {
    throw new Error(
      batchError?.message ??
        'Import batch could not be loaded.',
    );
  }

  const payload =
    batch.payload as CurriculumImportBatchPayloadV5;

  const unresolved =
    unresolvedUnitsV5(payload);

  if (
    payload.engineVersion !== 5
  ) {
    throw new Error(
      'This is not a Curriculum Import Engine V5 batch.',
    );
  }

  // V5 treats the batch payload as the versioned curriculum import record.
  // Final teaching-document generation can consume this imported snapshot
  // and distribute ordered content into the active academic period later.
  const {
    error: updateError,
  } = await supabase
    .from(
      'curriculum_content_import_batches',
    )
    .update({
      status: 'imported',
      validation_summary: {
        ...(batch.validation_summary ??
          {}),
        engineVersion: 5,
        importedAt:
          new Date().toISOString(),
        importedWithReviewItems:
          unresolved.length > 0 ||
          payload.issues.some(
            (issue) =>
              issue.severity === 'review',
          ),
        unresolvedUnitsAtImport:
          unresolved.length,
        reviewItemsAtImport:
          payload.issues.filter(
            (issue) =>
              issue.severity === 'review',
          ).length,
      },
    })
    .eq('id', batchId);

  if (updateError) {
    throw new Error(
      updateError.message,
    );
  }

  revalidatePath(
    '/teaching-documents/curriculum',
  );
  revalidatePath(
    '/teaching-documents/curriculum/import',
  );
  revalidatePath(
    `/teaching-documents/curriculum/import/${batchId}`,
  );

  // Form actions must resolve to void.
  // Revalidation above is sufficient; the review page will refresh to the imported state.
}
