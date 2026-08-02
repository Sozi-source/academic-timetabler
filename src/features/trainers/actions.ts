'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type {
  TrainerActionState,
} from './types';
import {
  trainerFormSchema,
  trainerIdSchema,
} from './validation';

function revalidateTrainerPages(
  id?: string,
) {
  revalidatePath('/dashboard');
  revalidatePath('/timetable/trainers');

  if (id) {
    revalidatePath(
      `/timetable/trainers/${id}/edit`,
    );
  }
}

function getTrainerDatabaseErrorMessage(
  code?: string,
  message?: string,
) {
  if (
    message?.includes(
      'trainers_staff_number_unique_idx',
    )
  ) {
    return 'A trainer with this staff number already exists.';
  }

  if (
    message?.includes(
      'trainers_email_unique_idx',
    )
  ) {
    return 'A trainer with this email address already exists.';
  }

  if (
    message?.includes(
      'trainers_profile_unique_idx',
    )
  ) {
    return 'This user profile is already linked to another trainer.';
  }

  switch (code) {
    case '23505':
      return 'A trainer with the same staff number or email already exists.';

    case '23514':
      return 'The trainer record does not satisfy the required validation rules.';

    case '42501':
      return 'You are not authorized to manage trainers.';

    case 'P0002':
      return 'The requested trainer was not found.';

    default:
      return 'The trainer could not be saved. Please try again.';
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

function parseTrainerForm(
  formData: FormData,
) {
  return trainerFormSchema.safeParse({
    staffNumber:
      formData.get('staffNumber'),

    fullName:
      formData.get('fullName'),

    email:
      normalizeOptionalValue(
        formData,
        'email',
      ),

    phoneNumber:
      normalizeOptionalValue(
        formData,
        'phoneNumber',
      ),

    employmentType:
      formData.get('employmentType'),

    specialization:
      normalizeOptionalValue(
        formData,
        'specialization',
      ),

    qualifications:
      normalizeOptionalValue(
        formData,
        'qualifications',
      ),

    maximumWeeklyHours:
      formData.get('maximumWeeklyHours'),

    maximumDailyHours:
      formData.get('maximumDailyHours'),

    notes:
      normalizeOptionalValue(
        formData,
        'notes',
      ),
  });
}

export async function createTrainerAction(
  _previousState: TrainerActionState,
  formData: FormData,
): Promise<TrainerActionState> {
  await requireHodAccess();

  const parsed =
    parseTrainerForm(formData);

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
    .from('trainers')
    .insert({
      staff_number:
        parsed.data.staffNumber,

      full_name:
        parsed.data.fullName,

      email:
        parsed.data.email || null,

      phone_number:
        parsed.data.phoneNumber || null,

      employment_type:
        parsed.data.employmentType,

      specialization:
        parsed.data.specialization || null,

      qualifications:
        parsed.data.qualifications || null,

      maximum_weekly_hours:
        parsed.data.maximumWeeklyHours,

      maximum_daily_hours:
        parsed.data.maximumDailyHours,

      is_active: true,

      is_timetable_available: true,

      notes:
        parsed.data.notes || null,
    });

  if (error) {
    return {
      status: 'error',
      message:
        getTrainerDatabaseErrorMessage(
          error.code,
          error.message,
        ),
    };
  }

  revalidateTrainerPages();

  return {
    status: 'success',
    message:
      'Trainer created successfully.',
  };
}

export async function updateTrainerAction(
  _previousState: TrainerActionState,
  formData: FormData,
): Promise<TrainerActionState> {
  await requireHodAccess();

  const idResult =
    trainerIdSchema.safeParse(
      formData.get('id'),
    );

  if (!idResult.success) {
    return {
      status: 'error',
      message:
        'The trainer identifier is invalid.',
    };
  }

  const parsed =
    parseTrainerForm(formData);

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
    .from('trainers')
    .update({
      staff_number:
        parsed.data.staffNumber,

      full_name:
        parsed.data.fullName,

      email:
        parsed.data.email || null,

      phone_number:
        parsed.data.phoneNumber || null,

      employment_type:
        parsed.data.employmentType,

      specialization:
        parsed.data.specialization || null,

      qualifications:
        parsed.data.qualifications || null,

      maximum_weekly_hours:
        parsed.data.maximumWeeklyHours,

      maximum_daily_hours:
        parsed.data.maximumDailyHours,

      notes:
        parsed.data.notes || null,
    })
    .eq('id', idResult.data);

  if (error) {
    return {
      status: 'error',
      message:
        getTrainerDatabaseErrorMessage(
          error.code,
          error.message,
        ),
    };
  }

  revalidateTrainerPages(
    idResult.data,
  );

  return {
    status: 'success',
    message:
      'Trainer updated successfully.',
  };
}

export async function setTrainerActiveAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const idResult =
    trainerIdSchema.safeParse(
      formData.get('id'),
    );

  if (!idResult.success) {
    throw new Error(
      'Invalid trainer identifier.',
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
    .from('trainers')
    .update(updateValues)
    .eq('id', idResult.data);

  if (error) {
    throw new Error(
      getTrainerDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    );
  }

  revalidateTrainerPages(
    idResult.data,
  );
}

export async function setTrainerTimetableAvailabilityAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const idResult =
    trainerIdSchema.safeParse(
      formData.get('id'),
    );

  if (!idResult.success) {
    throw new Error(
      'Invalid trainer identifier.',
    );
  }

  const isAvailable =
    formData.get(
      'isTimetableAvailable',
    ) === 'true';

  const supabase = await createClient();

  if (isAvailable) {
    const {
      data: trainer,
      error: lookupError,
    } = await supabase
      .from('trainers')
      .select('is_active')
      .eq('id', idResult.data)
      .maybeSingle();

    if (lookupError) {
      throw new Error(
        getTrainerDatabaseErrorMessage(
          lookupError.code,
          lookupError.message,
        ),
      );
    }

    if (!trainer) {
      throw new Error(
        'The requested trainer was not found.',
      );
    }

    if (!trainer.is_active) {
      throw new Error(
        'Activate the trainer before making them available for timetabling.',
      );
    }
  }

  const { error } = await supabase
    .from('trainers')
    .update({
      is_timetable_available:
        isAvailable,
    })
    .eq('id', idResult.data);

  if (error) {
    throw new Error(
      getTrainerDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    );
  }

  revalidateTrainerPages(
    idResult.data,
  );
}