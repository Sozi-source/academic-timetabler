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
    redirect('/assessment?error=required');
  }

  const supabase = await createClient();
  const { data: existing, error: lookupError } = await supabase
    .from('assessment_events')
    .select('id')
    .eq('department_id', profile.activeDepartmentId)
    .eq('academic_period_id', academicPeriodId)
    .eq('unit_id', unitId)
    .eq('title', 'Unit Markbook')
    .maybeSingle();

  if (lookupError) {
    console.error('Unable to check for an existing unit markbook.', {
      code: lookupError.code,
      message: lookupError.message,
    });
    redirect('/assessment?error=lookup');
  }

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
    if (error) {
      console.error('Unable to create a unit markbook.', {
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }
    const errorType = error?.code === '23505'
      ? 'duplicate'
      : error?.code === '23503'
        ? 'invalid'
        : error?.code === '42501'
          ? 'access'
          : 'save';
    redirect(`/assessment?error=${errorType}`);
  }

  const { error: populationError } = await supabase.rpc('refresh_assessment_population', {
    target_assessment_event_id: data.id,
  });

  revalidatePath('/assessment');
  revalidatePath('/assessment/population');
  revalidatePath('/assessment/marks');

  if (populationError) redirect('/assessment?created=1&population=failed');
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


