'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

export async function progressSelectedStudents(formData: FormData) {
  await requireHodAccess();

  const studentIds = formData
    .getAll('studentIds')
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.length > 0,
    );

  const noteValue = formData.get('note');
  const note =
    typeof noteValue === 'string' ? noteValue.trim() : '';

  if (studentIds.length === 0) {
    redirect('/students/lifecycle-progression?error=students');
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    'progress_students_to_next_stage',
    {
      target_student_ids: studentIds,
      progression_note: note || null,
    },
  );

  if (error) {
    redirect(
      `/students/lifecycle-progression?error=${encodeURIComponent(
        error.message,
      )}`,
    );
  }

  const summary =
    data && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : {};

  const params = new URLSearchParams({
    success: '1',
    requested: String(summary.requested_students ?? 0),
    progressed: String(summary.progressed_students ?? 0),
    skipped: String(summary.skipped_students ?? 0),
  });

  revalidatePath('/students/lifecycle-progression');
  revalidatePath('/students/unit-registration');

  redirect(`/students/lifecycle-progression?${params.toString()}`);
}
