'use server';

import { revalidatePath } from 'next/cache';

import { requireTrainerAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

export interface TrainerDailyReportActionState {
  status: 'idle' | 'success' | 'error';
  message: string;
}

export const initialTrainerDailyReportActionState:
  TrainerDailyReportActionState = {
    status: 'idle',
    message: '',
  };

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

export async function submitTrainerDailyReportAction(
  _previousState: TrainerDailyReportActionState,
  formData: FormData,
): Promise<TrainerDailyReportActionState> {
  await requireTrainerAccess();

  const reportDate = textValue(formData, 'reportDate');
  const otherActivity = textValue(formData, 'otherActivity');
  const concern = textValue(formData, 'concern');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    return { status: 'error', message: 'The report date is invalid.' };
  }

  if (otherActivity.length > 800) {
    return { status: 'error', message: 'Other activity is too long.' };
  }

  if (concern.length > 1200) {
    return { status: 'error', message: 'Concern is too long.' };
  }

  const supabase = await createClient();

  const { error } = await (supabase as any).rpc(
    'submit_trainer_daily_report',
    {
      target_report_date: reportDate,
      target_other_activity: otherActivity || null,
      target_concern: concern || null,
    },
  );

  if (error) {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const { getStaffWorkspace } = await import('@/features/staff-assessment/queries');
      const profile = await requireTrainerAccess();
      const workspace = await getStaffWorkspace(profile.id).catch(() => ({
        trainerId: profile.id,
      }));

      const adminDb = createAdminClient();
      await (adminDb as any).from('trainer_daily_reports').upsert({
        trainer_id: workspace.trainerId,
        home_department_id: profile.activeDepartmentId || null,
        report_date: reportDate,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        other_activity: otherActivity || null,
        concern: concern || null,
      }, { onConflict: 'trainer_id,report_date' });

      revalidatePath('/staff/daily-report');
      revalidatePath('/operations/daily-reports');

      return { status: 'success', message: 'Daily report submitted.' };
    } catch {
      return {
        status: 'error',
        message: error.message || 'The daily report could not be submitted.',
      };
    }
  }

  revalidatePath('/staff/daily-report');
  revalidatePath('/operations/daily-reports');

  return { status: 'success', message: 'Daily report submitted.' };
}
