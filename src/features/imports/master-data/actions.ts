'use server';

import { revalidatePath } from 'next/cache';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  ImportWorkbookError,
  markDuplicateImportRows,
  validateImportFileDescriptor,
  validateParsedImportRow,
} from '@/features/imports';
import {
  cohortsImportTemplate,
  programmesImportTemplate,
} from '@/features/imports/templates';
import {
  readImportWorkbook,
} from '@/features/imports/workbook-reader';
import {
  createClient,
} from '@/lib/supabase/server';

import type {
  MasterDataImportActionState,
  MasterDataImportEntity,
  MasterDataImportRpcResult,
} from './types';
import {
  cohortImportRowSchema,
  programmeImportRowSchema,
} from './validation';

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function getEntity(
  formData: FormData,
): MasterDataImportEntity | null {
  const entity =
    formData.get('entityType');

  return entity === 'programmes' ||
    entity === 'cohorts'
    ? entity
    : null;
}

function entityLabel(
  entity: MasterDataImportEntity,
) {
  return entity === 'programmes'
    ? 'programmes'
    : 'cohorts';
}

export async function stageMasterDataImportAction(
  _previousState: MasterDataImportActionState,
  formData: FormData,
): Promise<MasterDataImportActionState> {
  await requireHodAccess();

  const entity = getEntity(formData);

  if (!entity) {
    return {
      status: 'error',
      message:
        'The selected import type is invalid.',
    };
  }

  const uploadedFile =
    formData.get('workbook');

  if (!(uploadedFile instanceof File)) {
    return {
      status: 'error',
      message: `Select a ${entityLabel(entity)} Excel workbook.`,
    };
  }

  try {
    validateImportFileDescriptor({
      name: uploadedFile.name,
      size: uploadedFile.size,
      type: uploadedFile.type,
    });
  }
  catch (error) {
    if (error instanceof ImportWorkbookError) {
      return {
        status: 'error',
        message: error.message,
        details: error.details,
      };
    }

    return {
      status: 'error',
      message:
        'The selected workbook could not be validated.',
    };
  }

  const definition =
    entity === 'programmes'
      ? programmesImportTemplate
      : cohortsImportTemplate;

  let workbook;

  try {
    workbook = await readImportWorkbook({
      fileName: uploadedFile.name,
      buffer:
        await uploadedFile.arrayBuffer(),
      definition,
    });
  }
  catch (error) {
    if (error instanceof ImportWorkbookError) {
      return {
        status: 'error',
        message: error.message,
        details: error.details,
      };
    }

    return {
      status: 'error',
      message:
        'The workbook could not be read.',
    };
  }

  const schema =
    entity === 'programmes'
      ? programmeImportRowSchema
      : cohortImportRowSchema;

  const validationResults =
    markDuplicateImportRows<Record<string, unknown>>(
      workbook.rows.map((row) =>
        validateParsedImportRow<
          Record<string, unknown>
        >({
          row,
          schema,
          duplicateKey: (record) =>
            `code:${normalize(String(record.code ?? ''))}`,
        }),
      ),
    );

  if (entity === 'programmes') {
    const nameIndexes =
      new Map<string, number[]>();

    validationResults.forEach(
      (result, index) => {
        if (
          result.status !== 'valid' ||
          !result.normalizedData
        ) {
          return;
        }

        const key = normalize(
          String(
            result.normalizedData.name,
          ),
        );

        const indexes =
          nameIndexes.get(key) ?? [];

        indexes.push(index);
        nameIndexes.set(key, indexes);
      },
    );

    for (const indexes of nameIndexes.values()) {
      if (indexes.length < 2) {
        continue;
      }

      for (const index of indexes) {
        validationResults[index].status =
          'duplicate';
        validationResults[index].rowErrors.push(
          'This programme name appears more than once in the workbook.',
        );
      }
    }
  }

  const supabase = await createClient();

  if (entity === 'programmes') {
    const { data, error } =
      await supabase
        .from('programmes')
        .select('code, name');

    if (error) {
      return {
        status: 'error',
        message:
          `Existing programmes could not be checked: ${error.message}`,
      };
    }

    const codes = new Set(
      (data ?? []).map((row) =>
        normalize(row.code),
      ),
    );
    const names = new Set(
      (data ?? []).map((row) =>
        normalize(row.name),
      ),
    );

    for (const result of validationResults) {
      if (
        result.status !== 'valid' ||
        !result.normalizedData
      ) {
        continue;
      }

      if (
        codes.has(
          normalize(
            String(result.normalizedData.code),
          ),
        ) ||
        names.has(
          normalize(
            String(result.normalizedData.name),
          ),
        )
      ) {
        result.status = 'duplicate';
        result.rowErrors.push(
          'A programme with this code or name already exists in the active department.',
        );
      }
    }
  }
  else {
    const [programmeResult, cohortResult] =
      await Promise.all([
        supabase
          .from('programmes')
          .select('code'),
        supabase
          .from('cohorts')
          .select('code'),
      ]);

    if (programmeResult.error || cohortResult.error) {
      return {
        status: 'error',
        message:
          programmeResult.error?.message ??
          cohortResult.error?.message ??
          'Existing cohort data could not be checked.',
      };
    }

    const programmeCodes = new Set(
      (programmeResult.data ?? []).map(
        (row) => normalize(row.code),
      ),
    );
    const cohortCodes = new Set(
      (cohortResult.data ?? []).map(
        (row) => normalize(row.code),
      ),
    );

    for (const result of validationResults) {
      if (
        result.status !== 'valid' ||
        !result.normalizedData
      ) {
        continue;
      }

      if (
        !programmeCodes.has(
          normalize(
            String(
              result.normalizedData.programmeCode,
            ),
          ),
        )
      ) {
        result.status = 'invalid';
        result.fieldErrors.programmeCode = [
          'No matching programme exists in the active department.',
        ];
      }
      else if (
        cohortCodes.has(
          normalize(
            String(result.normalizedData.code),
          ),
        )
      ) {
        result.status = 'duplicate';
        result.rowErrors.push(
          'A cohort with this code already exists.',
        );
      }
    }
  }

  const { data: batch, error: batchError } =
    await supabase
      .from('import_batches')
      .insert({
        entity_type: entity,
        template_version:
          workbook.metadata.templateVersion,
        original_file_name: workbook.fileName,
        file_size_bytes: workbook.fileSizeBytes,
        status: 'validating',
        validation_summary: {
          warnings: workbook.warnings,
          fixedHeaders: true,
        },
        import_options: {
          duplicateStrategy: 'skip',
          optionalCellsUseDefaults: true,
        },
      })
      .select('id')
      .single();

  if (batchError || !batch) {
    return {
      status: 'error',
      message:
        batchError?.message ??
        'The import batch could not be created.',
    };
  }

  const { error: rowInsertError } =
    await supabase
      .from('import_rows')
      .insert(
        validationResults.map((result) => ({
          import_batch_id: batch.id,
          source_row_number:
            result.sourceRowNumber,
          status: result.status,
          source_data: result.sourceData,
          normalized_data:
            result.normalizedData ?? {},
          field_errors: result.fieldErrors,
          row_errors: result.rowErrors,
          duplicate_key: result.duplicateKey,
        })),
      );

  if (rowInsertError) {
    await supabase
      .from('import_batches')
      .update({
        status: 'failed',
        failure_message: rowInsertError.message,
      })
      .eq('id', batch.id);

    return {
      status: 'error',
      message:
        `Validated rows could not be staged: ${rowInsertError.message}`,
    };
  }

  const { error: finalizeError } =
    await supabase
      .from('import_batches')
      .update({
        status: 'validated',
        validation_summary: {
          warnings: workbook.warnings,
          fixedHeaders: true,
          validatedAt:
            new Date().toISOString(),
        },
      })
      .eq('id', batch.id);

  if (finalizeError) {
    return {
      status: 'error',
      message:
        `The import batch could not be finalized: ${finalizeError.message}`,
    };
  }

  return {
    status: 'success',
    message:
      'Workbook validated successfully.',
    batchId: batch.id,
  };
}

export async function confirmMasterDataImportAction(
  _previousState: MasterDataImportActionState,
  formData: FormData,
): Promise<MasterDataImportActionState> {
  await requireHodAccess();

  const entity = getEntity(formData);
  const batchId = formData.get('batchId');

  if (
    !entity ||
    typeof batchId !== 'string' ||
    !batchId.trim()
  ) {
    return {
      status: 'error',
      message:
        'The import confirmation is invalid.',
    };
  }

  const supabase = await createClient();
  const rpcName =
    entity === 'programmes'
      ? 'import_valid_programme_rows'
      : 'import_valid_cohort_rows';

  const { data, error } =
    await supabase.rpc(rpcName, {
      target_batch_id: batchId,
    });

  if (error) {
    return {
      status: 'error',
      message:
        error.message ||
        `The ${entityLabel(entity)} import could not be completed.`,
    };
  }

  const result = (
    data as MasterDataImportRpcResult[] | null
  )?.[0];

  if (!result) {
    return {
      status: 'error',
      message:
        'The import completed without returning a result.',
    };
  }

  revalidatePath('/dashboard');
  revalidatePath(`/timetable/${entity}`);
  revalidatePath(
    `/timetable/${entity}/import/${batchId}`,
  );

  return {
    status: 'success',
    message:
      `${result.imported_count} ${entityLabel(entity)} imported successfully.`,
    batchId,
    importedCount: result.imported_count,
    skippedCount: result.skipped_count,
    failedCount: result.failed_count,
  };
}
