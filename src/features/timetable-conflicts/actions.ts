'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

function refresh() {
  revalidatePath('/timetable/conflicts');
  revalidatePath('/timetable/editor');
  revalidatePath('/timetable/generator');
}

export async function setConflictReviewAction(formData: FormData): Promise<void> {
  await requireHodAccess();
  const academicPeriodId = String(formData.get('academicPeriodId') ?? '');
  const conflictKey = String(formData.get('conflictKey') ?? '');
  const status = String(formData.get('status') ?? '');
  const note = String(formData.get('resolutionNote') ?? '').trim();
  if (!academicPeriodId || !conflictKey || !['acknowledged', 'resolved', 'reopened'].includes(status)) {
    throw new Error('Invalid conflict review request.');
  }
  if (status === 'resolved' && note.length < 3) {
    throw new Error('Add a brief resolution note before marking the conflict resolved.');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('timetable_conflict_reviews').upsert({
    academic_period_id: academicPeriodId,
    conflict_key: conflictKey,
    status,
    resolution_note: note || null,
  }, { onConflict: 'academic_period_id,conflict_key' });
  if (error) throw new Error(error.message);
  refresh();
}
