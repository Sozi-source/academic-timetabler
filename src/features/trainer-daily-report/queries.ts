import 'server-only';

import {
  requireHodAccess,
  requireTrainerAccess,
} from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type {
  DepartmentDailyReportWorkspace,
  PastUnrecordedSession,
  TrainerDailyReportWorkspace,
} from './types';
import type { ClassAttendanceScheduleItem } from '@/features/class-attendance/types';

export async function detectPastUnrecordedSessions({
  supabase,
  schedule,
  reportDate,
  lookbackDays = 14,
}: {
  supabase: any;
  schedule: ClassAttendanceScheduleItem[];
  reportDate: string;
  lookbackDays?: number;
}): Promise<PastUnrecordedSession[]> {
  if (schedule.length === 0) return [];

  const targetDateObj = new Date(`${reportDate}T00:00:00Z`);
  const pastDates: Array<{ dateStr: string; dayOfWeek: string; daysOverdue: number }> = [];

  for (let i = 1; i <= lookbackDays; i++) {
    const pastObj = new Date(targetDateObj.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = pastObj.toISOString().slice(0, 10);
    const dayOfWeek = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(pastObj);
    pastDates.push({ dateStr, dayOfWeek, daysOverdue: i });
  }

  const scheduledOnDates: Array<{
    scheduledSessionId: string;
    sessionDate: string;
    dayOfWeek: string;
    unitCode: string;
    unitName: string;
    cohortName: string;
    startsAt: string;
    endsAt: string;
    daysOverdue: number;
  }> = [];

  for (const dateItem of pastDates) {
    for (const item of schedule) {
      if (item.dayOfWeek.toLowerCase() === dateItem.dayOfWeek.toLowerCase()) {
        if (item.teachingStartsOn && dateItem.dateStr < item.teachingStartsOn) continue;
        if (item.teachingEndsOn && dateItem.dateStr > item.teachingEndsOn) continue;

        scheduledOnDates.push({
          scheduledSessionId: item.scheduledSessionId,
          sessionDate: dateItem.dateStr,
          dayOfWeek: dateItem.dayOfWeek,
          unitCode: '',
          unitName: item.unitName,
          cohortName: item.cohortName,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          daysOverdue: dateItem.daysOverdue,
        });
      }
    }
  }

  if (scheduledOnDates.length === 0) return [];

  const scheduledSessionIds = [...new Set(scheduledOnDates.map((s) => s.scheduledSessionId))];
  const dates = [...new Set(scheduledOnDates.map((s) => s.sessionDate))];

  const { data: recordedSessions } = await (supabase as any)
    .from('class_sessions')
    .select('id, scheduled_session_id, session_date, status')
    .in('scheduled_session_id', scheduledSessionIds)
    .in('session_date', dates);

  const recordedMap = new Map<string, string>();
  for (const cs of recordedSessions ?? []) {
    recordedMap.set(`${cs.scheduled_session_id}:${cs.session_date}`, cs.status);
  }

  const unrecorded: PastUnrecordedSession[] = [];
  for (const s of scheduledOnDates) {
    const status = recordedMap.get(`${s.scheduledSessionId}:${s.sessionDate}`);
    if (!status || status === 'open') {
      unrecorded.push({
        scheduledSessionId: s.scheduledSessionId,
        sessionDate: s.sessionDate,
        dayOfWeek: s.dayOfWeek,
        unitCode: s.unitCode,
        unitName: s.unitName,
        cohortName: s.cohortName,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        daysOverdue: s.daysOverdue,
        status: status === 'open' ? 'open' : 'not_started',
      });
    }
  }

  return unrecorded.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

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
      const { getStaffClassAttendanceSchedule } = await import('@/features/class-attendance/queries');
      const attendanceSchedule = await getStaffClassAttendanceSchedule().catch(() => []);
      const pastUnrecordedSessions = await detectPastUnrecordedSessions({
        supabase,
        schedule: attendanceSchedule,
        reportDate,
      });
      const hasOverduePastSessions = pastUnrecordedSessions.some((p) => p.daysOverdue > 2);
      const readyToSubmit = Boolean(data.readyToSubmit) && !hasOverduePastSessions;
      const blockingReason = !data.readyToSubmit
        ? data.blockingReason
        : hasOverduePastSessions
        ? 'You have overdue unrecorded past classes (>48h). Record past attendance or log an exception note to submit.'
        : null;

      return {
        ...data,
        readyToSubmit,
        blockingReason,
        pastUnrecordedSessions,
        hasOverduePastSessions,
      } as TrainerDailyReportWorkspace;
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

    const pastUnrecordedSessions = await detectPastUnrecordedSessions({
      supabase,
      schedule: attendanceSchedule,
      reportDate,
    });

    const reportDayOfWeek = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${reportDate}T00:00:00Z`));

    const daySessions = attendanceSchedule.filter(
      (s) => s.dayOfWeek.toLowerCase() === reportDayOfWeek.toLowerCase()
    );

    const departmentId = profile.activeDepartmentId || '';
    const departmentName = profile.departmentName || 'Department';

    const sessionIdsWithClassSession = daySessions
      .map((s) => s.latestClassSessionId)
      .filter((id): id is string => Boolean(id));

    const sessionStatsMap = new Map<string, {
      rosterCount: number;
      presentCount: number;
      absentCount: number;
      notReportedCount: number;
      absentees: Array<{ studentId: string; admissionNumber: string; fullName: string; note: string | null }>;
    }>();

    if (sessionIdsWithClassSession.length > 0) {
      try {
        const { data: classSessions } = await (supabase as any)
          .from('class_sessions')
          .select('id, roster_count')
          .in('id', sessionIdsWithClassSession);

        const { data: entries } = await (supabase as any)
          .from('class_attendance_entries')
          .select('class_session_id, attendance_status, note, students(id, admission_number, full_name)')
          .in('class_session_id', sessionIdsWithClassSession);

        for (const cs of classSessions ?? []) {
          sessionStatsMap.set(cs.id, {
            rosterCount: Number(cs.roster_count || 0),
            presentCount: 0,
            absentCount: 0,
            notReportedCount: 0,
            absentees: [],
          });
        }

        for (const entry of entries ?? []) {
          const stats = sessionStatsMap.get(entry.class_session_id);
          if (stats) {
            if (entry.attendance_status === 'present') stats.presentCount++;
            if (entry.attendance_status === 'absent') {
              stats.absentCount++;
              stats.absentees.push({
                studentId: entry.students?.id || '',
                admissionNumber: entry.students?.admission_number || '—',
                fullName: entry.students?.full_name || 'Student',
                note: entry.note || null,
              });
            }
            if (entry.attendance_status === 'not_reported') {
              stats.notReportedCount++;
            }
          }
        }
      } catch (statsErr) {
        console.warn('Failed to load session attendance stats:', statsErr);
      }
    }

    const lessons = daySessions.map((s) => {
      const attendanceStatus = (s.latestStatus as 'not_started' | 'open' | 'completed' | 'cancelled') || 'not_started';
      const stats = s.latestClassSessionId ? sessionStatsMap.get(s.latestClassSessionId) : null;

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
        rosterCount: stats?.rosterCount ?? 0,
        presentCount: stats?.presentCount ?? 0,
        absentCount: stats?.absentCount ?? 0,
        notReportedCount: stats?.notReportedCount ?? 0,
        absentees: stats?.absentees ?? [],
      };
    });

    let existingReport: any = null;
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const adminDb = createAdminClient();

      const { data: rep } = await (adminDb as any)
        .from('trainer_daily_reports')
        .select('id, status, submitted_at, other_activity, concern')
        .or(`trainer_id.eq.${workspace.trainerId},trainer_profile_id.eq.${profile.id}`)
        .eq('report_date', reportDate)
        .maybeSingle();
      existingReport = rep;
    } catch {
      // Table query fallback
    }

    const lessonsComplete = lessons.length === 0 || lessons.every((l) => l.attendanceStatus === 'completed' || l.attendanceStatus === 'cancelled');
    const hasOverduePastSessions = pastUnrecordedSessions.some((p) => p.daysOverdue > 2);
    const readyToSubmit = lessonsComplete && !hasOverduePastSessions;
    const blockingReason = !lessonsComplete
      ? 'Complete attendance for all scheduled lessons before submitting the daily report.'
      : hasOverduePastSessions
      ? 'You have overdue unrecorded past classes (>48h). Record past attendance or log an exception note to submit.'
      : null;

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
      pastUnrecordedSessions,
      hasOverduePastSessions,
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
      pastUnrecordedSessions: [],
      hasOverduePastSessions: false,
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
      .select('id, trainer_id, trainer_profile_id, status, submitted_at, other_activity, concern')
      .eq('report_date', reportDate);

    const reportMap = new Map<string, Record<string, any>>();
    for (const r of (reportsData ?? [])) {
      if (r.trainer_id) reportMap.set(String(r.trainer_id), r);
      if (r.trainer_profile_id) reportMap.set(String(r.trainer_profile_id), r);
    }

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
