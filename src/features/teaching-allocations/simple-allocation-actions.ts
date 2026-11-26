'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type { InlineAllocationMutationState } from './inline-allocation-state';
const path = '/timetable/teaching-allocations';

export async function generateCurrentOfferingsAction(formData: FormData) {
  await requireHodAccess(); const period = String(formData.get('academicPeriodId') ?? '');
  if (!period) {
    redirect(`${path}?allocationError=${encodeURIComponent('Select an Academic Period.')}`);
  }
  const db = await createClient(); const { data:generatedCount, error } = await db.rpc('generate_current_unit_offerings',{p_academic_period_id:period});
  if (error) {
    const errQuery = new URLSearchParams({ period, allocationError: error.message });
    redirect(`${path}?${errQuery.toString()}`);
  }
  const query=new URLSearchParams({
    period,
    generated:'1',
    created:String(generatedCount??0),
    autoMerged:'0',
    mergedUnits:'0',
    mergeSkipped:'0',
  });
  revalidatePath(path); revalidatePath('/timetable/unit-offerings'); revalidatePath('/timetable/readiness'); revalidatePath('/timetable/generator');
  redirect(`${path}?${query.toString()}`);
}

export async function combineMatchingUnitOfferingsAction(formData: FormData) {
  await requireHodAccess();
  const period = String(formData.get('academicPeriodId') ?? '').trim();
  const returnPath = String(formData.get('returnTo') ?? '').trim();
  if (!period) throw new Error('Select an Academic Period.');
  const db = await createClient();
  const { data, error } = await db.rpc('merge_matching_unit_offerings', {
    p_academic_period_id: period,
  });
  if (error) {
    const target = returnPath.startsWith('/timetable/unit-offerings') ? returnPath : path;
    const query = new URLSearchParams({ period, allocationError: error.message, approvalError: error.message });
    redirect(`${target}?${query.toString()}`);
  }
  const result = (data ?? {}) as {
    mergedGroupCount?: number;
    mergedUnitCount?: number;
    skippedGroupCount?: number;
  };
  revalidatePath(path);
  revalidatePath('/timetable/unit-offerings');
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/generator');
  revalidatePath('/timetable/editor');

  const target = returnPath.startsWith('/timetable/unit-offerings') ? returnPath : path;
  const query = new URLSearchParams({
    period,
    autoMerged: String(result.mergedGroupCount ?? 0),
    mergedUnits: String(result.mergedUnitCount ?? 0),
    mergeSkipped: String(result.skippedGroupCount ?? 0),
  });
  redirect(`${target}?${query.toString()}`);
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

async function performAssignOffering(
  formData: FormData,
): Promise<Omit<InlineAllocationMutationState, 'sequence'>> {
  await requireHodAccess();
  const offering = String(formData.get('offeringId') ?? '');
  const trainer = String(formData.get('trainerId') ?? '');
  const period = String(formData.get('academicPeriodId') ?? '');
  if (!offering || !trainer) {
    return {
      status: 'error',
      message: 'Select a trainer before assigning the unit.',
    };
  }
  const db = await createClient();

  // Fetch source offering configuration before assigning
  const { data: offeringRecord } = await db
    .from('unit_offerings')
    .select('id, academic_period_id, cohort_id, unit_id, confirmed_shared_offering_id, fixed_schedule_required, is_full_day_session, session_duration_minutes, weekly_sessions, fixed_working_day_id, fixed_time_slot_id, unit_offering_fixed_slots(working_day_id, time_slot_id)')
    .eq('id', offering)
    .maybeSingle();

  // If this offering has an agreed fixed schedule (e.g. cross-dept service unit),
  // automatically authorize those agreed slots in trainer_availability so the HOD
  // does not have to check the same slots in two separate screens.
  if (offeringRecord?.fixed_schedule_required) {
    const { data: trainerRecord } = await db
      .from('trainers')
      .select('id, availability_mode')
      .eq('id', trainer)
      .maybeSingle();

    if (trainerRecord?.availability_mode === 'selected_slots_only') {
      const agreedPairs = new Map<string, { working_day_id: string; time_slot_id: string }>();
      for (const slotRow of offeringRecord.unit_offering_fixed_slots ?? []) {
        if (slotRow.working_day_id && slotRow.time_slot_id) {
          agreedPairs.set(`${slotRow.working_day_id}:${slotRow.time_slot_id}`, {
            working_day_id: slotRow.working_day_id,
            time_slot_id: slotRow.time_slot_id,
          });
        }
      }
      if (offeringRecord.fixed_working_day_id && offeringRecord.fixed_time_slot_id) {
        agreedPairs.set(
          `${offeringRecord.fixed_working_day_id}:${offeringRecord.fixed_time_slot_id}`,
          {
            working_day_id: offeringRecord.fixed_working_day_id,
            time_slot_id: offeringRecord.fixed_time_slot_id,
          },
        );
      }

      if (agreedPairs.size > 0) {
        await db.from('trainer_availability').upsert(
          [...agreedPairs.values()].map((pair) => ({
            trainer_id: trainer,
            academic_period_id: offeringRecord.academic_period_id,
            working_day_id: pair.working_day_id,
            time_slot_id: pair.time_slot_id,
          })),
          {
            onConflict: 'trainer_id,academic_period_id,working_day_id,time_slot_id',
            ignoreDuplicates: true,
          },
        );
      }
    }
  }

  // Ensure the underlying unit(s) are active and timetable available
  if (offeringRecord?.unit_id) {
    await db
      .from('units')
      .update({
        is_active: true,
        is_timetable_available: true,
      })
      .eq('id', offeringRecord.unit_id);
  }

  if (offeringRecord?.confirmed_shared_offering_id) {
    const { data: participants } = await db
      .from('unit_offerings')
      .select('unit_id')
      .eq('confirmed_shared_offering_id', offeringRecord.confirmed_shared_offering_id);
    if (participants && participants.length > 0) {
      const unitIds = participants.map((p) => p.unit_id).filter(Boolean);
      await db
        .from('units')
        .update({
          is_active: true,
          is_timetable_available: true,
        })
        .in('id', unitIds);
    }
  }

  const { data: assignResult, error } = await db.rpc('assign_unit_offering_authoritatively', {
    p_offering_id: offering,
    p_trainer_id: trainer,
  });

  if (error) {
    const availabilityRequired = /available teaching time|available for every fixed teaching session/i.test(error.message);
    return {
      status: 'error',
      message: availabilityRequired
        ? 'This trainer uses selected free times. Mark the required periods as available, save, then assign the unit again.'
        : error.message,
      availabilityRequired: availabilityRequired
        ? { trainerId: trainer, periodId: period }
        : undefined,
    };
  }

  const rescheduleNeeded = Boolean(
    (assignResult as { rescheduleRequired?: boolean } | null)?.rescheduleRequired,
  );

  // Ensure teaching_allocations maintains consistent duration, fixed schedule, and mode
  if (offeringRecord) {
    if (offeringRecord.is_full_day_session) {
      const allocUpdate = {
        is_full_day_session: true,
        session_duration_minutes: 480,
        weekly_sessions: 1,
        delivery_mode: 'clinical' as const,
        fixed_working_day_id: offeringRecord.fixed_working_day_id,
        fixed_working_day_ids: offeringRecord.fixed_working_day_id ? [offeringRecord.fixed_working_day_id] : [],
        fixed_time_slot_ids: offeringRecord.fixed_time_slot_id ? [offeringRecord.fixed_time_slot_id] : [],
        updated_at: new Date().toISOString(),
      };
      if (offeringRecord.confirmed_shared_offering_id) {
        await db
          .from('teaching_allocations')
          .update(allocUpdate)
          .eq('academic_period_id', period)
          .eq('teaching_offering_id', offeringRecord.confirmed_shared_offering_id);
      } else {
        await db
          .from('teaching_allocations')
          .update(allocUpdate)
          .eq('academic_period_id', period)
          .eq('cohort_id', offeringRecord.cohort_id)
          .eq('unit_id', offeringRecord.unit_id);
      }
    } else {
      const sessionDuration = offeringRecord.session_duration_minutes ?? 120;
      const weeklyCount = offeringRecord.weekly_sessions ?? 1;
      const allocUpdate = {
        is_full_day_session: false,
        session_duration_minutes: sessionDuration,
        weekly_sessions: weeklyCount,
        delivery_mode: 'theory' as const,
        updated_at: new Date().toISOString(),
      };
      if (offeringRecord.confirmed_shared_offering_id) {
        await db
          .from('teaching_allocations')
          .update(allocUpdate)
          .eq('academic_period_id', period)
          .eq('teaching_offering_id', offeringRecord.confirmed_shared_offering_id);
      } else {
        await db
          .from('teaching_allocations')
          .update(allocUpdate)
          .eq('academic_period_id', period)
          .eq('cohort_id', offeringRecord.cohort_id)
          .eq('unit_id', offeringRecord.unit_id);
      }
    }
  }

  revalidatePath(path);
  revalidatePath('/timetable/generator');
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/reports');

  return {
    status: 'success',
    rescheduleNeeded,
  };
}

export async function assignOfferingInlineAction(
  prevState: InlineAllocationMutationState,
  formData: FormData,
): Promise<InlineAllocationMutationState> {
  const result = await performAssignOffering(formData);
  return {
    ...result,
    sequence: prevState.sequence + 1,
  };
}

export async function assignOfferingAction(formData: FormData) {
  const period = String(formData.get('academicPeriodId') ?? '');
  const searchQuery = String(formData.get('searchQuery') ?? '').trim();
  const query = new URLSearchParams();
  if (period) query.set('period', period);
  if (searchQuery) query.set('q', searchQuery);

  const result = await performAssignOffering(formData);
  if (result.status === 'error') {
    query.set('allocationError', result.message ?? 'The timetable change was not saved.');
    if (result.availabilityRequired) {
      query.set('availabilityTrainer', result.availabilityRequired.trainerId);
      query.set('availabilityPeriod', result.availabilityRequired.periodId);
    }
    redirect(`${path}?${query.toString()}`);
  }

  if (result.rescheduleNeeded) {
    query.set('rescheduleNeeded', '1');
  }
  query.set('assigned', '1');
  redirect(`${path}?${query.toString()}`);
}

async function performReserveOfferingWithoutTrainer(
  formData: FormData,
): Promise<Omit<InlineAllocationMutationState, 'sequence'>> {
  await requireHodAccess();
  const offering = String(formData.get('offeringId') ?? '');
  if (!offering) {
    return { status: 'error', message: 'The unit offering was not found.' };
  }
  const db = await createClient();
  const { error } = await db.rpc('reserve_unit_offering_without_trainer', {
    p_offering_id: offering,
  });
  if (error) {
    return { status: 'error', message: error.message };
  }
  revalidatePath(path);
  revalidatePath('/timetable/generator');
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/reports');
  return { status: 'success' };
}

export async function reserveOfferingWithoutTrainerInlineAction(
  prevState: InlineAllocationMutationState,
  formData: FormData,
): Promise<InlineAllocationMutationState> {
  const result = await performReserveOfferingWithoutTrainer(formData);
  return { ...result, sequence: prevState.sequence + 1 };
}

export async function reserveOfferingWithoutTrainerAction(formData: FormData) {
  const period = String(formData.get('academicPeriodId') ?? '');
  const searchQuery = String(formData.get('searchQuery') ?? '').trim();
  const query = new URLSearchParams();
  if (period) query.set('period', period);
  if (searchQuery) query.set('q', searchQuery);
  const result = await performReserveOfferingWithoutTrainer(formData);
  if (result.status === 'error') {
    query.set('allocationError', result.message ?? 'The timetable change was not saved.');
    redirect(`${path}?${query.toString()}`);
  }
  query.set('reservationSaved', '1');
  redirect(`${path}?${query.toString()}`);
}

export async function reserveAllOpenOfferingsAction(formData: FormData) {
  await requireHodAccess();
  const period = String(formData.get('academicPeriodId') ?? '').trim();
  const searchQuery = String(formData.get('searchQuery') ?? '').trim();
  const query = new URLSearchParams();
  if (period) query.set('period', period);
  if (searchQuery) query.set('q', searchQuery);
  if (!period) {
    query.set('allocationError', 'Select an Academic Period first.');
    redirect(`${path}?${query.toString()}`);
  }

  const db = await createClient();
  const { data, error } = await db.rpc('include_all_unassigned_unit_offerings', {
    p_academic_period_id: period,
  });

  if (error) {
    query.set('allocationError', error.message);
    redirect(`${path}?${query.toString()}`);
  }

  const result = (data ?? {}) as { includedAllocationCount?: number };
  query.set('bulkReserved', String(result.includedAllocationCount ?? 0));
  revalidatePath(path);
  revalidatePath('/timetable/generator');
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/reports');
  redirect(`${path}?${query.toString()}`);
}

async function performUnassignTeachingAllocation(
  formData: FormData,
): Promise<Omit<InlineAllocationMutationState, 'sequence'>> {
  await requireHodAccess();
  const allocation = String(formData.get('allocationId') ?? '');
  if (!allocation) {
    return { status: 'error', message: 'The teaching allocation was not found.' };
  }
  const db = await createClient();
  const { error } = await db.rpc('unassign_teaching_allocation', {
    p_allocation_id: allocation,
  });
  if (error) {
    return { status: 'error', message: error.message };
  }
  revalidatePath(path);
  revalidatePath('/timetable/generator');
  revalidatePath('/timetable/editor');
  revalidatePath('/timetable/conflicts');
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/published');
  revalidatePath('/timetable/reports');
  return { status: 'success' };
}

export async function unassignTeachingAllocationInlineAction(
  prevState: InlineAllocationMutationState,
  formData: FormData,
): Promise<InlineAllocationMutationState> {
  const result = await performUnassignTeachingAllocation(formData);
  return { ...result, sequence: prevState.sequence + 1 };
}

export async function unassignTeachingAllocationAction(formData: FormData) {
  const period = String(formData.get('academicPeriodId') ?? '');
  const allocationTrainer = String(formData.get('allocationTrainer') ?? '');
  const allocationQuery = String(formData.get('allocationQuery') ?? '').trim();
  const query = new URLSearchParams();
  if (period) query.set('period', period);
  if (allocationTrainer) query.set('allocationTrainer', allocationTrainer);
  if (allocationQuery) query.set('allocationQ', allocationQuery);
  const result = await performUnassignTeachingAllocation(formData);
  if (result.status === 'error') {
    query.set('unassignError', result.message ?? 'The trainer was not unassigned.');
    redirect(`${path}?${query.toString()}`);
  }
  query.set('unassigned', '1');
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
  const db=await createClient();

  // Synchronize duration and fixed schedule configuration across candidates before merging
  const { data: memberOfferings } = await db
    .from('unit_offerings')
    .select(
      'id, session_duration_minutes, is_full_day_session, fixed_schedule_required, fixed_working_day_id, fixed_time_slot_id, full_day_end_time_slot_id, weekly_sessions',
    )
    .in('id', offeringIds);

  if (memberOfferings && memberOfferings.length > 0) {
    const templateWithFixed = memberOfferings.find(
      (m) => m.fixed_schedule_required && m.fixed_working_day_id,
    );

    if (templateWithFixed) {
      await db
        .from('unit_offerings')
        .update({
          fixed_schedule_required: true,
          fixed_working_day_id: templateWithFixed.fixed_working_day_id,
          fixed_time_slot_id: templateWithFixed.fixed_time_slot_id,
          is_full_day_session: templateWithFixed.is_full_day_session ?? false,
          full_day_end_time_slot_id: templateWithFixed.full_day_end_time_slot_id ?? null,
          session_duration_minutes: templateWithFixed.session_duration_minutes ?? 120,
          weekly_sessions: templateWithFixed.weekly_sessions ?? 1,
        })
        .in('id', offeringIds);

      const { data: templateSlots } = await db
        .from('unit_offering_fixed_slots')
        .select('working_day_id, time_slot_id, sequence_number')
        .eq('unit_offering_id', templateWithFixed.id)
        .order('sequence_number', { ascending: true });

      if (templateSlots && templateSlots.length > 0) {
        await db
          .from('unit_offering_fixed_slots')
          .delete()
          .in('unit_offering_id', offeringIds);

        const newSlotsToInsert = offeringIds.flatMap((targetId) =>
          templateSlots.map((slot) => ({
            unit_offering_id: targetId,
            working_day_id: slot.working_day_id,
            time_slot_id: slot.time_slot_id,
            sequence_number: slot.sequence_number,
          })),
        );
        await db.from('unit_offering_fixed_slots').insert(newSlotsToInsert);
      }
    } else {
      const durations = new Set(memberOfferings.map((m) => m.session_duration_minutes ?? 120));
      const hasFullDay = memberOfferings.some((m) => m.is_full_day_session);
      if (durations.size > 1 || hasFullDay) {
        await db
          .from('unit_offerings')
          .update({ session_duration_minutes: 120, is_full_day_session: false })
          .in('id', offeringIds);
      }
    }
  }

  const {error}=await db.rpc('confirm_shared_unit_offerings',{p_offering_ids:offeringIds});
  if(error) {
    query.set('allocationError',error.message);
    redirect(`${path}?${query.toString()}`);
  }
  revalidatePath(path); revalidatePath('/timetable/unit-offerings'); revalidatePath('/timetable/readiness'); revalidatePath('/timetable/generator');
  redirect(query.size>0?`${path}?${query.toString()}`:path);
}

async function performSetFixedSchedule(
  formData: FormData,
): Promise<Omit<InlineAllocationMutationState, 'sequence'>> {
  await requireHodAccess();
  const id = String(formData.get('offeringId') ?? '');
  const period = String(formData.get('academicPeriodId') ?? '');
  const scheduleMode = String(formData.get('scheduleMode') ?? 'standard');
  const fullDay = String(formData.get('workingDayId') ?? '');
  const firstDay = String(formData.get('firstWorkingDayId') ?? '');
  const secondDay = String(formData.get('secondWorkingDayId') ?? '');
  const thirdDay = String(formData.get('thirdWorkingDayId') ?? '');
  const firstSlot = String(formData.get('firstTimeSlotId') ?? '');
  const secondSlot = String(formData.get('secondTimeSlotId') ?? '');
  const thirdSlot = String(formData.get('thirdTimeSlotId') ?? '');
  if (!id) {
    return { status: 'error', message: 'The unit offering was not found.' };
  }
  const db = await createClient();

  // Load target offering details
  const { data: offering } = await db
    .from('unit_offerings')
    .select('id, cohort_id, unit_id, confirmed_shared_offering_id, academic_period_id')
    .eq('id', id)
    .maybeSingle();

  let targetOfferingIds = [id];
  if (offering?.confirmed_shared_offering_id) {
    const { data: members } = await db
      .from('unit_offerings')
      .select('id, unit_id')
      .eq('confirmed_shared_offering_id', offering.confirmed_shared_offering_id);
    if (members && members.length > 0) {
      targetOfferingIds = members.map((m) => m.id);
      const unitIds = members.map((m) => m.unit_id).filter(Boolean);
      await db
        .from('units')
        .update({ is_active: true, is_timetable_available: true })
        .in('id', unitIds);
    }
  } else if (offering?.unit_id) {
    await db
      .from('units')
      .update({ is_active: true, is_timetable_available: true })
      .eq('id', offering.unit_id);
  }

  if (scheduleMode === 'full_day') {
    if (!fullDay) {
      return { status: 'error', message: 'Select the full-day rotation day.' };
    }

    // 1. Fetch first and last teaching slots
    const { data: allSlots } = await db
      .from('time_slots')
      .select('id, sequence_number')
      .eq('academic_period_id', period)
      .eq('is_enabled', true)
      .eq('slot_type', 'teaching')
      .order('sequence_number', { ascending: true });

    const firstSlotId = allSlots?.[0]?.id;
    const lastSlotId = allSlots?.at(-1)?.id;

    // 2. Direct table update
    await db
      .from('unit_offering_fixed_slots')
      .delete()
      .in('unit_offering_id', targetOfferingIds);

    if (allSlots && allSlots.length > 0) {
      const fixedSlotsToInsert = targetOfferingIds.flatMap((targetId) =>
        allSlots.map((slot, idx) => ({
          unit_offering_id: targetId,
          working_day_id: fullDay,
          time_slot_id: slot.id,
          sequence_number: idx + 1,
        })),
      );
      await db.from('unit_offering_fixed_slots').insert(fixedSlotsToInsert);
    }

    await db
      .from('unit_offerings')
      .update({
        fixed_schedule_required: true,
        fixed_working_day_id: fullDay,
        fixed_time_slot_id: firstSlotId,
        is_full_day_session: true,
        full_day_end_time_slot_id: lastSlotId,
        session_duration_minutes: 480,
        weekly_sessions: 1,
        updated_at: new Date().toISOString(),
      })
      .in('id', targetOfferingIds);

    if (offering?.confirmed_shared_offering_id) {
      await db
        .from('teaching_offerings')
        .update({
          weekly_sessions: 1,
          session_duration_minutes: 480,
          updated_at: new Date().toISOString(),
        })
        .eq('id', offering.confirmed_shared_offering_id);
    }

    // Synchronize allocations
    if (offering) {
      const allocUpdate = {
        fixed_working_day_id: fullDay,
        fixed_working_day_ids: [fullDay],
        fixed_time_slot_ids: [firstSlotId],
        is_full_day_session: true,
        fixed_end_time_slot_id: lastSlotId,
        weekly_sessions: 1,
        session_duration_minutes: 480,
        delivery_mode: 'clinical',
        updated_at: new Date().toISOString(),
      };
      if (offering.confirmed_shared_offering_id) {
        await db
          .from('teaching_allocations')
          .update(allocUpdate)
          .eq('academic_period_id', offering.academic_period_id)
          .eq('teaching_offering_id', offering.confirmed_shared_offering_id);
      } else {
        await db
          .from('teaching_allocations')
          .update(allocUpdate)
          .eq('academic_period_id', offering.academic_period_id)
          .eq('cohort_id', offering.cohort_id)
          .eq('unit_id', offering.unit_id);
      }
    }

    // Also attempt RPC
    await db.rpc('set_unit_offering_full_day_schedule', {
      p_offering_id: id,
      p_working_day_id: fullDay,
    });
  } else {
    if (!firstDay || !firstSlot) {
      return { status: 'error', message: 'Select the first day and teaching session.' };
    }
    if (Boolean(secondDay) !== Boolean(secondSlot)) {
      return { status: 'error', message: 'Select both the second day and second teaching session.' };
    }
    if (Boolean(thirdDay) !== Boolean(thirdSlot)) {
      return { status: 'error', message: 'Select both the third day and third teaching session.' };
    }
    if ((thirdDay || thirdSlot) && !(secondDay && secondSlot)) {
      return { status: 'error', message: 'Set the second session before adding a third.' };
    }
    const workingDayIds = [firstDay, secondDay, thirdDay].filter(Boolean);
    const timeSlotIds = [firstSlot, secondSlot, thirdSlot].filter(Boolean);
    const pairs = workingDayIds.map((day, index) => `${day}:${timeSlotIds[index]}`);
    if (new Set(pairs).size !== pairs.length) {
      return { status: 'error', message: 'Choose a different day or session for the second period.' };
    }

    // 1. Clear old fixed slots & insert new standard session slots
    await db
      .from('unit_offering_fixed_slots')
      .delete()
      .in('unit_offering_id', targetOfferingIds);

    const fixedSlotsToInsert = targetOfferingIds.flatMap((targetId) =>
      workingDayIds.map((wDayId, idx) => ({
        unit_offering_id: targetId,
        working_day_id: wDayId,
        time_slot_id: timeSlotIds[idx],
        sequence_number: idx + 1,
      })),
    );
    await db.from('unit_offering_fixed_slots').insert(fixedSlotsToInsert);

    // 2. Direct update on unit_offerings (sets is_full_day_session = false, session_duration = 120)
    await db
      .from('unit_offerings')
      .update({
        fixed_schedule_required: true,
        fixed_working_day_id: workingDayIds[0],
        fixed_time_slot_id: timeSlotIds[0],
        is_full_day_session: false,
        full_day_end_time_slot_id: null,
        session_duration_minutes: 120,
        weekly_sessions: workingDayIds.length,
        updated_at: new Date().toISOString(),
      })
      .in('id', targetOfferingIds);

    // 3. Update shared teaching_offerings if applicable
    if (offering?.confirmed_shared_offering_id) {
      await db
        .from('teaching_offerings')
        .update({
          weekly_sessions: workingDayIds.length,
          session_duration_minutes: 120,
          updated_at: new Date().toISOString(),
        })
        .eq('id', offering.confirmed_shared_offering_id);
    }

    // 4. Update any existing teaching_allocations directly
    if (offering) {
      const allocUpdate = {
        fixed_working_day_id: workingDayIds[0],
        fixed_working_day_ids: workingDayIds,
        fixed_time_slot_ids: timeSlotIds,
        is_full_day_session: false,
        fixed_end_time_slot_id: null,
        weekly_sessions: workingDayIds.length,
        session_duration_minutes: 120,
        delivery_mode: 'theory',
        updated_at: new Date().toISOString(),
      };
      if (offering.confirmed_shared_offering_id) {
        await db
          .from('teaching_allocations')
          .update(allocUpdate)
          .eq('academic_period_id', offering.academic_period_id)
          .eq('teaching_offering_id', offering.confirmed_shared_offering_id);
      } else {
        await db
          .from('teaching_allocations')
          .update(allocUpdate)
          .eq('academic_period_id', offering.academic_period_id)
          .eq('cohort_id', offering.cohort_id)
          .eq('unit_id', offering.unit_id);
      }
    }

    // 5. Also attempt RPC if updated
    await db.rpc('set_unit_offering_fixed_session_pattern', {
      p_offering_id: id,
      p_working_day_ids: workingDayIds,
      p_time_slot_ids: timeSlotIds,
    });

    // 6. Keep selected_slots_only trainer availability aligned with agreed fixed slots
    if (offering) {
      const { data: allocatedRow } = await db
        .from('teaching_allocations')
        .select('trainer_id, trainers(availability_mode)')
        .eq('academic_period_id', offering.academic_period_id)
        .eq('cohort_id', offering.cohort_id)
        .eq('unit_id', offering.unit_id)
        .in('status', ['draft', 'active'])
        .maybeSingle();

      const trainerRelation = Array.isArray(allocatedRow?.trainers)
        ? allocatedRow?.trainers[0]
        : allocatedRow?.trainers;

      if (allocatedRow?.trainer_id && trainerRelation?.availability_mode === 'selected_slots_only') {
        await db.from('trainer_availability').upsert(
          workingDayIds.map((wDayId, idx) => ({
            trainer_id: allocatedRow.trainer_id,
            academic_period_id: offering.academic_period_id,
            working_day_id: wDayId,
            time_slot_id: timeSlotIds[idx],
          })),
          {
            onConflict: 'trainer_id,academic_period_id,working_day_id,time_slot_id',
            ignoreDuplicates: true,
          },
        );
      }
    }
  }

  revalidatePath(path);
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/generator');
  return { status: 'success' };
}

export async function setFixedScheduleInlineAction(
  prevState: InlineAllocationMutationState,
  formData: FormData,
): Promise<InlineAllocationMutationState> {
  const result = await performSetFixedSchedule(formData);
  return { ...result, sequence: prevState.sequence + 1 };
}

export async function setFixedScheduleAction(formData: FormData) {
  const period = String(formData.get('academicPeriodId') ?? '');
  const searchQuery = String(formData.get('searchQuery') ?? '').trim();
  const query = new URLSearchParams();
  if (period) query.set('period', period);
  if (searchQuery) query.set('q', searchQuery);
  const result = await performSetFixedSchedule(formData);
  if (result.status === 'error') {
    query.set('allocationError', result.message ?? 'Unable to save fixed schedule.');
    redirect(`${path}?${query.toString()}`);
  }
  redirect(query.size > 0 ? `${path}?${query.toString()}` : path);
}

async function performClearFixedSchedule(
  formData: FormData,
): Promise<Omit<InlineAllocationMutationState, 'sequence'>> {
  await requireHodAccess();
  const id = String(formData.get('offeringId') ?? '');
  if (!id) {
    return { status: 'error', message: 'The unit offering was not found.' };
  }
  const db = await createClient();

  const { data: offering } = await db
    .from('unit_offerings')
    .select('id, confirmed_shared_offering_id')
    .eq('id', id)
    .maybeSingle();

  let targetOfferingIds = [id];
  if (offering?.confirmed_shared_offering_id) {
    const { data: members } = await db
      .from('unit_offerings')
      .select('id')
      .eq('confirmed_shared_offering_id', offering.confirmed_shared_offering_id);
    if (members && members.length > 0) {
      targetOfferingIds = members.map((m) => m.id);
    }
  }

  // Direct cleanup
  await db
    .from('unit_offering_fixed_slots')
    .delete()
    .in('unit_offering_id', targetOfferingIds);

  await db
    .from('unit_offerings')
    .update({
      fixed_schedule_required: false,
      fixed_working_day_id: null,
      fixed_time_slot_id: null,
      is_full_day_session: false,
      full_day_end_time_slot_id: null,
      session_duration_minutes: 120,
      updated_at: new Date().toISOString(),
    })
    .in('id', targetOfferingIds);

  // Attempt RPC
  await db.rpc('clear_unit_offering_fixed_schedule', {
    p_offering_id: id,
  });

  revalidatePath(path);
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/generator');
  return { status: 'success' };
}

export async function clearFixedScheduleInlineAction(
  prevState: InlineAllocationMutationState,
  formData: FormData,
): Promise<InlineAllocationMutationState> {
  const result = await performClearFixedSchedule(formData);
  return { ...result, sequence: prevState.sequence + 1 };
}

export async function clearFixedScheduleAction(formData: FormData) {
  const period = String(formData.get('academicPeriodId') ?? '');
  const searchQuery = String(formData.get('searchQuery') ?? '').trim();
  const query = new URLSearchParams();
  if (period) query.set('period', period);
  if (searchQuery) query.set('q', searchQuery);
  const result = await performClearFixedSchedule(formData);
  if (result.status === 'error') {
    query.set('allocationError', result.message ?? 'Unable to clear fixed schedule.');
    redirect(`${path}?${query.toString()}`);
  }
  redirect(query.size > 0 ? `${path}?${query.toString()}` : path);
}