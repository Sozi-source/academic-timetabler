'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type {
  ProgrammeActionState,
} from './types';
import {
  programmeFormSchema,
  programmeIdSchema,
} from './validation';

function revalidateProgrammePages(
  id?: string,
) {
  revalidatePath('/dashboard');
  revalidatePath('/timetable/programmes');

  if (id) {
    revalidatePath(
      `/timetable/programmes/${id}/edit`,
    );
  }
}

function getProgrammeDatabaseErrorMessage(
  code?: string,
  message?: string,
) {
  if (
    message?.includes(
      'programmes_code_unique_idx',
    )
  ) {
    return 'A programme with this code already exists.';
  }

  if (
    message?.includes(
      'programmes_name_unique_idx',
    )
  ) {
    return 'A programme with this name already exists.';
  }

  switch (code) {
    case '23505':
      return 'A programme with the same code or name already exists.';

    case '23514':
      return 'The programme does not satisfy the required validation rules.';

    case '42501':
      return 'You are not authorized to manage programmes.';

    case 'P0002':
      return 'The requested programme was not found.';

    default:
      return 'The programme could not be saved. Please try again.';
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

function parseProgrammeForm(
  formData: FormData,
) {
  return programmeFormSchema.safeParse({
    departmentId:
      formData.get('departmentId'),

    code: formData.get('code'),

    name: formData.get('name'),

    shortName:
      normalizeOptionalValue(
        formData,
        'shortName',
      ),

    awardLevel:
      formData.get('awardLevel'),

    awardingBody:
      normalizeOptionalValue(
        formData,
        'awardingBody',
      ),

    durationValue:
      formData.get('durationValue'),

    durationUnit:
      formData.get('durationUnit'),

    totalAcademicPeriods:
      formData.get(
        'totalAcademicPeriods',
      ),

    maximumCohortSize:
      formData.get(
        'maximumCohortSize',
      ) || undefined,

    notes:
      normalizeOptionalValue(
        formData,
        'notes',
      ),
  });
}

export async function createProgrammeAction(
  _previousState: ProgrammeActionState,
  formData: FormData,
): Promise<ProgrammeActionState> {
  await requireHodAccess();

  const parsed =
    parseProgrammeForm(formData);

  if (!parsed.success) {
    return {
      status: 'error',
      message:
        'Review the highlighted fields.',
      fieldErrors:
        parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('programmes')
    .insert({
      department_id:
        parsed.data.departmentId,
      code: parsed.data.code,
      name: parsed.data.name,
      short_name:
        parsed.data.shortName || null,
      award_level:
        parsed.data.awardLevel,
      awarding_body:
        parsed.data.awardingBody || null,
      duration_value:
        parsed.data.durationValue,
      duration_unit:
        parsed.data.durationUnit,
      total_academic_periods:
        parsed.data.totalAcademicPeriods,
      maximum_cohort_size:
        parsed.data.maximumCohortSize ??
        null,
      is_active: true,
      is_timetable_available: true,
      notes:
        parsed.data.notes || null,
    });

  if (error) {
    return {
      status: 'error',
      message:
        getProgrammeDatabaseErrorMessage(
          error.code,
          error.message,
        ),
    };
  }

  revalidateProgrammePages();

  return {
    status: 'success',
    message:
      'Programme created successfully.',
  };
}

export async function updateProgrammeAction(
  _previousState: ProgrammeActionState,
  formData: FormData,
): Promise<ProgrammeActionState> {
  await requireHodAccess();

  const idResult =
    programmeIdSchema.safeParse(
      formData.get('id'),
    );

  if (!idResult.success) {
    return {
      status: 'error',
      message:
        'The programme identifier is invalid.',
    };
  }

  const parsed =
    parseProgrammeForm(formData);

  if (!parsed.success) {
    return {
      status: 'error',
      message:
        'Review the highlighted fields.',
      fieldErrors:
        parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('programmes')
    .update({
      department_id:
        parsed.data.departmentId,
      code: parsed.data.code,
      name: parsed.data.name,
      short_name:
        parsed.data.shortName || null,
      award_level:
        parsed.data.awardLevel,
      awarding_body:
        parsed.data.awardingBody || null,
      duration_value:
        parsed.data.durationValue,
      duration_unit:
        parsed.data.durationUnit,
      total_academic_periods:
        parsed.data.totalAcademicPeriods,
      maximum_cohort_size:
        parsed.data.maximumCohortSize ??
        null,
      notes:
        parsed.data.notes || null,
    })
    .eq('id', idResult.data);

  if (error) {
    return {
      status: 'error',
      message:
        getProgrammeDatabaseErrorMessage(
          error.code,
          error.message,
        ),
    };
  }

  revalidateProgrammePages(
    idResult.data,
  );

  return {
    status: 'success',
    message:
      'Programme updated successfully.',
  };
}

export async function setProgrammeActiveAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const idResult =
    programmeIdSchema.safeParse(
      formData.get('id'),
    );

  if (!idResult.success) {
    throw new Error(
      'Invalid programme identifier.',
    );
  }

  const isActive =
    formData.get('isActive') === 'true';

  const supabase = await createClient();

  const updateValues:
    Record<string, boolean> = {
      is_active: isActive,
    };

  if (!isActive) {
    updateValues.is_timetable_available =
      false;
  }

  const { error } = await supabase
    .from('programmes')
    .update(updateValues)
    .eq('id', idResult.data);

  if (error) {
    throw new Error(
      getProgrammeDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    );
  }

  revalidateProgrammePages(
    idResult.data,
  );
}

export async function setProgrammeTimetableAvailabilityAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const idResult =
    programmeIdSchema.safeParse(
      formData.get('id'),
    );

  if (!idResult.success) {
    throw new Error(
      'Invalid programme identifier.',
    );
  }

  const isAvailable =
    formData.get(
      'isTimetableAvailable',
    ) === 'true';

  const supabase = await createClient();

  if (isAvailable) {
    const {
      data: programme,
      error: lookupError,
    } = await supabase
      .from('programmes')
      .select('is_active')
      .eq('id', idResult.data)
      .maybeSingle();

    if (lookupError) {
      throw new Error(
        getProgrammeDatabaseErrorMessage(
          lookupError.code,
          lookupError.message,
        ),
      );
    }

    if (!programme) {
      throw new Error(
        'The requested programme was not found.',
      );
    }

    if (!programme.is_active) {
      throw new Error(
        'Activate the programme before making it available for timetable scheduling.',
      );
    }
  }

  const { error } = await supabase
    .from('programmes')
    .update({
      is_timetable_available:
        isAvailable,
    })
    .eq('id', idResult.data);

  if (error) {
    throw new Error(
      getProgrammeDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    );
  }

  revalidateProgrammePages(
    idResult.data,
  );
}
