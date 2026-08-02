'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

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

    expectedCompletionDate:
      formData.get(
        'expectedCompletionDate',
      ),

    currentAcademicPeriodNumber:
      formData.get(
        'currentAcademicPeriodNumber',
      ),

    plannedSize:
      formData.get('plannedSize') || undefined,

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
        parsed.data.expectedCompletionDate,
      current_academic_period_number:
        parsed.data.currentAcademicPeriodNumber,
      planned_size:
        parsed.data.plannedSize ?? null,
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
        parsed.data.expectedCompletionDate,
      current_academic_period_number:
        parsed.data.currentAcademicPeriodNumber,
      planned_size:
        parsed.data.plannedSize ?? null,
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