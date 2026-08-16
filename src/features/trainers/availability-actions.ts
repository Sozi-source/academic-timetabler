'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

export async function saveTrainerAvailabilityAction(formData: FormData) {
  await requireHodAccess();
  const trainerId=String(formData.get('trainerId')??''); const periodId=String(formData.get('academicPeriodId')??'');
  const requestedReturnTo=String(formData.get('returnTo')??'');
  const returnTo=requestedReturnTo.startsWith('/timetable/teaching-allocations')&&!requestedReturnTo.startsWith('//')
    ? requestedReturnTo
    : '';
  if(!trainerId||!periodId) throw new Error('Select a trainer and Academic Period.');
  const db=await createClient();
  const {error:deleteError}=await db.from('trainer_availability').delete().eq('trainer_id',trainerId).eq('academic_period_id',periodId);
  if(deleteError) throw new Error(deleteError.message);
  const rows=formData.getAll('availableSlot').map(value=>String(value).split(':')).filter(parts=>parts.length===2).map(([working_day_id,time_slot_id])=>({trainer_id:trainerId,academic_period_id:periodId,working_day_id,time_slot_id}));
  if(rows.length){const {error}=await db.from('trainer_availability').insert(rows);if(error) throw new Error(error.message);}
  revalidatePath('/timetable/trainers/availability');
  revalidatePath('/timetable/teaching-allocations');
  if(returnTo){
    const separator=returnTo.includes('?')?'&':'?';
    redirect(`${returnTo}${separator}availabilitySaved=1`);
  }
  redirect(`/timetable/trainers/availability?trainer=${trainerId}&period=${periodId}&saved=1`);
}
