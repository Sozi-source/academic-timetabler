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

  // Fallback: Build workspace from published timetable schedule
  try {
    const { getStaffWorkspace } = await import('@/features/staff-assessment/queries');
    const { getStaffClassAttendanceSchedule } = await import('@/features/class-attendance/queries');

    const [workspace, attendanceSchedule] = await Promise.all([
      getStaffWorkspace(profile.id).catch(() => ({
        trainerId: profile.id,
        trainerName: profile.fullName,
        trainerEmail: profile.email,
        allocations: [],
      })),
      getStaffClassAttendanceSchedule().catch(() => []),
    ]);

    const reportDayOfWeek = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${reportDate}T00:00:00Z`));

    const daySessions = attendanceSchedule.filter(
      (s) => s.dayOfWeek.toLowerCase() === reportDayOfWeek.toLowerCase()
    );

    const departmentId = profile.activeDepartmentId || '';
    const departmentName = profile.departmentName || 'Department';

    const lessons = daySessions.map((s) => {
      const attendanceStatus = (s.latestStatus as 'not_started' | 'open' | 'completed') || 'not_started';

      return {
        id: s.latestClassSessionId || null,
        departmentId,
        departmentName,
        timetableVersionId: '',
        timetableVersionNumber: 1,
        timetableTitle: 'Published Timetable',
        scheduledSessionId: s.scheduledSessionId,
        teachingAllocationId: s.teachingAllocationId,
        academicPeriodId: s.academicPeriodId,
        cohortId: s.cohortId,
        unitId: s.unitId,
        sessionNumber: s.sessionNumber || 1,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        unitCode: '',
        unitName: s.unitName,
        cohortName: s.cohortName,
        roomName: null,
        deliveryMode: 'Teaching',
        attendanceSessionId: s.latestClassSessionId || null,
        attendanceStatus,
        rosterCount: 0,
        presentCount: 0,
        absentCount: 0,
        absentees: [],
      };
    });

    let existingReport: any = null;
    try {
      const { data: rep } = await (supabase as any)
        .from('trainer_daily_reports')
        .select('id, status, submitted_at, other_activity, concern')
        .eq('trainer_id', workspace.trainerId)
        .eq('report_date', reportDate)
        .maybeSingle();
      existingReport = rep;
    } catch {
      // Table might not exist yet
    }

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
    const departmentId = profile.activeDepartmentId || '';
    const departmentName = profile.departmentName || 'Department';

    return {
      reportDate,
      trainerId: profile.id,
      trainerName: profile.fullName,
      trainerNumber: null,
      homeDepartmentId: departmentId,
      homeDepartmentName: departmentName,
      status: 'draft',
      reportId: null,
      submittedAt: null,
      otherActivity: '',
      concern: '',
      readyToSubmit: true,
      blockingReason: null,
      lessons: [],
    };
  }
}

export async function getDepartmentDailyReports(
  reportDate: string,
): Promise<DepartmentDailyReportWorkspace> {
  const profile = await requireHodAccess();
  const supabase = await createClient();

  try {
    const { data, error } = await (supabase as any).rpc(
      'get_department_trainer_daily_reports',
      { target_report_date: reportDate },
    );

    if (!error && data && Array.isArray(data.reports)) {
      return data as DepartmentDailyReportWorkspace;
    }
  } catch (err) {
    console.warn('get_department_trainer_daily_reports RPC warning:', err);
  }

  // Fallback: Direct database query
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const adminDb = createAdminClient();

    const departmentId = profile.activeDepartmentId || '';
    const departmentName = profile.departmentName || 'Department';

    // 1. Get all active trainers
    const { data: trainers } = await (adminDb as any)
      .from('trainers')
      .select('id, full_name')
      .eq('is_active', true);

    const activeTrainers = (trainers ?? []).map((t: any) => ({
      trainerId: String(t.id),
      trainerName: String(t.full_name),
    }));

    // 2. Get submitted reports for this date
    const { data: reportsData } = await (adminDb as any)
      .from('trainer_daily_reports')
      .select('id, trainer_id, status, submitted_at, other_activity, concern')
      .eq('report_date', reportDate);

    const reportMap = new Map<string, Record<string, any>>(
      (reportsData ?? []).map((r: any) => [String(r.trainer_id), r as Record<string, any>])
    );

    const submittedReports: any[] = [];
    let totalConcerns = 0;

    for (const trainer of activeTrainers) {
      const rep = reportMap.get(trainer.trainerId);
      if (rep && rep.status === 'submitted') {
        if (rep.concern) totalConcerns++;

        submittedReports.push({
          reportId: String(rep.id),
          trainerId: trainer.trainerId,
          trainerName: trainer.trainerName,
          trainerNumber: null,
          homeDepartmentId: departmentId,
          homeDepartmentName: departmentName,
          submittedAt: String(rep.submitted_at || new Date().toISOString()),
          otherActivity: String(rep.other_activity || ''),
          concern: String(rep.concern || ''),
          lessons: [],
        });
      }
    }

    const pendingTrainers = activeTrainers.filter((t: any) => !reportMap.has(t.trainerId));

    return {
      reportDate,
      departmentId,
      departmentName,
      generatedAt: new Date().toISOString(),
      summary: {
        expectedTrainers: activeTrainers.length,
        submittedReports: submittedReports.length,
        pendingReports: pendingTrainers.length,
        scheduledLessons: 0,
        recordedAbsences: 0,
        concerns: totalConcerns,
      },
      pendingTrainers,
      reports: submittedReports,
    };
  } catch (directErr) {
    console.error('getDepartmentDailyReports direct fallback failed:', directErr);
    const departmentId = profile.activeDepartmentId || '';
    const departmentName = profile.departmentName || 'Department';

    return {
      reportDate,
      departmentId,
      departmentName,
      generatedAt: new Date().toISOString(),
      summary: {
        expectedTrainers: 0,
        submittedReports: 0,
        pendingReports: 0,
        scheduledLessons: 0,
        recordedAbsences: 0,
        concerns: 0,
      },
      pendingTrainers: [],
      reports: [],
    };
  }
}
