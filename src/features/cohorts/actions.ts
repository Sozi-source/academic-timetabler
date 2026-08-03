'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import {
  calculateCohortProgression,
} from './calculations';

import type {
  CohortActionState,
} from './types';
import {
  cohortFormSchema,
  cohortIdSchema,
  cohortStatusActionSchema,
} from './validation';

function revalidateCohortPages(
  id?: string,
) {
  revalidatePath('/dashboard');
  revalidatePath('/timetable/cohorts');

  if (id) {
    revalidatePath(
      `/timetable/cohorts/${id}/edit`,
    );
  }
}

function getCohortDatabaseErrorMessage(
  code?: string,
  message?: string,
) {
  if (
    message?.includes(
      'cohorts_code_unique_idx',
    )
  ) {
    return 'A cohort with this code already exists.';
  }

  if (
    message?.includes(
      'cohorts_programme_name_unique_idx',
    )
  ) {
    return 'A cohort with this name already exists under the selected programme.';
  }

  if (
    message?.includes(
      'Academic Period number exceeds',
    )
  ) {
    return 'The selected Academic Period number exceeds the parent programme structure.';
  }

  if (
    message?.includes(
      'inactive programme',
    )
  ) {
    return 'Planned and active cohorts cannot belong to an inactive programme.';
  }

  if (
    message?.includes(
      'not available for timetabling',
    )
  ) {
    return 'The parent programme is not available for timetabling.';
  }

  switch (code) {
    case '23503':
      return 'The selected programme no longer exists.';

    case '23505':
      return 'A cohort with the same code or programme name already exists.';

    case '23514':
      return 'The cohort does not satisfy the required validation rules.';

    case '42501':
      return 'You are not authorized to manage cohorts.';

    case 'P0001':
      return message ??
        'The cohort conflicts with its parent programme configuration.';

    case 'P0002':
      return 'The selected programme was not found.';

    default:
      return 'The cohort could not be saved. Please try again.';
  }
}

function normalizeOptionalValue(
  formData: FormData,
  fieldName: string,
) {
  const value = formData.get(fieldName);

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  return normalized || undefined;
}

function parseCohortForm(
  formData: FormData,
) {
  return cohortFormSchema.safeParse({
    programmeId:
      formData.get('programmeId'),

    code:
      formData.get('code'),

    name:
      formData.get('name'),

    intakeDate:
      formData.get('intakeDate'),

    actualSize:
      formData.get('actualSize'),

    status:
      formData.get('status'),

    notes:
      normalizeOptionalValue(
        formData,
        'notes',
      ),
  });
}


async function deriveCohortProgression(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  programmeId: string,
  intakeDate: string,
) {
  const [
    programmeResult,
    academicPeriodResult,
  ] = await Promise.all([
    supabase
      .from('programmes')
      .select(`
        id,
        total_academic_periods
      `)
      .eq('id', programmeId)
      .maybeSingle(),

    supabase
      .from('academic_periods')
      .select(`
        id,
        name,
        sequence_number,
        starts_on,
        ends_on,
        status,
        academic_years (
          starts_on
        )
      `)
      .order('starts_on', {
        ascending: true,
      }),
  ]);

  if (programmeResult.error) {
    return {
      status: 'error' as const,
      message:
        getCohortDatabaseErrorMessage(
          programmeResult.error.code,
          programmeResult.error.message,
        ),
    };
  }

  if (!programmeResult.data) {
    return {
      status: 'error' as const,
      message:
        'The selected programme was not found.',
    };
  }

  if (academicPeriodResult.error) {
    return {
      status: 'error' as const,
      message:
        `Unable to calculate progression: ${academicPeriodResult.error.message}`,
    };
  }

  const periodRows =
    academicPeriodResult.data ?? [];

  const academicPeriods =
    periodRows.map((period) => {
      const academicYear =
        Array.isArray(
          period.academic_years,
        )
          ? period.academic_years[0]
          : period.academic_years;

      return {
        id: period.id,
        name: period.name,
        sequenceNumber:
          period.sequence_number,
        startsOn:
          period.starts_on,
        endsOn:
          period.ends_on,
        academicYearStartsOn:
          academicYear?.starts_on ??
          period.starts_on,
      };
    });

  const progressionResult =
    calculateCohortProgression({
      intakeDate,
      totalAcademicPeriods:
        programmeResult.data
          .total_academic_periods,
      academicPeriods,
      activeAcademicPeriodIds:
        periodRows
          .filter(
            (period) =>
              period.status ===
              'active',
          )
          .map(
            (period) =>
              period.id,
          ),
    });

  if (
    progressionResult.status ===
    'error'
  ) {
    return progressionResult;
  }

  return {
    status: 'success' as const,

    expectedCompletionDate:
      progressionResult.calculation
        .expectedCompletionDate,

    currentAcademicPeriodNumber:
      progressionResult.calculation
        .persistedAcademicPeriodNumber,

    progressionState:
      progressionResult.calculation
        .progressionState,
  };
}

export async function createCohortAction(
  _previousState: CohortActionState,
  formData: FormData,
): Promise<CohortActionState> {
  await requireHodAccess();

  const parsed =
    parseCohortForm(formData);

  if (!parsed.success) {
    return {
      status: 'error',
      message:
        'Review the highlighted fields.',
      fieldErrors:
        parsed.error.flatten().fieldErrors,
    };
  }

  const timetableAvailable =
    parsed.data.status === 'planned' ||
    parsed.data.status === 'active';

  const supabase = await createClient();

  const completionResult =
    await deriveCohortProgression(
      supabase,
      parsed.data.programmeId,
      parsed.data.intakeDate,
    );

  if (completionResult.status === 'error') {
    return {
      status: 'error',
      message:
        completionResult.message,
      fieldErrors: {
        intakeDate: [
          completionResult.message,
        ],
      },
    };
  }

  const { error } = await supabase
    .from('cohorts')
    .insert({
      programme_id:
        parsed.data.programmeId,
      code:
        parsed.data.code,
      name:
        parsed.data.name,
      intake_date:
        parsed.data.intakeDate,
      expected_completion_date:
        completionResult.expectedCompletionDate,
      current_academic_period_number:
        completionResult.currentAcademicPeriodNumber,
      planned_size: null,
      actual_size:
        parsed.data.actualSize,
      status:
        parsed.data.status,
      is_timetable_available:
        timetableAvailable,
      notes:
        parsed.data.notes || null,
    });

  if (error) {
    return {
      status: 'error',
      message:
        getCohortDatabaseErrorMessage(
          error.code,
          error.message,
        ),
    };
  }

  revalidateCohortPages();

  return {
    status: 'success',
    message:
      'Cohort created successfully.',
  };
}

export async function updateCohortAction(
  _previousState: CohortActionState,
  formData: FormData,
): Promise<CohortActionState> {
  await requireHodAccess();

  const idResult =
    cohortIdSchema.safeParse(
      formData.get('id'),
    );

  if (!idResult.success) {
    return {
      status: 'error',
      message:
        'The cohort identifier is invalid.',
    };
  }

  const parsed =
    parseCohortForm(formData);

  if (!parsed.success) {
    return {
      status: 'error',
      message:
        'Review the highlighted fields.',
      fieldErrors:
        parsed.error.flatten().fieldErrors,
    };
  }

  const timetableAvailable =
    parsed.data.status === 'planned' ||
    parsed.data.status === 'active';

  const supabase = await createClient();

  const completionResult =
    await deriveCohortProgression(
      supabase,
      parsed.data.programmeId,
      parsed.data.intakeDate,
    );

  if (completionResult.status === 'error') {
    return {
      status: 'error',
      message:
        completionResult.message,
      fieldErrors: {
        intakeDate: [
          completionResult.message,
        ],
      },
    };
  }

  const { error } = await supabase
    .from('cohorts')
    .update({
      programme_id:
        parsed.data.programmeId,
      code:
        parsed.data.code,
      name:
        parsed.data.name,
      intake_date:
        parsed.data.intakeDate,
      expected_completion_date:
        completionResult.expectedCompletionDate,
      current_academic_period_number:
        completionResult.currentAcademicPeriodNumber,
      planned_size: null,
      actual_size:
        parsed.data.actualSize,
      status:
        parsed.data.status,
      is_timetable_available:
        timetableAvailable,
      notes:
        parsed.data.notes || null,
    })
    .eq('id', idResult.data);

  if (error) {
    return {
      status: 'error',
      message:
        getCohortDatabaseErrorMessage(
          error.code,
          error.message,
        ),
    };
  }

  revalidateCohortPages(
    idResult.data,
  );

  return {
    status: 'success',
    message:
      'Cohort updated successfully.',
  };
}

export async function setCohortStatusAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const parsed =
    cohortStatusActionSchema.safeParse({
      id: formData.get('id'),
      status: formData.get('status'),
    });

  if (!parsed.success) {
    throw new Error(
      'Invalid cohort lifecycle request.',
    );
  }

  const isTimetableAvailable =
    parsed.data.status === 'planned' ||
    parsed.data.status === 'active';

  const supabase = await createClient();

  const { error } = await supabase
    .from('cohorts')
    .update({
      status: parsed.data.status,
      is_timetable_available:
        isTimetableAvailable,
    })
    .eq('id', parsed.data.id);

  if (error) {
    throw new Error(
      getCohortDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    );
  }

  revalidateCohortPages(
    parsed.data.id,
  );
}

export async function setCohortTimetableAvailabilityAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const idResult =
    cohortIdSchema.safeParse(
      formData.get('id'),
    );

  if (!idResult.success) {
    throw new Error(
      'Invalid cohort identifier.',
    );
  }

  const isAvailable =
    formData.get(
      'isTimetableAvailable',
    ) === 'true';

  const supabase = await createClient();

  if (isAvailable) {
    const {
      data: cohort,
      error: lookupError,
    } = await supabase
      .from('cohorts')
      .select(`
        status,
        programmes (
          is_active,
          is_timetable_available
        )
      `)
      .eq('id', idResult.data)
      .maybeSingle();

    if (lookupError) {
      throw new Error(
        getCohortDatabaseErrorMessage(
          lookupError.code,
          lookupError.message,
        ),
      );
    }

    if (!cohort) {
      throw new Error(
        'The requested cohort was not found.',
      );
    }

    if (
      cohort.status !== 'planned' &&
      cohort.status !== 'active'
    ) {
      throw new Error(
        'Only planned or active cohorts can be made available for timetabling.',
      );
    }
  }

  const { error } = await supabase
    .from('cohorts')
    .update({
      is_timetable_available:
        isAvailable,
    })
    .eq('id', idResult.data);

  if (error) {
    throw new Error(
      getCohortDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    );
  }

  revalidateCohortPages(
    idResult.data,
  );
}