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
  teachingAllocationsImportTemplate,
} from '@/features/imports/templates';
import {
  readImportWorkbook,
} from '@/features/imports/workbook-reader';
import {
  createClient,
} from '@/lib/supabase/server';

import type {
  NormalizedTeachingAllocationImportRow,
  TeachingAllocationImportActionState,
  TeachingAllocationImportRpcResult,
} from './types';
import {
  teachingAllocationImportRowSchema,
} from './validation';

function normalizeKey(
  value: string,
) {
  return value.trim().toLowerCase();
}

function getDuplicateKey(
  allocation:
    NormalizedTeachingAllocationImportRow,
) {
  return [
    normalizeKey(
      allocation.academicPeriodCode,
    ),
    normalizeKey(
      allocation.cohortCode,
    ),
    normalizeKey(
      allocation.unitCode,
    ),
  ].join(':');
}

export async function stageTeachingAllocationImportAction(
  _previousState:
    TeachingAllocationImportActionState,
  formData: FormData,
): Promise<TeachingAllocationImportActionState> {
  await requireHodAccess();

  const uploadedFile =
    formData.get('workbook');

  if (!(uploadedFile instanceof File)) {
    return {
      status: 'error',
      message:
        'Select a Teaching Allocations workbook.',
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
    if (
      error instanceof
      ImportWorkbookError
    ) {
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
    workbook =
      await readImportWorkbook({
        fileName:
          uploadedFile.name,
        buffer:
          await uploadedFile.arrayBuffer(),
        definition:
          teachingAllocationsImportTemplate,
      });
  }
  catch (error) {
    if (
      error instanceof
      ImportWorkbookError
    ) {
      return {
        status: 'error',
        message: error.message,
        details: error.details,
      };
    }

    return {
      status: 'error',
      message:
        'The Teaching Allocations workbook could not be read.',
    };
  }

  const validationResults =
    markDuplicateImportRows<NormalizedTeachingAllocationImportRow>(
      workbook.rows.map((row) =>
        validateParsedImportRow<
          NormalizedTeachingAllocationImportRow
        >({
          row,
          schema:
            teachingAllocationImportRowSchema,
          duplicateKey:
            getDuplicateKey,
        }),
      ),
    );

  const supabase =
    await createClient();

  const [
    periodResult,
    cohortResult,
    unitResult,
    trainerResult,
    roomResult,
    existingAllocationResult,
  ] = await Promise.all([
    supabase
      .from('academic_periods')
      .select(
        'id, code, status',
      ),

    supabase
      .from('cohorts')
      .select(`
        id,
        code,
        programme_id,
        actual_size,
        current_academic_period_number,
        status,
        is_timetable_available
      `),

    supabase
      .from('units')
      .select(`
        id,
        code,
        programme_id,
        academic_period_number,
        preferred_room_type,
        is_active,
        is_timetable_available
      `),

    supabase
      .from('trainers')
      .select(`
        id,
        staff_number,
        maximum_weekly_hours,
        is_active,
        is_timetable_available
      `),

    supabase
      .from('rooms')
      .select(`
        id,
        code,
        room_type,
        capacity,
        is_active,
        is_timetable_available
      `),

    supabase
      .from('teaching_allocations')
      .select(`
        academic_period_id,
        cohort_id,
        unit_id
      `),
  ]);

  const queryError =
    periodResult.error ??
    cohortResult.error ??
    unitResult.error ??
    trainerResult.error ??
    roomResult.error ??
    existingAllocationResult.error;

  if (queryError) {
    return {
      status: 'error',
      message:
        `Scheduling resources could not be checked: ${queryError.message}`,
    };
  }

  const periodMap = new Map(
    (periodResult.data ?? []).map(
      (period) => [
        normalizeKey(period.code),
        period,
      ],
    ),
  );

  const cohortMap = new Map(
    (cohortResult.data ?? []).map(
      (cohort) => [
        normalizeKey(cohort.code),
        cohort,
      ],
    ),
  );

  const unitMap = new Map(
    (unitResult.data ?? []).map(
      (unit) => [
        `${unit.programme_id}:${normalizeKey(
          unit.code,
        )}`,
        unit,
      ],
    ),
  );

  const trainerMap = new Map(
    (trainerResult.data ?? []).map(
      (trainer) => [
        normalizeKey(
          trainer.staff_number,
        ),
        trainer,
      ],
    ),
  );

  const roomMap = new Map(
    (roomResult.data ?? []).map(
      (room) => [
        normalizeKey(room.code),
        room,
      ],
    ),
  );

  const existingKeys = new Set(
    (
      existingAllocationResult.data ??
      []
    ).map(
      (allocation) =>
        [
          allocation.academic_period_id,
          allocation.cohort_id,
          allocation.unit_id,
        ].join(':'),
    ),
  );

  for (
    const result of
    validationResults
  ) {
    if (
      result.status !== 'valid' ||
      !result.normalizedData
    ) {
      continue;
    }

    const allocation =
      result.normalizedData;

    const period =
      periodMap.get(
        normalizeKey(
          allocation.academicPeriodCode,
        ),
      );

    const cohort =
      cohortMap.get(
        normalizeKey(
          allocation.cohortCode,
        ),
      );

    const trainer =
      trainerMap.get(
        normalizeKey(
          allocation.trainerStaffNumber,
        ),
      );

    if (!period) {
      result.status = 'invalid';
      result.fieldErrors
        .academicPeriodCode = [
        'The Academic Period code does not exist.',
      ];
    }
    else {
      allocation.academicPeriodId =
        period.id;

      if (
        ![
          'draft',
          'active',
        ].includes(period.status)
      ) {
        result.status = 'invalid';
        result.fieldErrors
          .academicPeriodCode = [
          'The Academic Period is not open for scheduling.',
        ];
      }
    }

    if (!cohort) {
      result.status = 'invalid';
      result.fieldErrors.cohortCode = [
        'The cohort code does not exist.',
      ];
    }
    else {
      allocation.cohortId =
        cohort.id;

      if (
        !cohort.is_timetable_available
      ) {
        result.status = 'invalid';
        result.fieldErrors.cohortCode = [
          'The cohort is not available for timetabling.',
        ];
      }
    }

    if (!trainer) {
      result.status = 'invalid';
      result.fieldErrors
        .trainerStaffNumber = [
        'The trainer staff number does not exist.',
      ];
    }
    else {
      allocation.trainerId =
        trainer.id;

      if (
        !trainer.is_active ||
        !trainer.is_timetable_available
      ) {
        result.status = 'invalid';
        result.fieldErrors
          .trainerStaffNumber = [
          'The trainer is not active and timetable-available.',
        ];
      }
    }

    if (cohort) {
      const unit =
        unitMap.get(
          `${cohort.programme_id}:${normalizeKey(
            allocation.unitCode,
          )}`,
        );

      if (!unit) {
        result.status = 'invalid';
        result.fieldErrors.unitCode = [
          'The unit does not belong to the cohort programme.',
        ];
      }
      else {
        allocation.unitId =
          unit.id;

        if (
          unit.academic_period_number !==
          cohort.current_academic_period_number
        ) {
          result.status = 'invalid';
          result.fieldErrors.unitCode = [
            'The unit does not match the cohort current programme period.',
          ];
        }

        if (
          !unit.is_active ||
          !unit.is_timetable_available
        ) {
          result.status = 'invalid';
          result.fieldErrors.unitCode = [
            'The unit is not available for timetabling.',
          ];
        }

        if (
          period &&
          existingKeys.has(
            [
              period.id,
              cohort.id,
              unit.id,
            ].join(':'),
          )
        ) {
          result.status =
            'duplicate';

          result.rowErrors.push(
            'This cohort and unit already have an allocation in the Academic Period.',
          );
        }
      }
    }

    if (
      allocation.preferredRoomCode
    ) {
      const room =
        roomMap.get(
          normalizeKey(
            allocation.preferredRoomCode,
          ),
        );

      if (!room) {
        result.status = 'invalid';
        result.fieldErrors
          .preferredRoomCode = [
          'The preferred room code does not exist.',
        ];
      }
      else {
        allocation.preferredRoomId =
          room.id;

        if (
          !room.is_active ||
          !room.is_timetable_available
        ) {
          result.status = 'invalid';
          result.fieldErrors
            .preferredRoomCode = [
            'The preferred room is not available for timetabling.',
          ];
        }

        if (
          cohort &&
          room.capacity <
            cohort.actual_size
        ) {
          result.status = 'invalid';
          result.fieldErrors
            .preferredRoomCode = [
            `The room capacity of ${room.capacity} is below the cohort size of ${cohort.actual_size}.`,
          ];
        }
      }
    }
  }

  const {
    data: batch,
    error: batchError,
  } = await supabase
    .from('import_batches')
    .insert({
      entity_type:
        'teaching_allocations',
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
        relationshipReferences:
          'codes',
      },
    })
    .select('id')
    .single();

  if (batchError || !batch) {
    return {
      status: 'error',
      message:
        batchError?.message ??
        'The Teaching Allocations import batch could not be created.',
    };
  }

  const stagedRows =
    validationResults.map(
      (result) => ({
        import_batch_id: batch.id,
        source_row_number:
          result.sourceRowNumber,
        status: result.status,
        source_data:
          result.sourceData,
        normalized_data:
          result.normalizedData ?? {},
        field_errors:
          result.fieldErrors,
        row_errors:
          result.rowErrors,
        duplicate_key:
          result.duplicateKey,
      }),
    );

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
        `The validated rows could not be staged: ${stagingError.message}`,
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
    `/timetable/teaching-allocations/import/${batch.id}`,
  );

  return {
    status: 'success',
    message:
      'Teaching Allocations workbook validated successfully.',
    batchId: batch.id,
  };
}

export async function confirmTeachingAllocationImportAction(
  _previousState:
    TeachingAllocationImportActionState,
  formData: FormData,
): Promise<TeachingAllocationImportActionState> {
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
        'The Teaching Allocations batch identifier is invalid.',
    };
  }

  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase.rpc(
    'import_valid_teaching_allocation_rows',
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
        'The Teaching Allocations import could not be completed.',
    };
  }

  const result = (
    data as
      | TeachingAllocationImportRpcResult[]
      | null
  )?.[0];

  if (!result) {
    return {
      status: 'error',
      message:
        'The import completed without returning a result.',
    };
  }

  revalidatePath('/dashboard');
  revalidatePath(
    '/timetable/teaching-allocations',
  );
  revalidatePath(
    '/timetable/generator',
  );
  revalidatePath(
    `/timetable/teaching-allocations/import/${batchId}`,
  );

  return {
    status: 'success',
    message:
      `${result.imported_count} allocation${
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
