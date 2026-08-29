'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

function requiredText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(formData: FormData, name: string) {
  const value = requiredText(formData, name);
  return value || null;
}

export async function createAssessmentAction(formData: FormData) {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) throw new Error('Select a department before creating a unit markbook.');

  const academicPeriodId = requiredText(formData, 'academicPeriodId');
  const unitId = requiredText(formData, 'unitId');
  const assessmentDate = optionalText(formData, 'assessmentDate');

  if (!academicPeriodId || !unitId) {
    redirect('/assessment/assessments?error=required');
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('assessment_events')
    .select('id')
    .eq('department_id', profile.activeDepartmentId)
    .eq('academic_period_id', academicPeriodId)
    .eq('unit_id', unitId)
    .eq('title', 'Unit Markbook')
    .maybeSingle();

  if (existing?.id) redirect(`/assessment/marks/${existing.id}`);

  const { data, error } = await supabase
    .from('assessment_events')
    .insert({
      department_id: profile.activeDepartmentId,
      academic_period_id: academicPeriodId,
      unit_id: unitId,
      cohort_id: null,
      assessment_type: 'exam',
      title: 'Unit Markbook',
      assessment_date: assessmentDate,
      max_mark: 100,
      pass_mark: 40,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error || !data) {
    redirect(`/assessment/assessments?error=${error?.code === '23505' ? 'duplicate' : 'save'}`);
  }

  const { error: populationError } = await supabase.rpc('refresh_assessment_population', {
    target_assessment_event_id: data.id,
  });

  revalidatePath('/assessment');
  revalidatePath('/assessment/assessments');
  revalidatePath('/assessment/population');
  revalidatePath('/assessment/marks');

  if (populationError) redirect('/assessment/assessments?created=1&population=failed');
  redirect(`/assessment/marks/${data.id}?created=1`);
}

export async function refreshAssessmentPopulationAction(formData: FormData) {
  await requireHodAccess();
  const assessmentId = requiredText(formData, 'assessmentId');
  if (!assessmentId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc('refresh_assessment_population', {
    target_assessment_event_id: assessmentId,
  });

  revalidatePath('/assessment');
  revalidatePath('/assessment/population');
  revalidatePath('/assessment/marks');
  revalidatePath(`/assessment/population/${assessmentId}`);

  if (error) redirect(`/assessment/population/${assessmentId}?error=refresh`);
  redirect(`/assessment/population/${assessmentId}?refreshed=1`);
}

export async function createAllAllocatedMarkbooksAction(formData: FormData) {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) throw new Error('Select a department before generating markbooks.');

  const academicPeriodId = requiredText(formData, 'academicPeriodId');
  if (!academicPeriodId) {
    redirect('/assessment/assessments?error=required');
  }

  const supabase = await createClient();

  // 1. Get all units with active teaching allocations in this academic period
  const { data: allocations, error: allocError } = await supabase
    .from('teaching_allocations')
    .select('unit_id')
    .eq('academic_period_id', academicPeriodId)
    .in('status', ['draft', 'active']);

  if (allocError || !allocations) {
    redirect('/assessment/assessments?error=fetch_allocations');
  }

  const unitIds = [...new Set(allocations.map((a) => a.unit_id).filter(Boolean))];
  if (unitIds.length === 0) {
    redirect('/assessment/assessments?bulk_created=0');
  }

  // 2. Find existing assessment events for these units
  const { data: existingEvents } = await supabase
    .from('assessment_events')
    .select('unit_id')
    .eq('department_id', profile.activeDepartmentId)
    .eq('academic_period_id', academicPeriodId)
    .in('unit_id', unitIds);

  const existingUnitSet = new Set((existingEvents ?? []).map((e) => e.unit_id));
  const missingUnitIds = unitIds.filter((id) => !existingUnitSet.has(id));

  let createdCount = 0;

  for (const unitId of missingUnitIds) {
    const { data: newEvent, error: insertError } = await supabase
      .from('assessment_events')
      .insert({
        department_id: profile.activeDepartmentId,
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

    if (!insertError && newEvent?.id) {
      createdCount++;
      await supabase.rpc('refresh_assessment_population', {
        target_assessment_event_id: newEvent.id,
      });
    }
  }

  revalidatePath('/assessment');
  revalidatePath('/assessment/assessments');
  revalidatePath('/assessment/population');
  revalidatePath('/assessment/marks');
  revalidatePath('/staff');
  revalidatePath('/staff/units');

  redirect(`/assessment/assessments?bulk_created=${createdCount}`);
}

