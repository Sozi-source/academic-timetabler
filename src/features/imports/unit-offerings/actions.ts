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
  type ImportValidationResult,
  validateImportFileDescriptor,
  validateParsedImportRow,
} from '@/features/imports';
import {
  readImportWorkbook,
} from '@/features/imports/workbook-reader';
import {
  createClient,
} from '@/lib/supabase/server';

import {
  applyAutomaticSharedClassKeys,
} from './shared-class-detection';
import {
  unitOfferingsImportTemplate,
} from './template';
import type {
  NormalizedUnitOfferingImportRow,
  UnitOfferingImportActionState,
} from './types';
import {
  unitOfferingImportRowSchema,
} from './validation';

interface AcademicPeriodLookupRow {
  id: string;
  code: string;
  name: string;
}

interface ProgrammeLookupRow {
  id: string;
  code: string;
  name: string;
}

interface CohortLookupRow {
  id: string;
  programme_id: string;
  code: string;
  name: string;
  status: string;
}

interface UnitLookupRow {
  id: string;
  programme_id: string;
  code: string;
  name: string;
  is_active: boolean;
}

interface TrainerLookupRow {
  id: string;
  staff_number: string;
  full_name: string;
}

interface RoomLookupRow {
  id: string;
  code: string;
  name: string;
}

interface ExistingUnitOfferingRow {
  id: string;
  academic_period_id: string;
  cohort_id: string;
  unit_id: string;
  manually_reviewed: boolean;
}

type ValidatedImportRow =
  ImportValidationResult<
    NormalizedUnitOfferingImportRow
  >;

function normalizeLookupValue(
  value: string,
) {
  return value
    .normalize('NFKC')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

function normalizeOptionalValue(
  value: string | undefined,
) {
  const normalized =
    value?.trim();

  return normalized || undefined;
}

function addFieldError(
  row: ValidatedImportRow,
  field: string,
  message: string,
) {
  row.fieldErrors = {
    ...row.fieldErrors,
    [field]: [
      ...(row.fieldErrors[field] ?? []),
      message,
    ],
  };

  row.status = 'invalid';
}

function findExactMatches<T>(
  records: T[],
  candidates: Array<
    (record: T) => string
  >,
  suppliedValue: string,
) {
  const normalized =
    normalizeLookupValue(
      suppliedValue,
    );

  return records.filter(
    (record) =>
      candidates.some(
        (getValue) =>
          normalizeLookupValue(
            getValue(record),
          ) === normalized,
      ),
  );
}

function getDuplicateKey(
  row:
    NormalizedUnitOfferingImportRow,
) {
  return [
    normalizeLookupValue(
      row.academicPeriod,
    ),
    normalizeLookupValue(
      row.programmeName,
    ),
    normalizeLookupValue(
      row.cohortName,
    ),
    normalizeLookupValue(
      row.unitName,
    ),
    normalizeLookupValue(
      row.unitCode ?? '',
    ),
  ].join(':');
}

export async function stageUnitOfferingImportAction(
  _previousState:
    UnitOfferingImportActionState,
  formData: FormData,
): Promise<UnitOfferingImportActionState> {
  const authorizedUser =
    await requireHodAccess();

  const uploadedFile =
    formData.get('workbook');

  if (!(uploadedFile instanceof File)) {
    return {
      status: 'error',
      message:
        'Select a Semester Units on Offer workbook.',
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
          unitOfferingsImportTemplate,
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
        'The Semester Units on Offer workbook could not be read.',
    };
  }

  const validationResults =
    markDuplicateImportRows(
      workbook.rows.map((row) =>
        validateParsedImportRow<
          NormalizedUnitOfferingImportRow
        >({
          row,
          schema:
            unitOfferingImportRowSchema,
          duplicateKey:
            getDuplicateKey,
        }),
      ),
    );

  const supabase =
    await createClient();

  const [
    academicPeriodResult,
    programmeResult,
    cohortResult,
    unitResult,
    trainerResult,
    roomResult,
    existingOfferingResult,
  ] = await Promise.all([
    supabase
      .from('academic_periods')
      .select(`
        id,
        code,
        name
      `),

    supabase
      .from('programmes')
      .select(`
        id,
        code,
        name
      `),

    supabase
      .from('cohorts')
      .select(`
        id,
        programme_id,
        code,
        name,
        status
      `),

    supabase
      .from('units')
      .select(`
        id,
        programme_id,
        code,
        name,
        is_active
      `),

    supabase
      .from('trainers')
      .select(`
        id,
        staff_number,
        full_name
      `),

    supabase
      .from('rooms')
      .select(`
        id,
        code,
        name
      `),

    supabase
      .from('unit_offerings')
      .select(`
        id,
        academic_period_id,
        cohort_id,
        unit_id,
        manually_reviewed
      `),
  ]);

  const lookupError =
    academicPeriodResult.error ??
    programmeResult.error ??
    cohortResult.error ??
    unitResult.error ??
    trainerResult.error ??
    roomResult.error ??
    existingOfferingResult.error;

  if (lookupError) {
    return {
      status: 'error',
      message:
        `Unable to prepare database validation: ${lookupError.message}`,
    };
  }

  const academicPeriods =
    (
      academicPeriodResult.data ??
      []
    ) as AcademicPeriodLookupRow[];

  const programmes =
    (
      programmeResult.data ?? []
    ) as ProgrammeLookupRow[];

  const cohorts =
    (
      cohortResult.data ?? []
    ) as CohortLookupRow[];

  const units =
    (
      unitResult.data ?? []
    ) as UnitLookupRow[];

  const trainers =
    (
      trainerResult.data ?? []
    ) as TrainerLookupRow[];

  const rooms =
    (
      roomResult.data ?? []
    ) as RoomLookupRow[];

  const existingOfferings =
    (
      existingOfferingResult.data ??
      []
    ) as ExistingUnitOfferingRow[];

  for (const row of validationResults) {
    if (
      row.status === 'invalid' ||
      row.status === 'duplicate'
    ) {
      continue;
    }

    const normalized =
      row.normalizedData;

    if (!normalized) {
      row.status = 'invalid';

      row.rowErrors = [
        ...row.rowErrors,
        'The workbook row could not be normalized.',
      ];

      continue;
    }

    const periodMatches =
      findExactMatches(
        academicPeriods,
        [
          (period) => period.code,
          (period) => period.name,
        ],
        normalized.academicPeriod,
      );

    if (periodMatches.length === 0) {
      addFieldError(
        row,
        'academicPeriod',
        'No matching Academic Period was found.',
      );

      continue;
    }

    if (periodMatches.length > 1) {
      addFieldError(
        row,
        'academicPeriod',
        'The Academic Period value is ambiguous.',
      );

      continue;
    }

    const academicPeriod =
      periodMatches[0];

    const programmeMatches =
      findExactMatches(
        programmes,
        [
          (programme) =>
            programme.name,
          (programme) =>
            programme.code,
        ],
        normalized.programmeName,
      );

    if (
      programmeMatches.length === 0
    ) {
      addFieldError(
        row,
        'programmeName',
        'No matching programme was found.',
      );

      continue;
    }

    if (
      programmeMatches.length > 1
    ) {
      addFieldError(
        row,
        'programmeName',
        'The programme value is ambiguous.',
      );

      continue;
    }

    const programme =
      programmeMatches[0];

    const programmeCohorts =
      cohorts.filter(
        (cohort) =>
          cohort.programme_id ===
          programme.id,
      );

    const cohortMatches =
      findExactMatches(
        programmeCohorts,
        [
          (cohort) => cohort.name,
          (cohort) => cohort.code,
        ],
        normalized.cohortName,
      );

    if (cohortMatches.length === 0) {
      addFieldError(
        row,
        'cohortName',
        'No matching cohort was found within the selected programme.',
      );

      continue;
    }

    if (cohortMatches.length > 1) {
      addFieldError(
        row,
        'cohortName',
        'The cohort value is ambiguous within the selected programme.',
      );

      continue;
    }

    const cohort =
      cohortMatches[0];

    if (cohort.status !== 'active') {
      addFieldError(
        row,
        'cohortName',
        'The selected cohort is not active.',
      );

      continue;
    }

    const programmeUnits =
      units.filter(
        (unit) =>
          unit.programme_id ===
            programme.id &&
          unit.is_active,
      );

    const nameMatches =
      findExactMatches(
        programmeUnits,
        [
          (unit) => unit.name,
        ],
        normalized.unitName,
      );

    let unit:
      UnitLookupRow | undefined;

    if (nameMatches.length === 1) {
      unit = nameMatches[0];
    }
    else if (
      nameMatches.length > 1 &&
      normalized.unitCode
    ) {
      const normalizedCode =
        normalizeLookupValue(
          normalized.unitCode,
        );

      const codeMatches =
        nameMatches.filter(
          (candidate) =>
            normalizeLookupValue(
              candidate.code,
            ) === normalizedCode,
        );

      if (codeMatches.length === 1) {
        unit = codeMatches[0];
      }
    }

    if (!unit) {
      if (nameMatches.length === 0) {
        addFieldError(
          row,
          'unitName',
          'No active unit with this name was found within the selected programme.',
        );
      }
      else {
        addFieldError(
          row,
          'unitCode',
          'The unit name is ambiguous. Supply the exact programme-specific unit code.',
        );
      }

      continue;
    }

    if (
      normalized.unitCode &&
      normalizeLookupValue(
        normalized.unitCode,
      ) !==
        normalizeLookupValue(
          unit.code,
        )
    ) {
      addFieldError(
        row,
        'unitCode',
        'The supplied unit code does not match the selected programme unit.',
      );

      continue;
    }

    let preferredTrainerId:
      string | undefined;

    const preferredTrainer =
      normalizeOptionalValue(
        normalized.preferredTrainer,
      );

    if (preferredTrainer) {
      const trainerMatches =
        findExactMatches(
          trainers,
          [
            (trainer) =>
              trainer.full_name,
            (trainer) =>
              trainer.staff_number,
          ],
          preferredTrainer,
        );

      if (trainerMatches.length === 0) {
        addFieldError(
          row,
          'preferredTrainer',
          'No matching trainer was found.',
        );

        continue;
      }

      if (trainerMatches.length > 1) {
        addFieldError(
          row,
          'preferredTrainer',
          'The preferred trainer value is ambiguous. Use the staff number.',
        );

        continue;
      }

      preferredTrainerId =
        trainerMatches[0].id;
    }

    let preferredRoomId:
      string | undefined;

    const preferredRoom =
      normalizeOptionalValue(
        normalized.preferredRoom,
      );

    if (preferredRoom) {
      const roomMatches =
        findExactMatches(
          rooms,
          [
            (room) => room.name,
            (room) => room.code,
          ],
          preferredRoom,
        );

      if (roomMatches.length === 0) {
        addFieldError(
          row,
          'preferredRoom',
          'No matching room was found.',
        );

        continue;
      }

      if (roomMatches.length > 1) {
        addFieldError(
          row,
          'preferredRoom',
          'The preferred room value is ambiguous. Use the room code.',
        );

        continue;
      }

      preferredRoomId =
        roomMatches[0].id;
    }

    const existingOffering =
      existingOfferings.find(
        (offering) =>
          offering.academic_period_id ===
            academicPeriod.id &&
          offering.cohort_id ===
            cohort.id &&
          offering.unit_id ===
            unit.id,
      );

    row.normalizedData = {
      ...normalized,

      academicPeriodId:
        academicPeriod.id,

      programmeId:
        programme.id,

      cohortId:
        cohort.id,

      unitId:
        unit.id,

      unitCode:
        unit.code,

      preferredTrainerId,
      preferredRoomId,

      existingUnitOfferingId:
        existingOffering?.id,

      manuallyReviewed:
        existingOffering
          ?.manually_reviewed ??
        false,

      matchStrategy:
        normalized.unitCode
          ? 'name-and-code'
          : 'exact-name',

      importOperation:
        existingOffering
          ? existingOffering
              .manually_reviewed
            ? 'preserve-reviewed'
            : 'update'
          : 'insert',
    };

    row.status = 'valid';
  }

  applyAutomaticSharedClassKeys(
    validationResults,
  );

  const totalRows =
    validationResults.length;

  const duplicateRows =
    validationResults.filter(
      (row) =>
        row.status === 'duplicate',
    ).length;

  const invalidRows =
    validationResults.filter(
      (row) =>
        row.status === 'invalid',
    ).length;

  const validRows =
    validationResults.filter(
      (row) =>
        row.status === 'valid',
    ).length;

  const {
    data: batch,
    error: batchError,
  } = await supabase
    .from('import_batches')
    .insert({
      entity_type:
        'unit_offerings',

      template_version:
        unitOfferingsImportTemplate.version,

      original_file_name:
        uploadedFile.name,

      file_size_bytes:
        uploadedFile.size,

      status: 'validated',

      total_rows: totalRows,
      valid_rows: validRows,
      invalid_rows: invalidRows,
      duplicate_rows:
        duplicateRows,

      imported_rows: 0,
      skipped_rows: 0,
      failed_rows: 0,

      import_options: {
        preserveManuallyReviewed:
          true,
      },

      validation_summary: {
        validRows,
        invalidRows,
        duplicateRows,
      },

      created_by:
        authorizedUser.id,
    })
    .select('id')
    .single();

  if (batchError || !batch) {
    return {
      status: 'error',
      message:
        `Unable to create the import batch: ${
          batchError?.message ??
          'No batch was returned.'
        }`,
    };
  }

  const stagedRows =
    validationResults.map((row) => ({
      import_batch_id:
        batch.id,

      source_row_number:
        row.sourceRowNumber,

      status: row.status,

      source_data:
        row.sourceData,

      normalized_data:
        row.normalizedData ?? {},

      field_errors:
        row.fieldErrors,

      row_errors:
        row.rowErrors,

      duplicate_key:
        row.duplicateKey,
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
        `Unable to stage the workbook rows: ${stagedRowsError.message}`,
    };
  }

  return {
    status: 'success',
    message:
      `${validRows} row${
        validRows === 1 ? '' : 's'
      } passed validation.`,

    batchId: batch.id,

    importedCount: 0,
    updatedCount: 0,
    skippedCount:
      duplicateRows,
    failedCount:
      invalidRows,
    sharedOfferingCount: 0,
  };
}

interface UnitOfferingImportTransactionRow {
  batch_id: string;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  shared_offering_count: number;
}

export async function confirmUnitOfferingImportAction(
  _previousState:
    UnitOfferingImportActionState,
  formData: FormData,
): Promise<UnitOfferingImportActionState> {
  await requireHodAccess();

  const batchIdValue =
    formData.get('batchId');

  const batchId =
    typeof batchIdValue === 'string'
      ? batchIdValue.trim()
      : '';

  if (!batchId) {
    return {
      status: 'error',
      message:
        'The import batch identifier is missing.',
    };
  }

  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase.rpc(
    'import_valid_unit_offering_rows',
    {
      target_batch_id: batchId,
    },
  );

  if (error) {
    return {
      status: 'error',
      message:
        `Unable to confirm the Units on Offer import: ${error.message}`,
    };
  }

  const result =
    (
      data as
        UnitOfferingImportTransactionRow[] |
        null
    )?.[0];

  if (!result) {
    return {
      status: 'error',
      message:
        'The import transaction completed without returning a result.',
    };
  }

  revalidatePath(
    `/timetable/unit-offerings/import/${batchId}`,
  );

  revalidatePath(
    '/timetable/unit-offerings',
  );

  revalidatePath(
    '/timetable/teaching-offerings',
  );

  return {
    status: 'success',
    message:
      'Semester Units on Offer were imported successfully.',

    batchId:
      result.batch_id,

    importedCount:
      result.imported_count,

    updatedCount:
      result.updated_count,

    skippedCount:
      result.skipped_count,

    failedCount:
      result.failed_count,

    sharedOfferingCount:
      result.shared_offering_count,
  };
}
