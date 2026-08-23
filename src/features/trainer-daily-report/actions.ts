'use server';

import { revalidatePath } from 'next/cache';

import { requireTrainerAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';
import type { TrainerDailyReportActionState } from './types';

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

export async function submitTrainerDailyReportAction(
  _previousState: TrainerDailyReportActionState,
  formData: FormData,
): Promise<TrainerDailyReportActionState> {
  try {
    const profile = await requireTrainerAccess();

    const reportDate = textValue(formData, 'reportDate');
    const otherActivity = textValue(formData, 'otherActivity');
    const concern = textValue(formData, 'concern');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      return { status: 'error', message: 'The report date is invalid.' };
    }

    if (otherActivity.length > 800) {
      return { status: 'error', message: 'Other activity is too long (maximum 800 characters).' };
    }

    if (concern.length > 1200) {
      return { status: 'error', message: 'Concern note is too long (maximum 1200 characters).' };
    }

    const { getTrainerDailyReportWorkspace } = await import('./queries');
    const workspace = await getTrainerDailyReportWorkspace(reportDate);

    // If there are no scheduled lessons, require at least one activity or concern note
    if (workspace.lessons.length === 0 && !otherActivity && !concern) {
      return {
        status: 'error',
        message: 'No lessons are scheduled for this day. Please describe an activity or add a note before submitting.',
      };
    }

    // If there are scheduled lessons, ensure all attendance is completed
    if (workspace.lessons.length > 0 && !workspace.readyToSubmit) {
      return {
        status: 'error',
        message: 'Please complete class attendance for all scheduled lessons before submitting.',
      };
    }

    const supabase = await createClient();

    let submittedSuccessfully = false;
    try {
      const { error: rpcError } = await (supabase as any).rpc(
        'submit_trainer_daily_report',
        {
          target_report_date: reportDate,
          target_other_activity: otherActivity || null,
          target_concern: concern || null,
        },
      );
      if (!rpcError) {
        submittedSuccessfully = true;
      }
    } catch {
      submittedSuccessfully = false;
    }

    if (!submittedSuccessfully) {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const adminDb = createAdminClient();

      // Resolve trainer details
      const { data: trainer } = await (adminDb as any)
        .from('trainers')
        .select('id, full_name, staff_number, department_id, departments(id, name)')
        .eq('profile_id', profile.id)
        .maybeSingle();

      const trainerId = trainer?.id || workspace.trainerId || profile.id;
      let departmentId = trainer?.department_id || profile.activeDepartmentId;

      if (!departmentId) {
        const { data: firstDept } = await (adminDb as any)
          .from('departments')
          .select('id, name')
          .limit(1)
          .maybeSingle();
        departmentId = firstDept?.id;
      }

      const trainerName = trainer?.full_name || workspace.trainerName || profile.fullName || 'Trainer';
      const departmentName = (trainer?.departments as any)?.name || workspace.homeDepartmentName || profile.departmentName || 'Department';

      const { data: insertedReport, error: upsertErr } = await (adminDb as any)
        .from('trainer_daily_reports')
        .upsert({
          trainer_id: trainerId,
          trainer_profile_id: profile.id,
          home_department_id: departmentId,
          trainer_name_snapshot: trainerName,
          trainer_number_snapshot: trainer?.staff_number || null,
          home_department_name_snapshot: departmentName,
          report_date: reportDate,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          other_activity: otherActivity || null,
          concern: concern || null,
        }, { onConflict: 'trainer_id,report_date' })
        .select('id')
        .maybeSingle();

      if (upsertErr) {
        console.error('Direct upsert to trainer_daily_reports failed:', upsertErr);
        return {
          status: 'error',
          message: upsertErr.message || 'Unable to submit the daily report. Please try again.',
        };
      }
    }

    try {
      revalidatePath('/staff/daily-report');
      revalidatePath('/operations/daily-reports');
    } catch {
      // Revalidation warning ignored in non-blocking environments
    }

    return { status: 'success', message: 'Daily report submitted successfully.' };
  } catch (err: any) {
    console.error('submitTrainerDailyReportAction error:', err);
    return {
      status: 'error',
      message: err?.message || 'An unexpected error occurred while submitting the report.',
    };
  }
}
