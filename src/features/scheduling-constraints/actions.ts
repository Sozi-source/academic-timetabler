'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import { constraintIdSchema, schedulingConstraintSchema } from './validation';

const defaultReasons = {
  unavailable: 'Unavailable',
  preferred: 'Preferred scheduling time',
  required: 'Required scheduling time',
  protected_day: 'Protected day',
} as const;

export async function createSchedulingConstraintAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const parsed = schedulingConstraintSchema.safeParse({
    academicPeriodId: formData.get('academicPeriodId'),
    subjectType: formData.get('subjectType'),
    subjectId: formData.get('subjectId'),
    constraintType: formData.get('constraintType'),
    workingDayId: formData.get('workingDayId'),
    timeSlotId: formData.get('timeSlotId'),
    priority: formData.get('priority'),
    reason: formData.get('reason'),
  });

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? 'Invalid scheduling constraint.',
    );
  }

  const supabase = await createClient();

  if (parsed.data.workingDayId) {
    const { data: workingDay, error: dayError } = await supabase
      .from('working_days')
      .select('id, academic_period_id, is_enabled')
      .eq('id', parsed.data.workingDayId)
      .maybeSingle();

    if (dayError) {
      throw new Error(dayError.message);
    }

    if (
      !workingDay ||
      workingDay.academic_period_id !== parsed.data.academicPeriodId ||
      !workingDay.is_enabled
    ) {
      throw new Error('Select a valid working day for this Academic Period.');
    }
  }

  let startsAt: string | null = null;
  let endsAt: string | null = null;

  if (parsed.data.timeSlotId) {
    const { data: timeSlot, error: timeSlotError } = await supabase
      .from('time_slots')
      .select('id, academic_period_id, slot_type, starts_at, ends_at, is_enabled')
      .eq('id', parsed.data.timeSlotId)
      .maybeSingle();

    if (timeSlotError) {
      throw new Error(timeSlotError.message);
    }

    if (
      !timeSlot ||
      timeSlot.academic_period_id !== parsed.data.academicPeriodId ||
      timeSlot.slot_type !== 'teaching' ||
      !timeSlot.is_enabled
    ) {
      throw new Error('Select a valid teaching session for this Academic Period.');
    }

    startsAt = timeSlot.starts_at;
    endsAt = timeSlot.ends_at;
  }

  const reason =
    parsed.data.reason?.trim() || defaultReasons[parsed.data.constraintType];

  const { error } = await supabase.from('scheduling_constraints').insert({
    academic_period_id: parsed.data.academicPeriodId,
    subject_type: parsed.data.subjectType,
    subject_id:
      parsed.data.subjectType === 'institution'
        ? null
        : parsed.data.subjectId,
    constraint_type: parsed.data.constraintType,
    working_day_id: parsed.data.workingDayId ?? null,
    starts_at: startsAt,
    ends_at: endsAt,
    priority: parsed.data.priority,
    reason,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/timetable/constraints');
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/generator');
}

export async function toggleSchedulingConstraintAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const id = constraintIdSchema.parse(formData.get('id'));
  const isActive = formData.get('isActive') === 'true';
  const supabase = await createClient();

  const { error } = await supabase
    .from('scheduling_constraints')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/timetable/constraints');
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/generator');
}

export async function deleteSchedulingConstraintAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const id = constraintIdSchema.parse(formData.get('id'));
  const supabase = await createClient();

  const { error } = await supabase
    .from('scheduling_constraints')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/timetable/constraints');
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/generator');
}
