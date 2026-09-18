import 'server-only';

import {
  requireHodAccess,
  requireTrainerAccess,
} from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type {
  DepartmentDailyReportWorkspace,
  DepartmentRecentSubmissionDay,
  PastUnrecordedSession,
  PastUnsubmittedReportDate,
  TrainerDailyReportWorkspace,
} from './types';
import type { ClassAttendanceScheduleItem } from '@/features/class-attendance/types';

export async function detectPastUnrecordedReportsAndSessions({
  supabase,
  schedule,
  reportDate,
  trainerProfileId,
  trainerId,
  lookbackDays = 14,
}: {
  supabase: any;
  schedule: ClassAttendanceScheduleItem[];
  reportDate: string;
  trainerProfileId?: string;
  trainerId?: string;
  lookbackDays?: number;
}): Promise<{
  unrecordedSessions: PastUnrecordedSession[];
  unsubmittedReportDates: PastUnsubmittedReportDate[];
}> {
  if (schedule.length === 0) {
    return { unrecordedSessions: [], unsubmittedReportDates: [] };
  }

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

  if (scheduledOnDates.length === 0) {
    return { unrecordedSessions: [], unsubmittedReportDates: [] };
  }

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

  const unrecordedSessions: PastUnrecordedSession[] = [];
  const dateSessionsMap = new Map<
    string,
    { total: number; recorded: number; completed: number; cancelled: number; dayOfWeek: string; daysOverdue: number }
  >();

  for (const s of scheduledOnDates) {
    const status = recordedMap.get(`${s.scheduledSessionId}:${s.sessionDate}`);
    const isRecorded = status === 'completed' || status === 'cancelled';
    const isCompleted = status === 'completed';
    const isCancelled = status === 'cancelled';

    const cur = dateSessionsMap.get(s.sessionDate) || {
      total: 0,
      recorded: 0,
      completed: 0,
      cancelled: 0,
      dayOfWeek: s.dayOfWeek,
      daysOverdue: s.daysOverdue,
    };
    cur.total++;
    if (isRecorded) cur.recorded++;
    if (isCompleted) cur.completed++;
    if (isCancelled) cur.cancelled++;
    dateSessionsMap.set(s.sessionDate, cur);

    if (!isRecorded) {
      unrecordedSessions.push({
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

  // Check for unsubmitted past daily reports
  const unsubmittedReportDates: PastUnsubmittedReportDate[] = [];
  try {
    let query = (supabase as any)
      .from('trainer_daily_reports')
      .select('report_date, status')
      .in('report_date', dates)
      .eq('status', 'submitted');

    if (trainerId && trainerProfileId) {
      query = query.or(`trainer_id.eq.${trainerId},trainer_profile_id.eq.${trainerProfileId}`);
    } else if (trainerProfileId) {
      query = query.eq('trainer_profile_id', trainerProfileId);
    } else if (trainerId) {
      query = query.eq('trainer_id', trainerId);
    }

    const { data: submittedReports } = await query;
    const submittedDatesSet = new Set((submittedReports ?? []).map((r: any) => r.report_date));

    // Only dates where AT LEAST ONE class was completed/taught, all classes are recorded, but daily report was never submitted.
    // Days where 100% of sessions were cancelled (did not take place) do not require a separate daily report.
    for (const [dateStr, info] of dateSessionsMap.entries()) {
      if (
        info.total > 0 &&
        info.completed > 0 &&
        info.recorded === info.total &&
        !submittedDatesSet.has(dateStr)
      ) {
        unsubmittedReportDates.push({
          reportDate: dateStr,
          dayOfWeek: info.dayOfWeek,
          daysOverdue: info.daysOverdue,
          lessonCount: info.total,
        });
      }
    }
  } catch (err) {
    console.warn('detectPastUnrecordedReportsAndSessions reports check warning:', err);
  }

  unrecordedSessions.sort((a, b) => b.daysOverdue - a.daysOverdue);
  unsubmittedReportDates.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return { unrecordedSessions, unsubmittedReportDates };
}

export async function detectPastUnrecordedSessions(args: {
  supabase: any;
  schedule: ClassAttendanceScheduleItem[];
  reportDate: string;
  lookbackDays?: number;
}): Promise<PastUnrecordedSession[]> {
  const res = await detectPastUnrecordedReportsAndSessions(args);
  return res.unrecordedSessions;
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
      const { unrecordedSessions, unsubmittedReportDates } = await detectPastUnrecordedReportsAndSessions({
        supabase,
        schedule: attendanceSchedule,
        reportDate,
        trainerProfileId: profile.id,
        trainerId: data.trainerId,
      });

      // Defensive check: Reconcile cancelled sessions from class_sessions directly
      // in case database RPC lateral join excluded them
      const scheduledSessionIds = data.lessons
        .map((l: any) => l.scheduledSessionId)
        .filter(Boolean);

      if (scheduledSessionIds.length > 0) {
        try {
          const { data: realSessions } = await (supabase as any)
            .from('class_sessions')
            .select('id, scheduled_session_id, status, notes')
            .in('scheduled_session_id', scheduledSessionIds)
            .eq('session_date', reportDate);

          const realStatusMap = new Map<string, { status: string; id: string }>(
            (realSessions ?? []).map((cs: any) => [cs.scheduled_session_id, { status: cs.status, id: cs.id }])
          );

          for (const lesson of data.lessons) {
            const sessionInfo = realStatusMap.get(lesson.scheduledSessionId);
            if (sessionInfo) {
              if (sessionInfo.status === 'cancelled') {
                lesson.attendanceStatus = 'cancelled';
                lesson.attendanceSessionId = sessionInfo.id;
              } else if (sessionInfo.status === 'completed') {
                lesson.attendanceStatus = 'completed';
                lesson.attendanceSessionId = sessionInfo.id;
              }
            }
          }
        } catch (reconcileErr) {
          console.warn('Cancelled session reconciliation warning:', reconcileErr);
        }
      }

      const lessonsComplete =
        data.lessons.length === 0 ||
        data.lessons.every((l: any) => l.attendanceStatus === 'completed' || l.attendanceStatus === 'cancelled');

      const hasOverduePastSessions = unrecordedSessions.length > 0 || unsubmittedReportDates.length > 0;
      const readyToSubmit = lessonsComplete && !hasOverduePastSessions;
      const blockingReason = !lessonsComplete
        ? 'Complete Class Attendance for all scheduled lessons before submitting the daily report.'
        : unrecordedSessions.length > 0
        ? `You have ${unrecordedSessions.length} unrecorded past class session(s). Please record attendance or log an exception for ${unrecordedSessions[0].sessionDate} (${unrecordedSessions[0].unitName}) before submitting.`
        : unsubmittedReportDates.length > 0
        ? `You have ${unsubmittedReportDates.length} unsubmitted previous daily report(s). Please submit your report for ${unsubmittedReportDates[0].dayOfWeek}, ${unsubmittedReportDates[0].reportDate} before submitting.`
        : null;

      return {
        ...data,
        readyToSubmit,
        blockingReason,
        pastUnrecordedSessions: unrecordedSessions,
        unsubmittedPastReportDates: unsubmittedReportDates,
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

    const { unrecordedSessions, unsubmittedReportDates } = await detectPastUnrecordedReportsAndSessions({
      supabase,
      schedule: attendanceSchedule,
      reportDate,
      trainerProfileId: profile.id,
      trainerId: workspace.trainerId,
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

    const scheduledIds = daySessions.map((s) => s.scheduledSessionId);
    let dateClassSessions: any[] = [];
    try {
      const { data: csData } = await (supabase as any)
        .from('class_sessions')
        .select('id, scheduled_session_id, status, roster_count')
        .in('scheduled_session_id', scheduledIds)
        .eq('session_date', reportDate);
      dateClassSessions = csData ?? [];
    } catch (e) {
      console.warn('Fallback class_sessions query warning:', e);
    }

    const dateCsMap = new Map((dateClassSessions ?? []).map((cs: any) => [cs.scheduled_session_id, cs]));
    const sessionIdsWithClassSession = dateClassSessions.map((cs) => cs.id);

    const sessionStatsMap = new Map<string, {
      rosterCount: number;
      presentCount: number;
      absentCount: number;
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
          }
        }
      } catch (statsErr) {
        console.warn('Failed to load session attendance stats:', statsErr);
      }
    }

    const lessons = daySessions.map((s) => {
      const cs = dateCsMap.get(s.scheduledSessionId);
      const attendanceStatus = (cs?.status as 'not_started' | 'open' | 'completed' | 'cancelled') || 'not_started';
      const stats = cs ? sessionStatsMap.get(cs.id) : null;

      return {
        id: cs?.id || null,
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
        attendanceSessionId: cs?.id || null,
        attendanceStatus,
        rosterCount: stats?.rosterCount ?? 0,
        presentCount: stats?.presentCount ?? 0,
        absentCount: stats?.absentCount ?? 0,
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

    const lessonsComplete =
      lessons.length === 0 ||
      lessons.every((l) => l.attendanceStatus === 'completed' || l.attendanceStatus === 'cancelled');

    const hasOverduePastSessions = unrecordedSessions.length > 0 || unsubmittedReportDates.length > 0;
    const readyToSubmit = lessonsComplete && !hasOverduePastSessions;
    const blockingReason = !lessonsComplete
      ? 'Complete attendance for all scheduled lessons before submitting the daily report.'
      : unrecordedSessions.length > 0
      ? `You have ${unrecordedSessions.length} unrecorded past class session(s). Please record attendance or log an exception for ${unrecordedSessions[0].sessionDate} (${unrecordedSessions[0].unitName}) before submitting.`
      : unsubmittedReportDates.length > 0
      ? `You have ${unsubmittedReportDates.length} unsubmitted previous daily report(s). Please submit your report for ${unsubmittedReportDates[0].dayOfWeek}, ${unsubmittedReportDates[0].reportDate} before submitting.`
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
      pastUnrecordedSessions: unrecordedSessions,
      unsubmittedPastReportDates: unsubmittedReportDates,
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
  const isSysAdmin = profile.role === 'system_admin';
  const departmentId = profile.activeDepartmentId || '';
  const departmentName = profile.departmentName || 'Department';

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const adminDb = createAdminClient();

  // Query recent submission dates across the last 7 days for HOD alerts
  const recentSubmissions: DepartmentRecentSubmissionDay[] = [];
  try {
    const { nairobiToday, shiftDailyReportDate } = await import('./domain');
    const today = nairobiToday();
    const lookbackDates: string[] = [];
    for (let i = 1; i <= 7; i++) {
      lookbackDates.push(shiftDailyReportDate(today, -i));
    }

    const { data: recentReports } = await (adminDb as any)
      .from('trainer_daily_reports')
      .select('report_date, id, concern, home_department_id')
      .in('report_date', lookbackDates)
      .eq('status', 'submitted');

    if (recentReports && recentReports.length > 0) {
      const countsByDate = new Map<string, { count: number; concerns: number }>();
      for (const rep of recentReports) {
        if (!isSysAdmin && departmentId && rep.home_department_id && rep.home_department_id !== departmentId) {
          continue;
        }
        const prev = countsByDate.get(rep.report_date) || { count: 0, concerns: 0 };
        prev.count++;
        if (rep.concern?.trim()) prev.concerns++;
        countsByDate.set(rep.report_date, prev);
      }

      for (const d of lookbackDates) {
        const info = countsByDate.get(d);
        if (info && info.count > 0) {
          recentSubmissions.push({
            reportDate: d,
            submittedCount: info.count,
            recordedAbsences: 0,
            concerns: info.concerns,
          });
        }
      }
    }
  } catch (recentErr) {
    console.warn('Failed to load recentSubmissions in getDepartmentDailyReports:', recentErr);
  }

  // 1. Resolve trainers belonging to the active department
  let deptTrainersQuery = (adminDb as any)
    .from('trainers')
    .select('id, full_name, staff_number, department_id, home_department')
    .eq('is_active', true);

  if (departmentId && !isSysAdmin) {
    deptTrainersQuery = deptTrainersQuery.or(`department_id.eq.${departmentId},home_department.ilike.%${departmentName}%`);
  }

  const { data: deptTrainersData } = await deptTrainersQuery;
  const deptTrainerIdSet = new Set((deptTrainersData ?? []).map((t: any) => String(t.id)));

  try {
    const { data, error } = await (supabase as any).rpc(
      'get_department_trainer_daily_reports',
      { target_report_date: reportDate },
    );

    if (!error && data && Array.isArray(data.reports)) {
      // Defensively filter to only trainers who belong to this department or taught department lessons
      const filteredReports = (data.reports as any[]).filter((r) => {
        if (isSysAdmin) return true;
        if (r.homeDepartmentId && departmentId && r.homeDepartmentId === departmentId) return true;
        if (deptTrainerIdSet.has(String(r.trainerId))) return true;
        if (Array.isArray(r.lessons) && r.lessons.some((l: any) => l.departmentId === departmentId)) return true;
        if (r.homeDepartmentName && departmentName && r.homeDepartmentName.toLowerCase().includes(departmentName.toLowerCase())) return true;
        return false;
      });

      const filteredPending = (data.pendingTrainers as any[]).filter((t) => {
        if (isSysAdmin) return true;
        if (deptTrainerIdSet.size > 0) {
          return deptTrainerIdSet.has(String(t.trainerId));
        }
        return false;
      });

      const scheduledLessons = filteredReports.reduce(
        (sum, r) => sum + (r.lessons?.length || 0),
        0
      );
      const recordedAbsences = filteredReports.reduce(
        (sum, r) =>
          sum +
          (r.lessons || []).reduce((lSum: number, l: any) => lSum + (Number(l.absentCount) || 0), 0),
        0
      );
      const totalConcerns = filteredReports.filter((r) => Boolean(r.concern?.trim())).length;

      return {
        reportDate,
        departmentId: data.departmentId || departmentId,
        departmentName: data.departmentName || departmentName,
        generatedAt: data.generatedAt || new Date().toISOString(),
        summary: {
          expectedTrainers: filteredReports.length + filteredPending.length,
          submittedReports: filteredReports.length,
          pendingReports: filteredPending.length,
          scheduledLessons,
          recordedAbsences,
          concerns: totalConcerns,
        },
        pendingTrainers: filteredPending,
        reports: filteredReports,
        recentSubmissions,
      };
    }
  } catch (err) {
    console.warn('get_department_trainer_daily_reports RPC warning:', err);
  }

  // Fallback: Direct database query scoped to department trainers and lessons
  try {
    const activeTrainers = (deptTrainersData ?? []).map((t: any) => ({
      trainerId: String(t.id),
      trainerName: String(t.full_name),
      staffNumber: t.staff_number ? String(t.staff_number) : null,
    }));

    // Get submitted reports for this date
    const { data: reportsData } = await (adminDb as any)
      .from('trainer_daily_reports')
      .select('id, trainer_id, trainer_profile_id, trainer_name_snapshot, trainer_number_snapshot, home_department_id, home_department_name_snapshot, status, submitted_at, other_activity, concern')
      .eq('report_date', reportDate)
      .eq('status', 'submitted');

    // Also check lessons for this date to ensure service trainers teaching in this department are included
    const allReportIds = (reportsData ?? []).map((r: any) => r.id);
    let deptLessonReportIds = new Set<string>();
    if (allReportIds.length > 0 && departmentId && !isSysAdmin) {
      const { data: deptLessons } = await (adminDb as any)
        .from('trainer_daily_report_lessons')
        .select('report_id')
        .in('report_id', allReportIds)
        .eq('department_id', departmentId);
      deptLessonReportIds = new Set((deptLessons ?? []).map((l: any) => l.report_id));
    }

    // Filter submitted reports strictly to this department's trainers and lessons
    const filteredReportsData = (reportsData ?? []).filter((r: any) => {
      if (isSysAdmin) return true;
      if (r.home_department_id && departmentId && r.home_department_id === departmentId) return true;
      if (deptLessonReportIds.has(r.id)) return true;
      if (r.trainer_id && deptTrainerIdSet.has(String(r.trainer_id))) return true;
      if (r.home_department_name_snapshot && departmentName && r.home_department_name_snapshot.toLowerCase().includes(departmentName.toLowerCase())) return true;
      return false;
    });

    const reportIds = filteredReportsData.map((r: any) => r.id);
    const lessonsByReport = new Map<string, any[]>();

    if (reportIds.length > 0) {
      const { data: lessonsData } = await (adminDb as any)
        .from('trainer_daily_report_lessons')
        .select('*')
        .in('report_id', reportIds)
        .order('starts_at', { ascending: true });

      for (const l of lessonsData ?? []) {
        const list = lessonsByReport.get(l.report_id) || [];
        list.push({
          id: l.id,
          departmentId: l.department_id,
          departmentName: l.department_name_snapshot,
          timetableVersionId: l.timetable_version_id,
          timetableVersionNumber: l.timetable_version_number,
          timetableTitle: l.timetable_title,
          scheduledSessionId: l.scheduled_session_id,
          teachingAllocationId: l.teaching_allocation_id,
          academicPeriodId: l.academic_period_id,
          cohortId: l.cohort_id,
          unitId: l.unit_id,
          sessionNumber: l.session_number,
          startsAt: l.starts_at,
          endsAt: l.ends_at,
          unitCode: l.unit_code_snapshot || '',
          unitName: l.unit_name_snapshot,
          cohortName: l.cohort_name_snapshot,
          roomName: l.room_name_snapshot,
          deliveryMode: l.delivery_mode_snapshot,
          attendanceSessionId: l.attendance_session_id,
          attendanceStatus: 'completed',
          rosterCount: l.roster_count,
          presentCount: l.present_count,
          absentCount: l.absent_count,
          absentees: l.absentees || [],
        });
        lessonsByReport.set(l.report_id, list);
      }
    }

    const submittedReports: any[] = [];
    let totalConcerns = 0;
    const submittedTrainerIds = new Set<string>();

    for (const rep of filteredReportsData) {
      submittedTrainerIds.add(String(rep.trainer_id));
      if (rep.trainer_profile_id) submittedTrainerIds.add(String(rep.trainer_profile_id));
      if (rep.concern?.trim()) totalConcerns++;

      const lessons = lessonsByReport.get(rep.id) || [];
      submittedReports.push({
        reportId: String(rep.id),
        trainerId: String(rep.trainer_id),
        trainerName: rep.trainer_name_snapshot || 'Trainer',
        trainerNumber: rep.trainer_number_snapshot || null,
        homeDepartmentId: rep.home_department_id || departmentId,
        homeDepartmentName: rep.home_department_name_snapshot || departmentName,
        submittedAt: String(rep.submitted_at || new Date().toISOString()),
        otherActivity: String(rep.other_activity || ''),
        concern: String(rep.concern || ''),
        lessons,
      });
    }

    const pendingTrainers = activeTrainers
      .filter((t: any) => !submittedTrainerIds.has(t.trainerId))
      .map((t: any) => ({
        trainerId: t.trainerId,
        trainerName: t.trainerName,
      }));

    const scheduledLessons = submittedReports.reduce((sum, r) => sum + r.lessons.length, 0);
    const recordedAbsences = submittedReports.reduce(
      (sum, r) => sum + r.lessons.reduce((lSum: number, l: any) => lSum + (Number(l.absentCount) || 0), 0),
      0
    );

    return {
      reportDate,
      departmentId,
      departmentName,
      generatedAt: new Date().toISOString(),
      summary: {
        expectedTrainers: activeTrainers.length,
        submittedReports: submittedReports.length,
        pendingReports: pendingTrainers.length,
        scheduledLessons,
        recordedAbsences,
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
