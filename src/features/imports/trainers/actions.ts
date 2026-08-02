'use server';

import {
  revalidatePath,
} from 'next/cache';

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
  trainersImportTemplate,
} from '@/features/imports/templates';
import {
  readImportWorkbook,
} from '@/features/imports/workbook-reader';
import {
  createClient,
} from '@/lib/supabase/server';

import type {
  NormalizedTrainerImportRow,
  TrainerImportActionState,
  TrainerImportRpcResult,
} from './types';
import {
  trainerImportRowSchema,
} from './validation';

function normalizeDuplicateValue(
  value: string,
) {
  return value.trim().toLowerCase();
}

function getStaffDuplicateKey(
  staffNumber: string,
) {
  return `staff:${normalizeDuplicateValue(
    staffNumber,
  )}`;
}

function getEmailDuplicateKey(
  email: string,
) {
  return `email:${normalizeDuplicateValue(
    email,
  )}`;
}

export async function stageTrainerImportAction(
  _previousState: TrainerImportActionState,
  formData: FormData,
): Promise<TrainerImportActionState> {
  await requireHodAccess();

  const uploadedFile =
    formData.get('workbook');

  if (!(uploadedFile instanceof File)) {
    return {
      status: 'error',
      message:
        'Select a Trainers Excel workbook.',
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

  let workbook;

  try {
    workbook = await readImportWorkbook({
      fileName: uploadedFile.name,
      buffer:
        await uploadedFile.arrayBuffer(),
      definition: trainersImportTemplate,
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

  const validationResults =
    markDuplicateImportRows(
      workbook.rows.map((row) =>
        validateParsedImportRow<
          NormalizedTrainerImportRow
        >({
          row,
          schema: trainerImportRowSchema,
          duplicateKey: (trainer) =>
            getStaffDuplicateKey(
              trainer.staffNumber,
            ),
        }),
      ),
    );

  const emailIndexes =
    new Map<string, number[]>();

  validationResults.forEach(
    (result, index) => {
      if (
        result.status !== 'valid' ||
        !result.normalizedData?.email
      ) {
        return;
      }

      const key = getEmailDuplicateKey(
        result.normalizedData.email,
      );

      const indexes =
        emailIndexes.get(key) ?? [];

      indexes.push(index);
      emailIndexes.set(key, indexes);
    },
  );

  for (const indexes of emailIndexes.values()) {
    if (indexes.length < 2) {
      continue;
    }

    for (const index of indexes) {
      validationResults[index].status =
        'duplicate';

      validationResults[
        index
      ].rowErrors.push(
        'This email address appears more than once in the uploaded workbook.',
      );
    }
  }

  const supabase = await createClient();

  const {
    data: existingTrainers,
    error: trainerLookupError,
  } = await supabase
    .from('trainers')
    .select('staff_number, email');

  if (trainerLookupError) {
    return {
      status: 'error',
      message:
        `Existing trainers could not be checked: ${trainerLookupError.message}`,
    };
  }

  const existingStaffNumbers =
    new Set(
      (existingTrainers ?? []).map(
        (trainer) =>
          normalizeDuplicateValue(
            trainer.staff_number,
          ),
      ),
    );

  const existingEmails =
    new Set(
      (existingTrainers ?? [])
        .map((trainer) => trainer.email)
        .filter(
          (email): email is string =>
            Boolean(email),
        )
        .map(normalizeDuplicateValue),
    );

  for (const result of validationResults) {
    if (
      result.status !== 'valid' ||
      !result.normalizedData
    ) {
      continue;
    }

    if (
      existingStaffNumbers.has(
        normalizeDuplicateValue(
          result.normalizedData.staffNumber,
        ),
      )
    ) {
      result.status = 'duplicate';

      result.rowErrors.push(
        'A trainer with this staff number already exists.',
      );
    }

    if (
      result.normalizedData.email &&
      existingEmails.has(
        normalizeDuplicateValue(
          result.normalizedData.email,
        ),
      )
    ) {
      result.status = 'duplicate';

      result.rowErrors.push(
        'A trainer with this email address already exists.',
      );
    }
  }

  const {
    data: batch,
    error: batchError,
  } = await supabase
    .from('import_batches')
    .insert({
      entity_type: 'trainers',
      template_version:
        workbook.metadata.templateVersion,
      original_file_name:
        workbook.fileName,
      file_size_bytes:
        workbook.fileSizeBytes,
      status: 'validating',
      validation_summary: {
        warnings: workbook.warnings,
      },
      import_options: {
        duplicateStrategy: 'skip',
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

  const stagedRows =
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
      duplicate_key:
        result.duplicateKey,
    }));

  const {
    error: rowInsertError,
  } = await supabase
    .from('import_rows')
    .insert(stagedRows);

  if (rowInsertError) {
    await supabase
      .from('import_batches')
      .update({
        status: 'failed',
        failure_message:
          rowInsertError.message,
      })
      .eq('id', batch.id);

    return {
      status: 'error',
      message:
        `The validated rows could not be staged: ${rowInsertError.message}`,
    };
  }

  const {
    error: finalizeError,
  } = await supabase
    .from('import_batches')
    .update({
      status: 'validated',
      validation_summary: {
        warnings: workbook.warnings,
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

  revalidatePath(
    `/timetable/trainers/import/${batch.id}`,
  );

  return {
    status: 'success',
    message:
      'Workbook validated successfully.',
    batchId: batch.id,
  };
}
export async function confirmTrainerImportAction(
  _previousState: TrainerImportActionState,
  formData: FormData,
): Promise<TrainerImportActionState> {
  await requireHodAccess();

  const batchId =
    formData.get('batchId');

  if (
    typeof batchId !== 'string' ||
    !batchId.trim()
  ) {
    return {
      status: 'error',
      message:
        'The Trainer import batch identifier is invalid.',
    };
  }

  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase.rpc(
    'import_valid_trainer_rows',
    {
      target_batch_id:
        batchId,
    },
  );

  if (error) {
    return {
      status: 'error',
      message:
        error.message ||
        'The Trainer import could not be completed.',
    };
  }

  const result = (
    data as TrainerImportRpcResult[] | null
  )?.[0];

  if (!result) {
    return {
      status: 'error',
      message:
        'The Trainer import completed without returning a result.',
    };
  }

  revalidatePath('/dashboard');
  revalidatePath('/timetable/trainers');
  revalidatePath(
    `/timetable/trainers/import/${batchId}`,
  );

  return {
    status: 'success',
    message:
      `${result.imported_count} trainer${
        result.imported_count === 1
          ? ''
          : 's'
      } imported successfully.`,
    batchId,
    importedCount:
      result.imported_count,
    skippedCount:
      result.skipped_count,
    failedCount:
      result.failed_count,
  };
}