'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

export async function setCohortStageAction(formData: FormData) {
  await requireHodAccess();

  const cohortId = formData.get('cohortId');
  const stageId = formData.get('stageId');
  const applyMissingStudents =
    formData.get('applyMissingStudents') === 'yes';

  if (
    typeof cohortId !== 'string' ||
    !cohortId ||
    typeof stageId !== 'string' ||
    !stageId
  ) {
    redirect('/students/unit-registration/batch?error=stage_selection_required');
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc('set_cohort_programme_stage', {
    target_cohort_id: cohortId,
    target_stage_id: stageId,
    apply_to_students_without_stage: applyMissingStudents,
  });

  if (error) {
    redirect(
      `/students/unit-registration/batch?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/students/unit-registration/batch');
  revalidatePath('/students/unit-registration');
  revalidatePath('/students/lifecycle-progression');

  redirect(`/students/unit-registration/batch?stage_updated=1&cohortId=${cohortId}`);
}
