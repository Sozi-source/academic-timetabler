'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import {
  constraintIdSchema,
  schedulingConstraintSchema,
  timetableCalendarEventSchema,
} from './validation';

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
      throw new Error(
        'Select a valid teaching session for this Academic Period.',
      );
    }

    startsAt = timeSlot.starts_at;
    endsAt = timeSlot.ends_at;
  }

  const reason = parsed.data.reason?.trim() || 'Scheduling restriction';

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

export async function createCalendarEventAction(
  formData: FormData,
): Promise<void> {
  const profile = await requireHodAccess();

  if (!profile.activeDepartmentId) {
    throw new Error('Select a working department before adding an event.');
  }

  const parsed = timetableCalendarEventSchema.safeParse({
    academicPeriodId: formData.get('academicPeriodId'),
    title: formData.get('title'),
    eventType: formData.get('eventType'),
    eventDate: formData.get('eventDate'),
    timeSlotId: formData.get('timeSlotId'),
    scopeType: formData.get('scopeType'),
    scopeId: formData.get('scopeId'),
    suspendsRegularClasses: formData.get('suspendsRegularClasses') !== 'false',
    notes: formData.get('notes'),
  });

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? 'Invalid unique event details.',
    );
  }

  const supabase = await createClient();

  let startsAt: string | null = null;
  let endsAt: string | null = null;

  if (parsed.data.timeSlotId) {
    const { data: timeSlot, error: slotError } = await supabase
      .from('time_slots')
      .select('id, academic_period_id, starts_at, ends_at, is_enabled')
      .eq('id', parsed.data.timeSlotId)
      .maybeSingle();

    if (slotError) {
      throw new Error(slotError.message);
    }

    if (
      !timeSlot ||
      timeSlot.academic_period_id !== parsed.data.academicPeriodId ||
      !timeSlot.is_enabled
    ) {
      throw new Error('Select a valid session for this Academic Period.');
    }

    startsAt = timeSlot.starts_at;
    endsAt = timeSlot.ends_at;
  }

  const { error } = await supabase.from('timetable_calendar_events').insert({
    academic_period_id: parsed.data.academicPeriodId,
    department_id: profile.activeDepartmentId,
    title: parsed.data.title,
    event_type: parsed.data.eventType,
    event_date: parsed.data.eventDate,
    starts_at: startsAt,
    ends_at: endsAt,
    scope_type: parsed.data.scopeType,
    scope_id:
      parsed.data.scopeType === 'institution' ? null : parsed.data.scopeId,
    suspends_regular_classes: parsed.data.suspendsRegularClasses,
    notes: parsed.data.notes?.trim() || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/timetable/constraints');
}

export async function toggleCalendarEventAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();
  const id = constraintIdSchema.parse(formData.get('id'));
  const isActive = formData.get('isActive') === 'true';
  const supabase = await createClient();

  const { error } = await supabase
    .from('timetable_calendar_events')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/timetable/constraints');
}

export async function deleteCalendarEventAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();
  const id = constraintIdSchema.parse(formData.get('id'));
  const supabase = await createClient();

  const { error } = await supabase
    .from('timetable_calendar_events')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/timetable/constraints');
}
