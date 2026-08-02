'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type {
  TimeSlotActionState,
  WorkingDayActionState,
} from './types';
import {
  academicPeriodIdSchema,
  timetableCalendarIdSchema,
  timeSlotFormSchema,
  workingDayFormSchema,
} from './validation';

function revalidateCalendarPages() {
  revalidatePath('/dashboard');
  revalidatePath('/timetable/time-slots');
  revalidatePath('/timetable/working-days');
}

function getDatabaseErrorMessage(
  code?: string,
  message?: string,
) {
  if (
    message?.includes(
      'Archived Academic Periods cannot be configured',
    )
  ) {
    return 'Archived Academic Periods cannot be configured.';
  }

  switch (code) {
    case '23505':
      return 'A record with the same day, code, name or sequence already exists.';

    case '23P01':
      return 'This time overlaps with another enabled time slot.';

    case '23514':
      return 'The record does not satisfy the required validation rules.';

    case '42501':
      return 'You are not authorized to perform this operation.';

    case 'P0002':
      return 'The selected Academic Period was not found.';

    default:
      return 'The record could not be saved. Please try again.';
  }
}

export async function initializeDefaultWorkingDaysAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const periodResult =
    academicPeriodIdSchema.safeParse(
      formData.get('academicPeriodId'),
    );

  if (!periodResult.success) {
    throw new Error(
      'Invalid Academic Period.',
    );
  }

  const supabase = await createClient();

  const defaultDays = [
    {
      academic_period_id:
        periodResult.data,
      day_of_week: 'monday',
      sequence_number: 1,
    },
    {
      academic_period_id:
        periodResult.data,
      day_of_week: 'tuesday',
      sequence_number: 2,
    },
    {
      academic_period_id:
        periodResult.data,
      day_of_week: 'wednesday',
      sequence_number: 3,
    },
    {
      academic_period_id:
        periodResult.data,
      day_of_week: 'thursday',
      sequence_number: 4,
    },
    {
      academic_period_id:
        periodResult.data,
      day_of_week: 'friday',
      sequence_number: 5,
    },
  ];

  const { error } = await supabase
    .from('working_days')
    .upsert(defaultDays, {
      onConflict:
        'academic_period_id,day_of_week',
      ignoreDuplicates: true,
    });

  if (error) {
    throw new Error(
      getDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    );
  }

  revalidateCalendarPages();
}

export async function createWorkingDayAction(
  _previousState: WorkingDayActionState,
  formData: FormData,
): Promise<WorkingDayActionState> {
  await requireHodAccess();

  const parsed =
    workingDayFormSchema.safeParse({
      academicPeriodId:
        formData.get('academicPeriodId'),
      dayOfWeek:
        formData.get('dayOfWeek'),
      sequenceNumber:
        formData.get('sequenceNumber'),
      notes:
        formData.get('notes') || undefined,
    });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Review the highlighted fields.',
      fieldErrors:
        parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('working_days')
    .insert({
      academic_period_id:
        parsed.data.academicPeriodId,
      day_of_week:
        parsed.data.dayOfWeek,
      sequence_number:
        parsed.data.sequenceNumber,
      notes: parsed.data.notes || null,
      is_enabled: true,
    });

  if (error) {
    return {
      status: 'error',
      message: getDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    };
  }

  revalidateCalendarPages();

  return {
    status: 'success',
    message:
      'Working Day created successfully.',
  };
}

export async function createTimeSlotAction(
  _previousState: TimeSlotActionState,
  formData: FormData,
): Promise<TimeSlotActionState> {
  await requireHodAccess();

  const parsed =
    timeSlotFormSchema.safeParse({
      academicPeriodId:
        formData.get('academicPeriodId'),
      name: formData.get('name'),
      code: formData.get('code'),
      slotType:
        formData.get('slotType'),
      startsAt:
        formData.get('startsAt'),
      endsAt:
        formData.get('endsAt'),
      sequenceNumber:
        formData.get('sequenceNumber'),
      notes:
        formData.get('notes') || undefined,
    });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Review the highlighted fields.',
      fieldErrors:
        parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('time_slots')
    .insert({
      academic_period_id:
        parsed.data.academicPeriodId,
      name: parsed.data.name,
      code: parsed.data.code,
      slot_type:
        parsed.data.slotType,
      starts_at:
        parsed.data.startsAt,
      ends_at:
        parsed.data.endsAt,
      sequence_number:
        parsed.data.sequenceNumber,
      notes: parsed.data.notes || null,
      is_enabled: true,
    });

  if (error) {
    return {
      status: 'error',
      message: getDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    };
  }

  revalidateCalendarPages();

  return {
    status: 'success',
    message:
      'Time Slot created successfully.',
  };
}

export async function setWorkingDayEnabledAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const idResult =
    timetableCalendarIdSchema.safeParse(
      formData.get('id'),
    );

  const enabled =
    formData.get('isEnabled') === 'true';

  if (!idResult.success) {
    throw new Error(
      'Invalid Working Day identifier.',
    );
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('working_days')
    .update({
      is_enabled: enabled,
    })
    .eq('id', idResult.data);

  if (error) {
    throw new Error(
      getDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    );
  }

  revalidateCalendarPages();
}

export async function setTimeSlotEnabledAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const idResult =
    timetableCalendarIdSchema.safeParse(
      formData.get('id'),
    );

  const enabled =
    formData.get('isEnabled') === 'true';

  if (!idResult.success) {
    throw new Error(
      'Invalid Time Slot identifier.',
    );
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('time_slots')
    .update({
      is_enabled: enabled,
    })
    .eq('id', idResult.data);

  if (error) {
    throw new Error(
      getDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    );
  }

  revalidateCalendarPages();
}