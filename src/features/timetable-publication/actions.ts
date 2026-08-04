'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type { TimetableVersionStatus } from './types';
import { getAllowedTimetableTransitions } from './workflow';

function refresh() {
  revalidatePath('/timetable/published');
  revalidatePath('/timetable/editor');
  revalidatePath('/timetable/generator');
}

export async function createTimetableVersionAction(formData: FormData): Promise<void> {
  await requireHodAccess();
  const academicPeriodId = String(formData.get('academicPeriodId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const changeSummary = String(formData.get('changeSummary') ?? '').trim();
  if (!academicPeriodId || title.length < 3) {
    throw new Error('Select an Academic Period and provide a clear version title.');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_timetable_version', {
    target_academic_period_id: academicPeriodId,
    version_title: title,
    version_change_summary: changeSummary || null,
  });
  if (error) throw new Error(error.message);
  refresh();
}

export async function transitionTimetableVersionAction(formData: FormData): Promise<void> {
  await requireHodAccess();
  const versionId = String(formData.get('versionId') ?? '');
  const currentStatus = String(formData.get('currentStatus') ?? '') as TimetableVersionStatus;
  const targetStatus = String(formData.get('targetStatus') ?? '') as TimetableVersionStatus;
  const note = String(formData.get('note') ?? '').trim();
  if (!versionId || !getAllowedTimetableTransitions(currentStatus).includes(targetStatus)) {
    throw new Error('Invalid timetable publication transition.');
  }
  if (['approved', 'published', 'archived'].includes(targetStatus) && note.length < 3) {
    throw new Error('Add a brief approval or publication note.');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('transition_timetable_version', {
    target_version_id: versionId,
    target_status: targetStatus,
    transition_note: note || null,
  });
  if (error) throw new Error(error.message);
  refresh();
}
