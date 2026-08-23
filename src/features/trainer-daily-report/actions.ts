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
    return {
      status: 'error',
      message: error.message || 'The daily report could not be submitted.',
    };
  }

  revalidatePath('/staff/daily-report');
  revalidatePath('/operations/daily-reports');

  return { status: 'success', message: 'Daily report submitted.' };
}
