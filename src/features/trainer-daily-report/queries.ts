import 'server-only';

import {
  requireHodAccess,
  requireTrainerAccess,
} from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type {
  DepartmentDailyReportWorkspace,
  TrainerDailyReportWorkspace,
} from './types';

export async function getTrainerDailyReportWorkspace(
  reportDate: string,
): Promise<TrainerDailyReportWorkspace> {
  await requireTrainerAccess();
  const supabase = await createClient();

  const { data, error } = await (supabase as any).rpc(
    'get_trainer_daily_report_workspace',
    { target_report_date: reportDate },
  );

  if (error) {
    throw new Error(`Unable to load the daily report: ${error.message}`);
  }

  return data as TrainerDailyReportWorkspace;
}

export async function getDepartmentDailyReports(
  reportDate: string,
): Promise<DepartmentDailyReportWorkspace> {
  await requireHodAccess();
  const supabase = await createClient();

  const { data, error } = await (supabase as any).rpc(
    'get_department_trainer_daily_reports',
    { target_report_date: reportDate },
  );

  if (error) {
    throw new Error(
      `Unable to load trainer daily reports: ${error.message}`,
    );
  }

  return data as DepartmentDailyReportWorkspace;
}
