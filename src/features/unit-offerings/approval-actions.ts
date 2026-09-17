'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

const path = '/timetable/unit-offerings';

/** Shape returned by the set_unit_offering_approval RPC (returns jsonb). */
interface OfferingApprovalResult {
  changed: number;
  blocked: number;
  blocked_ids: string[];
  /** Non-null only when one or more offerings were skipped. */
  message: string | null;
}

export async function approveUnitOfferingsAction(formData: FormData) {
  await requireHodAccess();
  const offeringIds = formData.getAll('offeringId').map(String).filter(Boolean);
  if (offeringIds.length === 0) redirect(`${path}?approvalError=Select+at+least+one+offering`);
  const db = await createClient();
  const { data, error } = await db.rpc('set_unit_offering_approval', {
    p_offering_ids: offeringIds,
    p_approve: true,
    p_reason: null,
  });
  if (error) redirect(`${path}?approvalError=${encodeURIComponent(error.message)}`);

  const result = data as OfferingApprovalResult;

  // Nothing was approved — surface the reason
  if (result.changed === 0) {
    const msg = result.message ?? 'No offerings could be included — they may belong to another department or have locked sessions.';
    redirect(`${path}?approvalError=${encodeURIComponent(msg)}`);
  }

  revalidatePath(path);
  revalidatePath('/timetable/teaching-allocations');
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/generator');

  // Partial success: some were blocked but some succeeded
  if (result.blocked > 0 && result.message) {
    redirect(`${path}?approved=${result.changed}&approvalWarning=${encodeURIComponent(result.message)}`);
  }

  redirect(`${path}?approved=${result.changed}`);
}

export async function withdrawUnitOfferingAction(formData: FormData) {
  await requireHodAccess();
  const rawOfferingIds = formData.getAll('offeringId').map(String).filter(Boolean);
  const singleOfferingId = String(formData.get('offeringId') ?? '');
  const offeringIds =
    rawOfferingIds.length > 0 ? rawOfferingIds : singleOfferingId ? [singleOfferingId] : [];
  const reason =
    String(formData.get('reason') ?? 'Excluded from active cohort teaching plan').trim() ||
    'Excluded from active cohort teaching plan';

  if (offeringIds.length === 0)
    redirect(`${path}?approvalError=${encodeURIComponent('Select at least one offering to withdraw')}`);

  const db = await createClient();
  const { data, error } = await db.rpc('set_unit_offering_approval', {
    p_offering_ids: offeringIds,
    p_approve: false,
    p_reason: reason,
  });
  if (error) redirect(`${path}?approvalError=${encodeURIComponent(error.message)}`);

  const result = data as OfferingApprovalResult;

  // Nothing was withdrawn — surface the precise reason (e.g. locked sessions)
  if (result.changed === 0) {
    const msg =
      result.message ??
      'This offering could not be dropped — it has locked timetable sessions. Unlock all sessions for this unit before dropping it.';
    redirect(`${path}?approvalError=${encodeURIComponent(msg)}`);
  }

  revalidatePath(path);
  revalidatePath('/timetable/teaching-allocations');
  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/generator');

  // Partial success: some blocked, some dropped
  if (result.blocked > 0 && result.message) {
    redirect(`${path}?withdrawn=${result.changed}&approvalWarning=${encodeURIComponent(result.message)}`);
  }

  redirect(`${path}?withdrawn=${result.changed}`);
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
