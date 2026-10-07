'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getAssessmentById, getAssessmentPopulation } from '@/features/assessment/queries';
import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

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
