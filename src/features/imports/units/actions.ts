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
  unitsImportTemplate,
} from '@/features/imports/templates';
import {
  readImportWorkbook,
} from '@/features/imports/workbook-reader';
import {
  createClient,
} from '@/lib/supabase/server';

import type {
  NormalizedUnitImportRow,
  UnitImportActionState,
  UnitImportRpcResult,
} from './types';
import {
  unitImportRowSchema,
} from './validation';

function normalizeKey(
  value: string,
) {
  return value.trim().toLowerCase();
}

function getUnitDuplicateKey({
  programmeCode,
  code,
}: {
  programmeCode: string;
  code: string;
}) {
  return [
    normalizeKey(programmeCode),
    normalizeKey(code),
  ].join(':');
}

export async function stageUnitImportAction(
  _previousState: UnitImportActionState,
  formData: FormData,
): Promise<UnitImportActionState> {
  await requireHodAccess();

  const uploadedFile =
    formData.get('workbook');

  if (!(uploadedFile instanceof File)) {
    return {
      status: 'error',
      message:
        'Select a Units Excel workbook.',
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
      definition: unitsImportTemplate,
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
        'The Units workbook could not be read.',
    };
  }

  const validationResults =
    markDuplicateImportRows(
      workbook.rows.map((row) =>
        validateParsedImportRow<
          NormalizedUnitImportRow
        >({
          row,
          schema: unitImportRowSchema,
          duplicateKey: (unit) =>
            getUnitDuplicateKey(unit),
        }),
      ),
    );

  const supabase = await createClient();

  const {
    data: programmes,
    error: programmeError,
  } = await supabase
    .from('programmes')
    .select(`
      id,
      code,
      total_academic_periods,
      is_active,
      is_timetable_available
    `);

  if (programmeError) {
    return {
      status: 'error',
      message:
        `Programmes could not be checked: ${programmeError.message}`,
    };
  }

  const programmeMap = new Map(
    (programmes ?? []).map(
      (programme) => [
        normalizeKey(programme.code),
        programme,
      ],
    ),
  );

  const {
    data: existingUnits,
    error: unitLookupError,
  } = await supabase
    .from('units')
    .select(`
      programme_id,
      code,
      name
    `);

  if (unitLookupError) {
    return {
      status: 'error',
      message:
        `Existing units could not be checked: ${unitLookupError.message}`,
    };
  }

  const existingCodes = new Set(
    (existingUnits ?? []).map(
      (unit) =>
        `${unit.programme_id}:${normalizeKey(
          unit.code,
        )}`,
    ),
  );

  const existingNames = new Set(
    (existingUnits ?? []).map(
      (unit) =>
        `${unit.programme_id}:${normalizeKey(
          unit.name,
        )}`,
    ),
  );

  for (const result of validationResults) {
    if (
      result.status !== 'valid' ||
      !result.normalizedData
    ) {
      continue;
    }

    const unit =
      result.normalizedData;

    const programme =
      programmeMap.get(
        normalizeKey(unit.programmeCode),
      );

    if (!programme) {
      result.status = 'invalid';

      result.fieldErrors.programmeCode = [
        'No programme exists with this Programme Code.',
      ];

      continue;
    }

    unit.programmeId = programme.id;

    if (!programme.is_active) {
      result.status = 'invalid';

      result.fieldErrors.programmeCode = [
        'The selected programme is inactive.',
      ];

      continue;
    }

    if (
      unit.timetableAvailable &&
      !programme.is_timetable_available
    ) {
      result.status = 'invalid';

      result.fieldErrors.programmeCode = [
        'The programme is not available for timetabling.',
      ];
    }

    if (
      unit.academicPeriodNumber >
      programme.total_academic_periods
    ) {
      result.status = 'invalid';

      result.fieldErrors
        .academicPeriodNumber = [
        `The programme contains only ${programme.total_academic_periods} Academic Periods.`,
      ];
    }

    const codeKey =
      `${programme.id}:${normalizeKey(
        unit.code,
      )}`;

    const nameKey =
      `${programme.id}:${normalizeKey(
        unit.name,
      )}`;

    if (existingCodes.has(codeKey)) {
      result.status = 'duplicate';

      result.rowErrors.push(
        'A unit with this code already exists under the programme.',
      );
    }

    if (existingNames.has(nameKey)) {
      result.status = 'duplicate';

      result.rowErrors.push(
        'A unit with this name already exists under the programme.',
      );
    }
  }

  const {
    data: batch,
    error: batchError,
  } = await supabase
    .from('import_batches')
    .insert({
      entity_type: 'units',
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
        programmeReference:
          'programme_code',
      },
    })
    .select('id')
    .single();

  if (batchError || !batch) {
    return {
      status: 'error',
      message:
        batchError?.message ??
        'The Units import batch could not be created.',
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
    error: stagingError,
  } = await supabase
    .from('import_rows')
    .insert(stagedRows);

  if (stagingError) {
    await supabase
      .from('import_batches')
      .update({
        status: 'failed',
        failure_message:
          stagingError.message,
      })
      .eq('id', batch.id);

    return {
      status: 'error',
      message:
        `The validated Units rows could not be staged: ${stagingError.message}`,
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
        `The Units import batch could not be finalized: ${finalizeError.message}`,
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
}

export async function confirmUnitImportAction(
  _previousState: UnitImportActionState,
  formData: FormData,
): Promise<UnitImportActionState> {
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
        'The Units import batch identifier is invalid.',
    };
  }

  const supabase = await createClient();

  const {
    data,
    error,
  } = await supabase.rpc(
    'import_valid_unit_rows',
    {
      target_batch_id: batchId,
    },
  );

  if (error) {
    return {
      status: 'error',
      message:
        error.message ||
        'The Units import could not be completed.',
    };
  }

  const result = (
    data as UnitImportRpcResult[] | null
  )?.[0];

  if (!result) {
    return {
      status: 'error',
      message:
        'The Units import completed without returning a result.',
    };
  }

  revalidatePath('/dashboard');
  revalidatePath('/timetable/units');
  revalidatePath(
    `/timetable/units/import/${batchId}`,
  );

  return {
    status: 'success',
    message:
      `${result.imported_count} unit${
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