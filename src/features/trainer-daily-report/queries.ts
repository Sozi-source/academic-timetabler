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
  const profile = await requireTrainerAccess();
  const supabase = await createClient();

  try {
    const { data, error } = await (supabase as any).rpc(
      'get_trainer_daily_report_workspace',
      { target_report_date: reportDate },
    );

    if (!error && data && Array.isArray(data.lessons)) {
      return data as TrainerDailyReportWorkspace;
    }
  } catch (err) {
    console.warn('get_trainer_daily_report_workspace RPC warning:', err);
  }

  // Fallback: Build workspace from published timetable and class sessions
  try {
    const { getStaffWorkspace } = await import('@/features/staff-assessment/queries');
    const { getStaffPublishedTimetable } = await import('@/features/staff-workspace/queries');
    const workspace = await getStaffWorkspace(profile.id);
    const timetable = await getStaffPublishedTimetable(profile.id);

    const reportDayOfWeek = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${reportDate}T00:00:00Z`));

    const daySessions = (timetable?.sessions ?? []).filter(
      (s) => s.dayName.toLowerCase() === reportDayOfWeek.toLowerCase()
    );

    const sessionIds = daySessions.map((s) => s.id);
    const { data: classSessions } = sessionIds.length > 0
      ? await (supabase as any)
          .from('class_sessions')
          .select('id, scheduled_session_id, session_date, status, present_count, absent_count, total_students')
          .in('scheduled_session_id', sessionIds)
          .eq('session_date', reportDate)
      : { data: [] };

    const classSessionMap = new Map<string, Record<string, any>>(
      (classSessions ?? []).map((cs: any) => [String(cs.scheduled_session_id), cs as Record<string, any>])
    );

    const lessons = daySessions.map((s) => {
      const cs = classSessionMap.get(s.id);
      const attendanceStatus = ((cs?.status as string) as 'not_started' | 'open' | 'completed') || 'not_started';
      const presentCount = Number(cs?.present_count || 0);
      const absentCount = Number(cs?.absent_count || 0);

      const departmentId = profile.activeDepartmentId || '';
      const departmentName = profile.departmentName || 'Department';

      return {
        id: cs ? String(cs.id) : null,
        departmentId,
        departmentName,
        timetableVersionId: '',
        timetableVersionNumber: 1,
        timetableTitle: 'Published Timetable',
        scheduledSessionId: s.id,
        teachingAllocationId: '',
        academicPeriodId: s.academicPeriodId,
        cohortId: '',
        unitId: s.unitId,
        sessionNumber: s.sessionNumbers?.[0] || 1,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        unitCode: '',
        unitName: s.unitName,
        cohortName: s.cohortNames?.join(', ') || 'Cohort',
        roomName: s.roomLabel || null,
        deliveryMode: 'Teaching',
        attendanceSessionId: cs ? String(cs.id) : null,
        attendanceStatus,
        rosterCount: presentCount + absentCount,
        presentCount,
        absentCount,
        absentees: [],
      };
    });

    const departmentId = profile.activeDepartmentId || '';
    const departmentName = profile.departmentName || 'Department';

    const { data: existingReport } = await (supabase as any)
      .from('trainer_daily_reports')
      .select('id, status, submitted_at, other_activity, concern')
      .eq('trainer_id', workspace.trainerId)
      .eq('report_date', reportDate)
      .maybeSingle();

    const readyToSubmit = lessons.length === 0 || lessons.every((l) => l.attendanceStatus === 'completed');
    const blockingReason = readyToSubmit ? null : 'Complete attendance for all scheduled lessons before submitting the daily report.';

    return {
      reportDate,
      trainerId: workspace.trainerId,
      trainerName: workspace.trainerName,
      trainerNumber: null,
      homeDepartmentId: departmentId,
      homeDepartmentName: departmentName,
      status: existingReport?.status === 'submitted' ? 'submitted' : 'draft',
      reportId: existingReport ? String(existingReport.id) : null,
      submittedAt: existingReport?.submitted_at || null,
      otherActivity: existingReport?.other_activity || '',
      concern: existingReport?.concern || '',
      readyToSubmit,
      blockingReason,
      lessons,
    };
  } catch (fallbackErr) {
    console.error('Trainer daily report workspace fallback failed:', fallbackErr);
    throw new Error('Unable to load the daily report workspace.');
  }
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
