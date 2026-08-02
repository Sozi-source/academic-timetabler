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
  roomsImportTemplate,
} from '@/features/imports/templates';
import {
  readImportWorkbook,
} from '@/features/imports/workbook-reader';
import {
  createClient,
} from '@/lib/supabase/server';

import type {
  NormalizedRoomImportRow,
  RoomImportActionState,
  RoomImportRpcResult,
} from './types';
import {
  roomImportRowSchema,
} from './validation';

function normalizeDuplicateValue(
  value: string,
) {
  return value.trim().toLowerCase();
}

export async function stageRoomImportAction(
  _previousState: RoomImportActionState,
  formData: FormData,
): Promise<RoomImportActionState> {
  await requireHodAccess();

  const uploadedFile =
    formData.get('workbook');

  if (!(uploadedFile instanceof File)) {
    return {
      status: 'error',
      message:
        'Select a Rooms Excel workbook.',
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
      definition: roomsImportTemplate,
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
        'The Rooms workbook could not be read.',
    };
  }

  const validationResults =
    markDuplicateImportRows(
      workbook.rows.map((row) =>
        validateParsedImportRow<
          NormalizedRoomImportRow
        >({
          row,
          schema: roomImportRowSchema,
          duplicateKey: (room) =>
            `room:${normalizeDuplicateValue(
              room.code,
            )}`,
        }),
      ),
    );

  const supabase = await createClient();

  const {
    data: existingRooms,
    error: roomLookupError,
  } = await supabase
    .from('rooms')
    .select('code, name');

  if (roomLookupError) {
    return {
      status: 'error',
      message:
        `Existing rooms could not be checked: ${roomLookupError.message}`,
    };
  }

  const existingCodes = new Set(
    (existingRooms ?? []).map((room) =>
      normalizeDuplicateValue(room.code),
    ),
  );

  const existingNames = new Set(
    (existingRooms ?? []).map((room) =>
      normalizeDuplicateValue(room.name),
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
      existingCodes.has(
        normalizeDuplicateValue(
          result.normalizedData.code,
        ),
      )
    ) {
      result.status = 'duplicate';
      result.rowErrors.push(
        'A room with this code already exists.',
      );
    }

    if (
      existingNames.has(
        normalizeDuplicateValue(
          result.normalizedData.name,
        ),
      )
    ) {
      result.status = 'duplicate';
      result.rowErrors.push(
        'A room with this name already exists.',
      );
    }
  }

  const {
    data: batch,
    error: batchError,
  } = await supabase
    .from('import_batches')
    .insert({
      entity_type: 'rooms',
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
        'The Rooms import batch could not be created.',
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
    error: stagedRowsError,
  } = await supabase
    .from('import_rows')
    .insert(stagedRows);

  if (stagedRowsError) {
    await supabase
      .from('import_batches')
      .update({
        status: 'failed',
        failure_message:
          stagedRowsError.message,
      })
      .eq('id', batch.id);

    return {
      status: 'error',
      message:
        `The validated Rooms rows could not be staged: ${stagedRowsError.message}`,
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
        `The Rooms import batch could not be finalized: ${finalizeError.message}`,
    };
  }

  revalidatePath(
    `/timetable/rooms/import/${batch.id}`,
  );

  return {
    status: 'success',
    message:
      'Rooms workbook validated successfully.',
    batchId: batch.id,
  };
}

export async function confirmRoomImportAction(
  _previousState: RoomImportActionState,
  formData: FormData,
): Promise<RoomImportActionState> {
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
        'The Rooms import batch identifier is invalid.',
    };
  }

  const supabase = await createClient();

  const {
    data,
    error,
  } = await supabase.rpc(
    'import_valid_room_rows',
    {
      target_batch_id: batchId,
    },
  );

  if (error) {
    return {
      status: 'error',
      message:
        error.message ||
        'The Rooms import could not be completed.',
    };
  }

  const result = (
    data as RoomImportRpcResult[] | null
  )?.[0];

  if (!result) {
    return {
      status: 'error',
      message:
        'The Rooms import completed without returning a result.',
    };
  }

  revalidatePath('/dashboard');
  revalidatePath('/timetable/rooms');
  revalidatePath(
    `/timetable/rooms/import/${batchId}`,
  );

  return {
    status: 'success',
    message:
      `${result.imported_count} room${
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