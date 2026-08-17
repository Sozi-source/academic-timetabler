'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import {
  ImportWorkbookError,
  markDuplicateImportRows,
  validateImportFileDescriptor,
  validateParsedImportRow,
} from '@/features/imports';
import { curriculumImportTemplate } from '@/features/imports/templates/curriculum';
import { readImportWorkbook } from '@/features/imports/workbook-reader';
import { createClient } from '@/lib/supabase/server';

import type {
  CurriculumImportActionState,
  CurriculumImportRpcResult,
  NormalizedCurriculumImportRow,
} from './types';
import { curriculumImportRowSchema } from './validation';

function key(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function stageNumber(stage: string) {
  const match = /^Y([1-3])S([1-3])$/.exec(stage);
  if (!match) return null;
  return (Number(match[1]) - 1) * 3 + Number(match[2]);
}

const maximumStageByProgramme: Record<string, number> = {
  CHN: 6,
  CND: 6,
  DHN: 9,
  DND: 9,
  DNDT: 4,
};

export async function stageCurriculumImportAction(
  _previousState: CurriculumImportActionState,
  formData: FormData,
): Promise<CurriculumImportActionState> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) {
    return { status: 'error', message: 'No active department selected.' };
  }

  const uploadedFile = formData.get('workbook');
  if (!(uploadedFile instanceof File)) {
    return { status: 'error', message: 'Select a Curriculum Excel workbook.' };
  }

  try {
    validateImportFileDescriptor({
      name: uploadedFile.name,
      size: uploadedFile.size,
      type: uploadedFile.type,
    });
  } catch (error) {
    if (error instanceof ImportWorkbookError) {
      return { status: 'error', message: error.message, details: error.details };
    }
    return { status: 'error', message: 'The workbook could not be validated.' };
  }

  let workbook;
  try {
    workbook = await readImportWorkbook({
      fileName: uploadedFile.name,
      buffer: await uploadedFile.arrayBuffer(),
      definition: curriculumImportTemplate,
    });
  } catch (error) {
    if (error instanceof ImportWorkbookError) {
      return { status: 'error', message: error.message, details: error.details };
    }
    return { status: 'error', message: 'The Curriculum workbook could not be read.' };
  }

  const results = markDuplicateImportRows<NormalizedCurriculumImportRow>(
    workbook.rows.map((row) =>
      validateParsedImportRow<NormalizedCurriculumImportRow>({
        row,
        schema: curriculumImportRowSchema,
        duplicateKey: (item) => `${key(item.programmeCode)}:${key(item.code)}`,
      }),
    ),
  );

  const supabase = await createClient();

  const { data: programmes, error: programmeError } = await supabase
    .from('programmes')
    .select('id,code,is_active,department_id')
    .eq('department_id', profile.activeDepartmentId);

  if (programmeError) {
    return { status: 'error', message: `Programmes could not be checked: ${programmeError.message}` };
  }

  const programmeMap = new Map(
    (programmes ?? []).map((programme) => [key(programme.code), programme]),
  );

  const { data: existingUnits, error: unitError } = await supabase
    .from('units')
    .select('id,programme_id,code,name');

  if (unitError) {
    return { status: 'error', message: `Existing units could not be checked: ${unitError.message}` };
  }

  const byCode = new Map(
    (existingUnits ?? []).map((unit) => [`${unit.programme_id}:${key(unit.code)}`, unit]),
  );
  const byName = new Map(
    (existingUnits ?? []).map((unit) => [`${unit.programme_id}:${key(unit.name)}`, unit]),
  );

  for (const result of results) {
    if (result.status !== 'valid' || !result.normalizedData) continue;
    const item = result.normalizedData;

    const programme = programmeMap.get(key(item.programmeCode));
    if (!programme) {
      result.status = 'invalid';
      result.fieldErrors.programmeCode = ['No active department programme exists with this Programme Code.'];
      continue;
    }

    if (!programme.is_active) {
      result.status = 'invalid';
      result.fieldErrors.programmeCode = ['The programme is inactive.'];
      continue;
    }

    const stageNo = stageNumber(item.stage);
    const maxStage = maximumStageByProgramme[item.programmeCode];

    if (!stageNo || !maxStage || stageNo > maxStage) {
      result.status = 'invalid';
      result.fieldErrors.stage = [
        maxStage
          ? `${item.programmeCode} supports stages only up to ${
              item.programmeCode === 'CHN' || item.programmeCode === 'CND'
                ? 'Y2S3'
                : item.programmeCode === 'DNDT'
                  ? 'Y2S1'
                  : 'Y3S3'
            }.`
          : 'This programme is not configured for standard curriculum stages.',
      ];
      continue;
    }

    item.programmeId = programme.id;
    item.stageNumber = stageNo;

    const codeMatch = byCode.get(`${programme.id}:${key(item.code)}`);
    const nameMatch = byName.get(`${programme.id}:${key(item.name)}`);

    if (codeMatch) {
      item.unitId = codeMatch.id;
      item.resolution =
        key(codeMatch.name) === key(item.name)
          ? 'match_existing'
          : 'normalize_existing';

      if (nameMatch && nameMatch.id !== codeMatch.id) {
        result.status = 'invalid';
        result.rowErrors.push(
          'The official Unit Name already belongs to a different Unit Code in this programme.',
        );
      }
      continue;
    }

    if (nameMatch) {
      result.status = 'invalid';
      result.rowErrors.push(
        `Unit name already exists under another code (${nameMatch.code}). Confirm the official Unit Code before import.`,
      );
      continue;
    }

    item.resolution = 'create_new';
  }

  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .insert({
      department_id: profile.activeDepartmentId,
      entity_type: 'curriculum',
      template_version: workbook.metadata.templateVersion,
      original_file_name: workbook.fileName,
      file_size_bytes: workbook.fileSizeBytes,
      status: 'validating',
      validation_summary: { warnings: workbook.warnings },
      import_options: {
        workflow: 'authoritative_curriculum',
        unitMatch: 'programme_code_plus_unit_code',
        fixedHeaders: true,
        csvAllowed: false,
      },
    })
    .select('id')
    .single();

  if (batchError || !batch) {
    return { status: 'error', message: batchError?.message ?? 'Curriculum import batch could not be created.' };
  }

  const stagedRows = results.map((result) => ({
    import_batch_id: batch.id,
    source_row_number: result.sourceRowNumber,
    status: result.status,
    source_data: result.sourceData,
    normalized_data: result.normalizedData ?? {},
    field_errors: result.fieldErrors,
    row_errors: result.rowErrors,
    duplicate_key: result.duplicateKey,
  }));

  const { error: stagingError } = await supabase.from('import_rows').insert(stagedRows);

  if (stagingError) {
    await supabase
      .from('import_batches')
      .update({ status: 'failed', failure_message: stagingError.message })
      .eq('id', batch.id);

    return { status: 'error', message: `Curriculum rows could not be staged: ${stagingError.message}` };
  }

  const { error: finalizeError } = await supabase
    .from('import_batches')
    .update({
      status: 'validated',
      validation_summary: {
        warnings: workbook.warnings,
        validatedAt: new Date().toISOString(),
      },
    })
    .eq('id', batch.id);

  if (finalizeError) {
    return { status: 'error', message: `Curriculum batch could not be finalized: ${finalizeError.message}` };
  }

  revalidatePath(`/students/unit-registration/curriculum/import/${batch.id}`);

  return {
    status: 'success',
    message: 'Curriculum workbook validated successfully.',
    batchId: batch.id,
  };
}

export async function confirmCurriculumImportAction(
  _previousState: CurriculumImportActionState,
  formData: FormData,
): Promise<CurriculumImportActionState> {
  await requireHodAccess();

  const batchId = formData.get('batchId');
  if (typeof batchId !== 'string' || !batchId.trim()) {
    return { status: 'error', message: 'The Curriculum import batch identifier is invalid.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('import_valid_curriculum_rows', {
    target_batch_id: batchId,
  });

  if (error) return { status: 'error', message: error.message || 'Curriculum import failed.' };

  const result = (data as CurriculumImportRpcResult[] | null)?.[0];
  if (!result) return { status: 'error', message: 'Curriculum import returned no result.' };

  revalidatePath('/students/unit-registration/stages');
  revalidatePath('/students/unit-registration');
  revalidatePath(`/students/unit-registration/curriculum/import/${batchId}`);
  revalidatePath('/timetable/units');

  return {
    status: 'success',
    message: `${result.imported_count} curriculum row${result.imported_count === 1 ? '' : 's'} committed successfully.`,
    batchId,
    importedCount: result.imported_count,
    skippedCount: result.skipped_count,
    failedCount: result.failed_count,
  };
}
