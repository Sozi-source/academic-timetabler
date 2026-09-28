'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

function getSafeReturnTo(value: FormDataEntryValue | null) {
  const requested = String(value ?? '');

  return requested.startsWith('/timetable/teaching-allocations') &&
    !requested.startsWith('//')
    ? requested
    : '';
}

function revalidateAvailabilityPages() {
  revalidatePath('/timetable/trainers');
  revalidatePath('/timetable/trainers/availability');
  revalidatePath('/timetable/teaching-allocations');
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/generator');
}

export async function saveTrainerAvailabilityAction(formData: FormData) {
  await requireHodAccess();

  const trainerId = String(formData.get('trainerId') ?? '');
  const periodId = String(formData.get('academicPeriodId') ?? '');
  const returnTo = getSafeReturnTo(formData.get('returnTo'));

  if (!trainerId || !periodId) {
    throw new Error('Select a trainer and Academic Period.');
  }

  const db = await createClient();

  const [daysResult, slotsResult, trainerResult] = await Promise.all([
    db
      .from('working_days')
      .select('id')
      .eq('academic_period_id', periodId)
      .eq('is_enabled', true),
    db
      .from('time_slots')
      .select('id')
      .eq('academic_period_id', periodId)
      .eq('is_enabled', true)
      .eq('slot_type', 'teaching'),
    db
      .from('trainers')
      .select('id, availability_mode')
      .eq('id', trainerId)
      .maybeSingle(),
  ]);

  const calendarError =
    daysResult.error ?? slotsResult.error ?? trainerResult.error;
  if (calendarError) {
    throw new Error(calendarError.message);
  }

  const validDayIds = new Set((daysResult.data ?? []).map((item) => item.id));
  const validSlotIds = new Set((slotsResult.data ?? []).map((item) => item.id));
  const uniquePairs = new Set<string>();

  const rows = formData
    .getAll('availableSlot')
    .map((value) => String(value).split(':'))
    .filter((parts) => parts.length === 2)
    .filter(([workingDayId, timeSlotId]) =>
      validDayIds.has(workingDayId) && validSlotIds.has(timeSlotId),
    )
    .filter(([workingDayId, timeSlotId]) => {
      const key = `${workingDayId}:${timeSlotId}`;
      if (uniquePairs.has(key)) return false;
      uniquePairs.add(key);
      return true;
    })
    .map(([working_day_id, time_slot_id]) => ({
      trainer_id: trainerId,
      academic_period_id: periodId,
      working_day_id,
      time_slot_id,
    }));

  if (!trainerResult.data) {
    throw new Error('Trainer not found.');
  }

  const totalAvailableSlots = validDayIds.size * validSlotIds.size;
  const allSessionsSelected =
    totalAvailableSlots > 0 && rows.length === totalAvailableSlots;
  const preserveStandardWeek =
    trainerResult.data.availability_mode === 'generally_available' &&
    allSessionsSelected;

  const { error: deleteError } = await db
    .from('trainer_availability')
    .delete()
    .eq('trainer_id', trainerId)
    .eq('academic_period_id', periodId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (!preserveStandardWeek && rows.length) {
    const { error: insertError } = await db
      .from('trainer_availability')
      .insert(rows);

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  const { error: trainerError } = await db
    .from('trainers')
    .update({
      availability_mode: preserveStandardWeek
        ? 'generally_available'
        : 'selected_slots_only',
    })
    .eq('id', trainerId);

  if (trainerError) {
    throw new Error(trainerError.message);
  }

  revalidateAvailabilityPages();

  if (returnTo) {
    const separator = returnTo.includes('?') ? '&' : '?';
    redirect(`${returnTo}${separator}availabilitySaved=1`);
  }

  redirect(
    `/timetable/trainers/availability?trainer=${trainerId}&period=${periodId}&saved=1&mode=${preserveStandardWeek ? 'standard' : 'custom'}`,
  );
}

export async function resetTrainerAvailabilityAction(formData: FormData) {
  await requireHodAccess();

  const trainerId = String(formData.get('trainerId') ?? '');
  const periodId = String(formData.get('academicPeriodId') ?? '');

  if (!trainerId || !periodId) {
    throw new Error('Select a trainer and Academic Period.');
  }

  const db = await createClient();

  const { error: deleteError } = await db
    .from('trainer_availability')
    .delete()
    .eq('trainer_id', trainerId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { error: trainerError } = await db
    .from('trainers')
    .update({ availability_mode: 'generally_available' })
    .eq('id', trainerId);

  if (trainerError) {
    throw new Error(trainerError.message);
  }

  revalidateAvailabilityPages();

  redirect(
    `/timetable/trainers/availability?trainer=${trainerId}&period=${periodId}&saved=1&mode=standard`,
  );
}
