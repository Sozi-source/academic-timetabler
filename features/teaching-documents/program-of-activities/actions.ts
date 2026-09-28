'use server';

import { revalidatePath } from 'next/cache';
import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SemesterProgramActivity } from './types';

export async function saveSemesterProgramActivitiesAction(
  activities: SemesterProgramActivity[],
  academicPeriodId?: string | null
): Promise<{ ok: boolean; count: number; error?: string }> {
  await requireHodAccess();

  if (!activities || activities.length === 0) {
    return { ok: false, count: 0, error: 'At least one activity is required.' };
  }

  const admin = createAdminClient();

  try {
    // Delete existing rows for this target period (or institutional default)
    if (academicPeriodId) {
      await admin
        .from('semester_program_activities')
        .delete()
        .eq('academic_period_id', academicPeriodId);
    } else {
      await admin
        .from('semester_program_activities')
        .delete()
        .is('academic_period_id', null);
    }

    // Insert updated rows
    const rowsToInsert = activities.map((act) => ({
      academic_period_id: academicPeriodId ?? null,
      week_number: act.weekNumber,
      activity_type: act.activityType,
      title: act.title.trim(),
      description: act.description?.trim() || null,
      is_teaching_week: Boolean(act.isTeachingWeek),
      learning_outcomes: act.learningOutcomes?.trim() || null,
      learning_activities: act.learningActivities?.trim() || null,
      assessment_remarks: act.assessmentRemarks?.trim() || null,
      updated_at: new Date().toISOString(),
    }));

    const { error: insertError } = await admin
      .from('semester_program_activities')
      .insert(rowsToInsert);

    if (insertError) {
      throw new Error(`Database error saving program of activities: ${insertError.message}`);
    }

    // Revalidate paths that consume teaching documents and curriculum
    revalidatePath('/teaching-documents');
    revalidatePath('/teaching-documents/curriculum');
    revalidatePath('/staff/documents');
    revalidatePath('/staff/units/[allocationId]/documents/course-outline', 'page');
    revalidatePath('/staff/units/[allocationId]/documents/scheme-of-work', 'page');
    revalidatePath('/staff/units/[allocationId]/documents/record-of-work', 'page');

    return { ok: true, count: rowsToInsert.length };
  } catch (err) {
    console.error('Failed to save semester program activities:', err);
    return {
      ok: false,
      count: 0,
      error: err instanceof Error ? err.message : 'Failed to save program of activities',
    };
  }
}
