'use server';

import { revalidatePath } from 'next/cache';

import { requireTrainerAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';

export async function initializeUnitAssessmentAction(formData: FormData) {
  await requireTrainerAccess();

  const allocationId = formData.get('allocationId') as string;
  const unitId = formData.get('unitId') as string;
  const academicPeriodId = formData.get('academicPeriodId') as string;

  if (!allocationId || !unitId || !academicPeriodId) {
    throw new Error('Missing allocation information');
  }

  const admin = createAdminClient();

  // Find department from unit or allocation
  const { data: unit } = await admin
    .from('units')
    .select('department_id')
    .eq('id', unitId)
    .maybeSingle();

  let departmentId = unit?.department_id;

  if (!departmentId) {
    const { data: alloc } = await admin
      .from('teaching_allocations')
      .select('department_id, cohort:cohorts(department_id)')
      .eq('id', allocationId)
      .maybeSingle();

    const cohort = Array.isArray(alloc?.cohort) ? alloc.cohort[0] : alloc?.cohort;
    departmentId = alloc?.department_id ?? cohort?.department_id;
  }

  if (!departmentId) {
    const { data: dept } = await admin
      .from('departments')
      .select('id')
      .limit(1)
      .single();
    departmentId = dept?.id;
  }

  if (!departmentId) {
    throw new Error('No department could be associated with this unit.');
  }

  // 1. Check if assessment event already exists
  const { data: existingEvent } = await admin
    .from('assessment_events')
    .select('id')
    .eq('academic_period_id', academicPeriodId)
    .eq('unit_id', unitId)
    .in('assessment_type', ['exam', 'unit_markbook'])
    .maybeSingle();

  let assessmentId = existingEvent?.id;

  if (!assessmentId) {
    const { data: newEvent, error: insertError } = await admin
      .from('assessment_events')
      .insert({
        department_id: departmentId,
        academic_period_id: academicPeriodId,
        unit_id: unitId,
        cohort_id: null,
        assessment_type: 'exam',
        title: 'Unit Markbook',
        max_mark: 100,
        pass_mark: 40,
        status: 'draft',
      })
      .select('id')
      .single();

    if (insertError || !newEvent) {
      throw new Error(`Failed to create assessment: ${insertError?.message}`);
    }
    assessmentId = newEvent.id;
  }

  // 2. Ensure assessment_rule exists
  const { data: existingRule } = await admin
    .from('assessment_rules')
    .select('id')
    .eq('academic_period_id', academicPeriodId)
    .eq('unit_id', unitId)
    .eq('assessment_type', 'exam')
    .maybeSingle();

  if (!existingRule) {
    await admin.from('assessment_rules').insert({
      department_id: departmentId,
      academic_period_id: academicPeriodId,
      unit_id: unitId,
      assessment_type: 'exam',
      maximum_mark: 100,
      pass_mark: 40,
    });
  }

  // 3. Populate student roster
  await admin.rpc('refresh_assessment_population', {
    target_assessment_event_id: assessmentId,
  });

  revalidatePath('/staff');
  revalidatePath(`/staff/units/${allocationId}`);
  revalidatePath('/staff/units');
}

