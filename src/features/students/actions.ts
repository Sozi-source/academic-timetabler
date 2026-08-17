'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type { StudentProgressionActionState } from './types';
import { studentProgressionSchema } from './validation';

function optionalText(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function progressionError(message?: string) {
  if (message?.includes('Only active or admitted students can defer')) return 'This student cannot defer from the current status.';
  if (message?.includes('Only deferred or leave students can resume')) return 'Only deferred or leave students can resume.';
  if (message?.includes('Resumption cohort must belong')) return 'Select a cohort from the student programme.';
  if (message?.includes('planned or active')) return 'Select a planned or active cohort.';
  if (message?.includes('Reason is required')) return 'A reason is required.';
  if (message?.includes('future expected')) return 'Expected return must be after the effective date.';
  if (message?.includes('Only completed students')) return 'Only completed students can be marked graduated.';
  return 'The progression change could not be saved.';
}

export async function recordStudentProgressionAction(
  _previousState: StudentProgressionActionState,
  formData: FormData,
): Promise<StudentProgressionActionState> {
  await requireHodAccess();

  const parsed = studentProgressionSchema.safeParse({
    studentId: formData.get('studentId'),
    eventType: formData.get('eventType'),
    effectiveDate: formData.get('effectiveDate'),
    targetCohortId: optionalText(formData, 'targetCohortId'),
    expectedResumeDate: optionalText(formData, 'expectedResumeDate'),
    reason: optionalText(formData, 'reason'),
    notes: optionalText(formData, 'notes'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Review the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_student_lifecycle_transition', {
    target_student_id: parsed.data.studentId,
    transition_event: parsed.data.eventType,
    transition_date: parsed.data.effectiveDate,
    target_cohort_id: parsed.data.targetCohortId ?? null,
    expected_resume_on: parsed.data.expectedResumeDate ?? null,
    transition_reason: parsed.data.reason ?? null,
    transition_notes: parsed.data.notes ?? null,
  });

  if (error) {
    return { status: 'error', message: progressionError(error.message) };
  }

  revalidatePath('/students');
  revalidatePath('/students/registry');
  revalidatePath('/students/progression');
  revalidatePath(`/students/registry/${parsed.data.studentId}`);

  return { status: 'success', message: 'Progression updated.' };
}
