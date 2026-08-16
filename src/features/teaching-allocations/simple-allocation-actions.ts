'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';
const path = '/timetable/teaching-allocations';
export async function generateCurrentOfferingsAction(formData: FormData) {
  await requireHodAccess(); const period = String(formData.get('academicPeriodId') ?? '');
  if (!period) throw new Error('Select an Academic Period.');
  const db = await createClient(); const { data:generatedCount, error } = await db.rpc('generate_current_unit_offerings',{p_academic_period_id:period});
  if (error) throw new Error(error.message);
  const {data:mergeData,error:mergeError}=await db.rpc('merge_matching_unit_offerings',{p_academic_period_id:period});
  if(mergeError) throw new Error(mergeError.message);
  const {error:reconciliationError}=await db.rpc('reconcile_previous_trainer_assignments',{p_academic_period_id:period});
  if(reconciliationError) throw new Error(reconciliationError.message);
  const mergeResult=(mergeData??{}) as {mergedGroupCount?:number;mergedUnitCount?:number;skippedGroupCount?:number};
  const query=new URLSearchParams({
    period,
    generated:'1',
    created:String(generatedCount??0),
    autoMerged:String(mergeResult.mergedGroupCount??0),
    mergedUnits:String(mergeResult.mergedUnitCount??0),
    mergeSkipped:String(mergeResult.skippedGroupCount??0),
  });
  revalidatePath(path); revalidatePath('/timetable/unit-offerings'); revalidatePath('/timetable/readiness'); revalidatePath('/timetable/generator');
  redirect(`${path}?${query.toString()}`);
}
export async function reconcilePreviousAssignmentsAction(formData: FormData) {
  await requireHodAccess();
  const period=String(formData.get('academicPeriodId')??'');
  const query=new URLSearchParams();
  if(period) query.set('period',period);
  if(!period){
    query.set('reconciliationError','Select an Academic Period first.');
    redirect(`${path}?${query.toString()}`);
  }
  const db=await createClient();
  const {data,error}=await db.rpc('reconcile_previous_trainer_assignments',{
    p_academic_period_id:period,
  });
  if(error){
    query.set('reconciliationError',error.message);
    redirect(`${path}?${query.toString()}`);
  }
  const result=(data??{}) as {mergedCount?:number;restoredCount?:number;reviewCount?:number};
  query.set('reconciled','1');
  query.set('merged',String(result.mergedCount??0));
  query.set('restored',String(result.restoredCount??0));
  query.set('review',String(result.reviewCount??0));
  revalidatePath(path);
  revalidatePath('/timetable/generator');
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/editor');
  redirect(`${path}?${query.toString()}`);
}
export async function assignOfferingAction(formData: FormData) {
  await requireHodAccess(); const offering=String(formData.get('offeringId')??''); const trainer=String(formData.get('trainerId')??'');
  const period=String(formData.get('academicPeriodId')??'');
  const searchQuery=String(formData.get('searchQuery')??'').trim();
  const query=new URLSearchParams();
  if(period) query.set('period',period);
  if(searchQuery) query.set('q',searchQuery);
  if (!offering || !trainer) {
    query.set('allocationError','Select a trainer before assigning the unit.');
    redirect(`${path}?${query.toString()}`);
  }
  const db=await createClient(); const {error}=await db.rpc('assign_unit_offering_with_reservation',{p_offering_id:offering,p_trainer_id:trainer});
  if(error) {
    const availabilityRequired = /available teaching time|available for every fixed teaching session/i.test(error.message);
    query.set(
      'allocationError',
      availabilityRequired
        ? 'This trainer uses selected free times. Mark the required periods as available, save, then assign the unit again.'
        : error.message,
    );
    if (availabilityRequired) {
      query.set('availabilityTrainer', trainer);
      query.set('availabilityPeriod', period);
    }
    redirect(`${path}?${query.toString()}`);
  }
  revalidatePath(path); revalidatePath('/timetable/generator'); revalidatePath('/timetable/readiness'); revalidatePath('/timetable/reports');
  redirect(query.size>0?`${path}?${query.toString()}`:path);
}
export async function reserveOfferingWithoutTrainerAction(formData: FormData) {
  await requireHodAccess();
  const offering=String(formData.get('offeringId')??'');
  const period=String(formData.get('academicPeriodId')??'');
  const searchQuery=String(formData.get('searchQuery')??'').trim();
  const query=new URLSearchParams();
  if(period) query.set('period',period);
  if(searchQuery) query.set('q',searchQuery);
  if(!offering){
    query.set('allocationError','The unit offering was not found.');
    redirect(`${path}?${query.toString()}`);
  }
  const db=await createClient();
  const {error}=await db.rpc('reserve_unit_offering_without_trainer',{p_offering_id:offering});
  if(error){
    query.set('allocationError',error.message);
    redirect(`${path}?${query.toString()}`);
  }
  query.set('reservationSaved','1');
  revalidatePath(path); revalidatePath('/timetable/generator'); revalidatePath('/timetable/readiness'); revalidatePath('/timetable/reports');
  redirect(`${path}?${query.toString()}`);
}
export async function unassignTeachingAllocationAction(formData: FormData) {
  await requireHodAccess();
  const allocation=String(formData.get('allocationId')??'');
  const period=String(formData.get('academicPeriodId')??'');
  const allocationTrainer=String(formData.get('allocationTrainer')??'');
  const allocationQuery=String(formData.get('allocationQuery')??'').trim();
  const query=new URLSearchParams();
  if(period) query.set('period',period);
  if(allocationTrainer) query.set('allocationTrainer',allocationTrainer);
  if(allocationQuery) query.set('allocationQ',allocationQuery);
  if(!allocation){
    query.set('unassignError','The teaching allocation was not found.');
    redirect(`${path}?${query.toString()}`);
  }
  const db=await createClient();
  const {error}=await db.rpc('unassign_teaching_allocation',{p_allocation_id:allocation});
  if(error){
    query.set('unassignError',error.message);
    redirect(`${path}?${query.toString()}`);
  }
  query.set('unassigned','1');
  revalidatePath(path);
  revalidatePath('/timetable/generator');
  revalidatePath('/timetable/editor');
  revalidatePath('/timetable/conflicts');
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/published');
  revalidatePath('/timetable/reports');
  redirect(`${path}?${query.toString()}`);
}
export async function confirmSharedOfferingAction(formData: FormData) {
  await requireHodAccess();
  const offeringIds=formData.getAll('offeringId').map(String);
  const period=String(formData.get('academicPeriodId')??'');
  const searchQuery=String(formData.get('searchQuery')??'').trim();
  const query=new URLSearchParams();
  if(period) query.set('period',period);
  if(searchQuery) query.set('q',searchQuery);
  if(offeringIds.length<2) {
    query.set('allocationError','Select at least two matching units.');
    redirect(`${path}?${query.toString()}`);
  }
  const db=await createClient(); const {error}=await db.rpc('confirm_shared_unit_offerings',{p_offering_ids:offeringIds});
  if(error) {
    query.set('allocationError',error.message);
    redirect(`${path}?${query.toString()}`);
  }
  revalidatePath(path); revalidatePath('/timetable/unit-offerings'); revalidatePath('/timetable/readiness'); revalidatePath('/timetable/generator');
  redirect(query.size>0?`${path}?${query.toString()}`:path);
}
export async function setFixedScheduleAction(formData: FormData) {
  await requireHodAccess();
  const id=String(formData.get('offeringId')??'');
  const period=String(formData.get('academicPeriodId')??'');
  const searchQuery=String(formData.get('searchQuery')??'').trim();
  const scheduleMode=String(formData.get('scheduleMode')??'standard');
  const fullDay=String(formData.get('workingDayId')??'');
  const firstDay=String(formData.get('firstWorkingDayId')??'');
  const secondDay=String(formData.get('secondWorkingDayId')??'');
  const firstSlot=String(formData.get('firstTimeSlotId')??'');
  const secondSlot=String(formData.get('secondTimeSlotId')??'');
  const query=new URLSearchParams();
  if(period) query.set('period',period);
  if(searchQuery) query.set('q',searchQuery);
  const fail=(message:string):never=>{
    query.set('allocationError',message);
    redirect(`${path}?${query.toString()}`);
  };
  if(!id) fail('The unit offering was not found.');
  const db=await createClient();
  let error:{message:string}|null=null;
  if(scheduleMode==='full_day'){
    if(!fullDay) fail('Select the full-day rotation day.');
    ({error}=await db.rpc('set_unit_offering_full_day_schedule',{
      p_offering_id:id,
      p_working_day_id:fullDay,
    }));
  }else{
    if(!firstDay||!firstSlot) fail('Select the first day and teaching session.');
    if(Boolean(secondDay)!==Boolean(secondSlot)) fail('Select both the second day and second teaching session.');
    const workingDayIds=[firstDay,secondDay].filter(Boolean);
    const timeSlotIds=[firstSlot,secondSlot].filter(Boolean);
    const pairs=workingDayIds.map((day,index)=>`${day}:${timeSlotIds[index]}`);
    if(new Set(pairs).size!==pairs.length) fail('Choose a different day or session for the second period.');
    ({error}=await db.rpc('set_unit_offering_fixed_session_pattern',{
      p_offering_id:id,
      p_working_day_ids:workingDayIds,
      p_time_slot_ids:timeSlotIds,
    }));
  }
  if(error) fail(error.message);
  revalidatePath(path);
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/generator');
  redirect(query.size>0?`${path}?${query.toString()}`:path);
}
