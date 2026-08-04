'use server';
import { revalidatePath } from 'next/cache';
import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';
import { constraintIdSchema, schedulingConstraintSchema } from './validation';

export async function createSchedulingConstraintAction(formData: FormData): Promise<void> {
  await requireHodAccess();
  const parsed = schedulingConstraintSchema.safeParse({
    academicPeriodId: formData.get('academicPeriodId'), subjectType: formData.get('subjectType'), subjectId: formData.get('subjectId'),
    constraintType: formData.get('constraintType'), workingDayId: formData.get('workingDayId'), startsAt: formData.get('startsAt'),
    endsAt: formData.get('endsAt'), priority: formData.get('priority'), reason: formData.get('reason'),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid scheduling constraint.');
  const supabase = await createClient();
  const { error } = await supabase.from('scheduling_constraints').insert({
    academic_period_id: parsed.data.academicPeriodId,
    subject_type: parsed.data.subjectType,
    subject_id: parsed.data.subjectType === 'institution' ? null : parsed.data.subjectId,
    constraint_type: parsed.data.constraintType,
    working_day_id: parsed.data.workingDayId ?? null,
    starts_at: parsed.data.startsAt ?? null,
    ends_at: parsed.data.endsAt ?? null,
    priority: parsed.data.priority,
    reason: parsed.data.reason,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/timetable/constraints'); revalidatePath('/timetable/readiness'); revalidatePath('/timetable/generator');
}

export async function toggleSchedulingConstraintAction(formData: FormData): Promise<void> {
  await requireHodAccess();
  const id = constraintIdSchema.parse(formData.get('id'));
  const isActive = formData.get('isActive') === 'true';
  const supabase = await createClient();
  const { error } = await supabase.from('scheduling_constraints').update({ is_active: isActive }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/timetable/constraints'); revalidatePath('/timetable/readiness'); revalidatePath('/timetable/generator');
}

export async function deleteSchedulingConstraintAction(formData: FormData): Promise<void> {
  await requireHodAccess();
  const id = constraintIdSchema.parse(formData.get('id'));
  const supabase = await createClient();
  const { error } = await supabase.from('scheduling_constraints').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/timetable/constraints'); revalidatePath('/timetable/readiness'); revalidatePath('/timetable/generator');
}
