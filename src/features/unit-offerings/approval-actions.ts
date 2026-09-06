'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

const path = '/timetable/unit-offerings';

export async function approveUnitOfferingsAction(formData: FormData) {
  await requireHodAccess();
  const offeringIds = formData.getAll('offeringId').map(String).filter(Boolean);
  if (offeringIds.length === 0) redirect(`${path}?approvalError=Select+at+least+one+offering`);
  const db = await createClient();
  const { error } = await db.rpc('set_unit_offering_approval', {
    p_offering_ids: offeringIds,
    p_approve: true,
    p_reason: null,
  });
  if (error) redirect(`${path}?approvalError=${encodeURIComponent(error.message)}`);
  revalidatePath(path);
  revalidatePath('/timetable/teaching-allocations');
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/generator');
  redirect(`${path}?approved=${offeringIds.length}`);
}

export async function withdrawUnitOfferingAction(formData: FormData) {
  await requireHodAccess();
  const rawOfferingIds = formData.getAll('offeringId').map(String).filter(Boolean);
  const singleOfferingId = String(formData.get('offeringId') ?? '');
  const offeringIds = rawOfferingIds.length > 0 ? rawOfferingIds : (singleOfferingId ? [singleOfferingId] : []);
  const reason = String(formData.get('reason') ?? 'Excluded from active cohort teaching plan').trim() || 'Excluded from active cohort teaching plan';
  if (offeringIds.length === 0) redirect(`${path}?approvalError=${encodeURIComponent('Select at least one offering to withdraw')}`);
  const db = await createClient();
  const { error } = await db.rpc('set_unit_offering_approval', {
    p_offering_ids: offeringIds, p_approve: false, p_reason: reason,
  });
  if (error) redirect(`${path}?approvalError=${encodeURIComponent(error.message)}`);
  revalidatePath(path);
  revalidatePath('/timetable/teaching-allocations');
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/generator');
  redirect(`${path}?withdrawn=${offeringIds.length}`);
}

export async function addCohortUnitOfferingAction(formData: FormData) {
  await requireHodAccess();
  const academicPeriodId = String(formData.get('academicPeriodId') ?? '');
  const cohortId = String(formData.get('cohortId') ?? '');
  const unitId = String(formData.get('unitId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!academicPeriodId || !cohortId || !unitId || reason.length < 3) {
    redirect(`${path}?approvalError=${encodeURIComponent('Select a cohort and unit, and provide a reason')}`);
  }
  const db = await createClient();
  const { error } = await db.rpc('add_special_unit_offering', {
    selected_academic_period_id: academicPeriodId,
    selected_cohort_id: cohortId,
    selected_unit_id: unitId,
    selected_reason: reason,
  });
  if (error) redirect(`${path}?approvalError=${encodeURIComponent(error.message)}`);
  revalidatePath(path);
  redirect(`${path}?added=1`);
}
