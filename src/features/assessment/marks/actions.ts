'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getAssessmentById, getAssessmentPopulation } from '@/features/assessment/queries';
import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export async function saveAssessmentAttendanceAction(formData: FormData) {
  await requireHodAccess();
  const assessmentId = text(formData, 'assessmentId');
  const absentStudentIds = formData.getAll('absentStudentId').filter((value): value is string => typeof value === 'string');
  if (!assessmentId) return;
  const assessment = await getAssessmentById(assessmentId);
  if (!assessment) redirect('/assessment/marks?error=not-found');
  if (assessment.exam_marks_finalized_at) redirect(`/assessment/marks/${assessmentId}?error=locked`);
  if (!assessment.cat_marks_finalized_at) redirect(`/assessment/marks/${assessmentId}?error=cat-required`);

  const population = await getAssessmentPopulation(assessmentId);
  if (population.length === 0) redirect(`/assessment/marks/${assessmentId}?error=population`);

  const allowedStudentIds = new Set(
    population.map((row) => row.student?.id).filter((value): value is string => Boolean(value)),
  );
  if (absentStudentIds.some((studentId) => !allowedStudentIds.has(studentId))) {
    redirect(`/assessment/marks/${assessmentId}?error=attendance`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_assessment_attendance', {
    target_assessment_event_id: assessmentId,
    absent_student_ids: absentStudentIds,
  });
  revalidatePath('/assessment');
  revalidatePath('/assessment/marks');
  revalidatePath(`/assessment/marks/${assessmentId}`);
  revalidatePath(`/assessment/population/${assessmentId}`);
  if (error) redirect(`/assessment/marks/${assessmentId}?error=attendance`);
  redirect(`/assessment/marks/${assessmentId}?attendance=saved`);
}

export async function unlockAssessmentMarkComponentAction(formData: FormData) {
  await requireHodAccess();
  const parsed = z.object({
    assessmentId: z.uuid(),
    cohortId: z.union([z.uuid(), z.literal('all')]),
    component: z.enum(['assignment', 'presentation', 'rat', 'cat', 'exam']),
  }).safeParse({
    assessmentId: formData.get('assessmentId'),
    cohortId: formData.get('cohortId'),
    component: formData.get('component'),
  });

  if (!parsed.success) return;
  const { assessmentId, cohortId, component } = parsed.data;
  const assessment = await getAssessmentById(assessmentId);
  if (!assessment) redirect('/assessment/marks?error=not-found');

  const supabase = await createClient();
  const { error } = await supabase.rpc('unlock_assessment_mark_component_submission', {
    target_assessment_id: assessmentId,
    target_cohort_id: cohortId === 'all' ? null : cohortId,
    target_component_key: component,
  });

  if (error) redirect(`/assessment/marks/${assessmentId}?error=component-unlock`);
  revalidatePath(`/assessment/marks/${assessmentId}`);
  redirect(`/assessment/marks/${assessmentId}?component_unlocked=${component}`);
}

/**
 * HOD "submit on behalf": submits a trainer's saved CAT drafts when the trainer
 * forgot to press Submit. Mirrors the trainer submit route exactly — unentered
 * CAT marks are recorded as AB — and runs through the same RLS-guarded RPC, so
 * `submitted_by` records the HOD who performed the submission.
 */
export async function submitCatOnBehalfAction(formData: FormData) {
  const profile = await requireHodAccess();
  const parsed = z.object({ assessmentId: z.uuid() }).safeParse({ assessmentId: formData.get('assessmentId') });
  if (!parsed.success) return;
  const { assessmentId } = parsed.data;

  const assessment = await getAssessmentById(assessmentId);
  if (!assessment) redirect('/assessment/marks?error=not-found');
  if (assessment.exam_marks_finalized_at || assessment.status === 'closed') {
    redirect(`/assessment/marks/${assessmentId}?error=locked`);
  }

  const supabase = await createClient();
  const [eventRes, rosterRes, draftRes, subRes] = await Promise.all([
    supabase.from('assessment_events').select('department_id').eq('id', assessmentId).maybeSingle(),
    supabase.from('assessment_roster').select('student_id').eq('assessment_id', assessmentId),
    supabase.from('assessment_online_mark_drafts').select('student_id, cat_mark').eq('assessment_id', assessmentId),
    supabase.from('assessment_mark_component_submissions').select('id').eq('assessment_id', assessmentId).eq('component_key', 'cat').limit(1),
  ]);

  // Tenant isolation: only markbooks in the HOD's active department.
  if (!eventRes.data || (profile.activeDepartmentId && eventRes.data.department_id !== profile.activeDepartmentId)) {
    redirect(`/assessment/marks/${assessmentId}?error=not-found`);
  }
  if ((subRes.data ?? []).length > 0) redirect(`/assessment/marks/${assessmentId}?error=cat-already-submitted`);

  const roster = rosterRes.data ?? [];
  const catByStudent = new Map<string, number | null>();
  for (const d of draftRes.data ?? []) {
    if (d.student_id && d.cat_mark !== null) catByStudent.set(d.student_id, d.cat_mark);
  }
  if (roster.length === 0 || catByStudent.size === 0) redirect(`/assessment/marks/${assessmentId}?error=no-saved-cat`);

  const entries = roster.map((r) => {
    const cat = catByStudent.get(r.student_id) ?? null;
    return { student_id: r.student_id, cat, cat_absent: cat === null };
  });

  const { error } = await supabase.rpc('save_assessment_online_component_marks', {
    target_assessment_id: assessmentId,
    target_component: 'cat',
    target_entries: entries,
    submit_component: true,
  });

  revalidatePath('/assessment');
  revalidatePath(`/assessment/marks/${assessmentId}`);
  if (error) redirect(`/assessment/marks/${assessmentId}?error=cat-submit-on-behalf`);
  redirect(`/assessment/marks/${assessmentId}?cat_submitted_on_behalf=1`);
}
