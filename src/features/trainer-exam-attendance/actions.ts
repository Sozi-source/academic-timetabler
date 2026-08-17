'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireTrainerAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

export async function saveTrainerExamAbsentees(formData: FormData) {
  await requireTrainerAccess();

  const assessmentId = formData.get('assessmentId');
  const absentStudentIds = formData
    .getAll('absentStudentIds')
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  if (typeof assessmentId !== 'string' || !assessmentId) {
    redirect('/trainer/exam-attendance?error=invalid');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('trainer_record_exam_absentees', {
    target_assessment_event_id: assessmentId,
    absent_student_ids: absentStudentIds,
  });

  if (error) {
    redirect(
      `/trainer/exam-attendance/${assessmentId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/trainer/exam-attendance');
  revalidatePath(`/trainer/exam-attendance/${assessmentId}`);
  redirect(`/trainer/exam-attendance/${assessmentId}?saved=1`);
}
