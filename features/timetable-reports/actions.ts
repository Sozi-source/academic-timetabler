'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import { manualTrainerEntrySchema, manualTrainerVenueSchema, type ManualEntryActionState } from './manual-entry';

export async function createManualTrainerEntryAction(
  _previous: ManualEntryActionState,
  formData: FormData,
): Promise<ManualEntryActionState> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return { status: 'error', message: 'Select an active department first.' };

  const parsed = manualTrainerEntrySchema.safeParse({
    academicPeriodId: formData.get('academicPeriodId'), trainerId: formData.get('trainerId'),
    workingDayId: formData.get('workingDayId'), timeSlotId: formData.get('timeSlotId'),
    unitCode: formData.get('unitCode') || undefined, unitName: formData.get('unitName'), cohortLabel: formData.get('cohortLabel'),
    sourceDepartmentId: formData.get('sourceDepartmentId'),
    roomId: formData.get('roomId') || '',
    notes: formData.get('notes') || undefined,
  });
  if (!parsed.success) return { status: 'error', message: 'Complete all required unit and timetable fields.' };

  const db = await createClient();
  const [dayResult, slotResult, departmentResult, roomResult] = await Promise.all([
    db.from('working_days').select('day_of_week, sequence_number').eq('id', parsed.data.workingDayId).eq('academic_period_id', parsed.data.academicPeriodId).single(),
    db.from('time_slots').select('starts_at, ends_at').eq('id', parsed.data.timeSlotId).eq('academic_period_id', parsed.data.academicPeriodId).single(),
    db.from('departments').select('code, name').eq('id', parsed.data.sourceDepartmentId).eq('is_active', true).single(),
    parsed.data.roomId
      ? db.from('rooms').select('code, name').eq('id', parsed.data.roomId).eq('is_active', true).eq('is_timetable_available', true).single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (dayResult.error || slotResult.error || departmentResult.error || roomResult.error) return { status: 'error', message: 'The selected department, day, time, or venue is not valid.' };

  const { error } = await db.from('manual_trainer_timetable_entries').insert({
    academic_period_id: parsed.data.academicPeriodId, trainer_id: parsed.data.trainerId,
    created_by_department_id: profile.activeDepartmentId,
    unit_code: parsed.data.unitCode || '—', unit_name: parsed.data.unitName, cohort_label: parsed.data.cohortLabel,
    source_department_code: departmentResult.data.code, source_department_name: departmentResult.data.name,
    day_label: dayResult.data.day_of_week.charAt(0).toUpperCase() + dayResult.data.day_of_week.slice(1),
    day_sequence: dayResult.data.sequence_number, starts_at: slotResult.data.starts_at, ends_at: slotResult.data.ends_at,
    room_code: roomResult.data?.code ?? null, room_name: roomResult.data?.name ?? 'No room assigned', notes: parsed.data.notes || null,
  });
  if (error) return { status: 'error', message: error.message };
  revalidatePath('/timetable/reports');
  return { status: 'success', message: 'Unit added to the trainer’s personal timetable.' };
}

export async function updateManualTrainerVenueAction(
  _previous: ManualEntryActionState,
  formData: FormData,
): Promise<ManualEntryActionState> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return { status: 'error', message: 'Select an active department first.' };

  const parsed = manualTrainerVenueSchema.safeParse({
    entryId: formData.get('entryId'),
    academicPeriodId: formData.get('academicPeriodId'),
    roomId: formData.get('roomId') || '',
  });
  if (!parsed.success) return { status: 'error', message: 'Select a valid venue.' };

  const db = await createClient();
  const roomResult = parsed.data.roomId
    ? await db.from('rooms').select('code, name').eq('id', parsed.data.roomId).eq('is_active', true).eq('is_timetable_available', true).single()
    : { data: null, error: null };
  if (roomResult.error) return { status: 'error', message: 'The selected venue is not available.' };

  const { data, error } = await db.from('manual_trainer_timetable_entries')
    .update({ room_code: roomResult.data?.code ?? null, room_name: roomResult.data?.name ?? 'No room assigned' })
    .eq('id', parsed.data.entryId)
    .eq('academic_period_id', parsed.data.academicPeriodId)
    .eq('created_by_department_id', profile.activeDepartmentId)
    .select('id')
    .maybeSingle();
  if (error) return { status: 'error', message: error.message };
  if (!data) return { status: 'error', message: 'This manual entry belongs to another department and cannot be edited here.' };

  revalidatePath('/timetable/reports');
  return { status: 'success', message: 'Venue updated successfully.' };
}
