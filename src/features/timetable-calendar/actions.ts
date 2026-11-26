'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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
  revalidatePath('/timetable/trainers/availability');
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/generator');
  revalidatePath('/timetable/teaching-allocations');
}

async function propagateCalendarSetupForward(
  supabase: Awaited<ReturnType<typeof createClient>>,
  periodId: string,
) {
  const { error } = await supabase.rpc(
    'propagate_timetable_setup_to_planned_periods',
    {
      p_source_period_id: periodId,
    },
  );
  if (error) {
    throw new Error(getDatabaseErrorMessage(error.code, error.message));
  }
}

export async function initializeStandardCalendarAction(formData: FormData): Promise<void> {
  await requireHodAccess();
  const periodResult=academicPeriodIdSchema.safeParse(formData.get('academicPeriodId'));
  if(!periodResult.success) throw new Error('Invalid Academic Period.');
  const supabase=await createClient();
  const {error}=await supabase.rpc('initialize_standard_timetable_calendar',{p_academic_period_id:periodResult.data});
  if(error) throw new Error(getDatabaseErrorMessage(error.code,error.message));
  await propagateCalendarSetupForward(supabase, periodResult.data);
  revalidateCalendarPages();
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

  await propagateCalendarSetupForward(supabase, periodResult.data);
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

  await propagateCalendarSetupForward(
    supabase,
    parsed.data.academicPeriodId,
  );
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

  await propagateCalendarSetupForward(
    supabase,
    parsed.data.academicPeriodId,
  );
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

  const { data: updatedDay, error } = await supabase
    .from('working_days')
    .update({
      is_enabled: enabled,
    })
    .eq('id', idResult.data)
    .select('academic_period_id')
    .maybeSingle();

  if (error) {
    throw new Error(
      getDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    );
  }

  if (enabled && updatedDay?.academic_period_id) {
    await propagateCalendarSetupForward(
      supabase,
      updatedDay.academic_period_id,
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

  const { data: updatedSlot, error } = await supabase
    .from('time_slots')
    .update({
      is_enabled: enabled,
    })
    .eq('id', idResult.data)
    .select('academic_period_id')
    .maybeSingle();

  if (error) {
    throw new Error(
      getDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    );
  }

  if (enabled && updatedSlot?.academic_period_id) {
    await propagateCalendarSetupForward(
      supabase,
      updatedSlot.academic_period_id,
    );
  }
  revalidateCalendarPages();
}

export async function carryForwardTimetableSetupAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const sourceResult = academicPeriodIdSchema.safeParse(
    formData.get('sourceAcademicPeriodId'),
  );
  const targetResult = academicPeriodIdSchema.safeParse(
    formData.get('targetAcademicPeriodId'),
  );
  const returnTo = String(formData.get('returnTo') ?? '').trim();

  if (!sourceResult.success || !targetResult.success) {
    throw new Error('Select valid source and target Academic Periods.');
  }

  if (sourceResult.data === targetResult.data) {
    throw new Error('Choose a different source Academic Period.');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('carry_forward_timetable_setup', {
    p_source_period_id: sourceResult.data,
    p_target_period_id: targetResult.data,
  });

  if (error) {
    throw new Error(getDatabaseErrorMessage(error.code, error.message));
  }

  revalidateCalendarPages();
  if (returnTo && returnTo.startsWith('/timetable')) {
    redirect(returnTo);
  }
}
