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
    teachingAllocationId: string;
    unitId: string;
    cohortId: string;
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
          teachingAllocationId: item.teachingAllocationId,
          unitId: item.unitId,
          cohortId: item.cohortId,
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

  const scheduledSessionIds = [...new Set(scheduledOnDates.map((s) => s.scheduledSessionId).filter(Boolean))];
  const allocationIds = [...new Set(scheduledOnDates.map((s) => s.teachingAllocationId).filter(Boolean))];
  const unitIds = [...new Set(scheduledOnDates.map((s) => s.unitId).filter(Boolean))];
  const dates = [...new Set(scheduledOnDates.map((s) => s.sessionDate))];

  let csQuery = (supabase as any)
    .from('class_sessions')
    .select('id, scheduled_session_id, teaching_allocation_id, unit_id, cohort_id, session_date, status, starts_at, ends_at')
    .in('session_date', dates);

  const orConditions: string[] = [];
  if (scheduledSessionIds.length > 0) orConditions.push(`scheduled_session_id.in.(${scheduledSessionIds.join(',')})`);
  if (allocationIds.length > 0) orConditions.push(`teaching_allocation_id.in.(${allocationIds.join(',')})`);
  if (unitIds.length > 0) orConditions.push(`unit_id.in.(${unitIds.join(',')})`);
  if (trainerId) orConditions.push(`trainer_id.eq.${trainerId}`);
  if (trainerProfileId) orConditions.push(`opened_by.eq.${trainerProfileId}`);

  if (orConditions.length > 0) {
    csQuery = csQuery.or(orConditions.join(','));
  }

  const { data: recordedSessions } = await csQuery;

  const recordedMap = new Map<string, string>();
  for (const cs of recordedSessions ?? []) {
    if (cs.scheduled_session_id) {
      recordedMap.set(`${cs.scheduled_session_id}:${cs.session_date}`, cs.status);
    }
    if (cs.teaching_allocation_id) {
      recordedMap.set(`${cs.teaching_allocation_id}:${cs.session_date}`, cs.status);
    }
    if (cs.unit_id && cs.cohort_id) {
      recordedMap.set(`${cs.unit_id}:${cs.cohort_id}:${cs.session_date}`, cs.status);
      if (cs.starts_at) {
        recordedMap.set(`${cs.unit_id}:${cs.cohort_id}:${cs.session_date}:${cs.starts_at}`, cs.status);
      }
    }
    if (cs.unit_id) {
      recordedMap.set(`${cs.unit_id}:${cs.session_date}`, cs.status);
      if (cs.starts_at) {
        recordedMap.set(`${cs.unit_id}:${cs.session_date}:${cs.starts_at}`, cs.status);
      }
    }
  }

  const unrecordedSessions: PastUnrecordedSession[] = [];
  const dateSessionsMap = new Map<
    string,
    { total: number; recorded: number; completed: number; cancelled: number; dayOfWeek: string; daysOverdue: number }
  >();

  for (const s of scheduledOnDates) {
    const status =
      recordedMap.get(`${s.scheduledSessionId}:${s.sessionDate}`) ||
      recordedMap.get(`${s.teachingAllocationId}:${s.sessionDate}`) ||
      recordedMap.get(`${s.unitId}:${s.cohortId}:${s.sessionDate}:${s.startsAt}`) ||
      recordedMap.get(`${s.unitId}:${s.cohortId}:${s.sessionDate}`) ||
      recordedMap.get(`${s.unitId}:${s.sessionDate}:${s.startsAt}`) ||
      recordedMap.get(`${s.unitId}:${s.sessionDate}`);

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

  // Exclude dates the trainer has explicitly hidden from the backlog banner.
  let dismissedDates = new Set<string>();
  try {
    let dismissQuery = (supabase as any)
      .from('trainer_backlog_dismissals')
      .select('report_date')
      .in('report_date', dates);
    if (trainerId) dismissQuery = dismissQuery.eq('trainer_id', trainerId);
    const { data: dismissed } = await dismissQuery;
    dismissedDates = new Set((dismissed ?? []).map((d: any) => d.report_date));
  } catch (err) {
    // Table may not exist yet if the migration hasn't been applied — treat
    // as "nothing dismissed" rather than failing the whole workspace load.
    console.warn('trainer_backlog_dismissals lookup warning:', err);
  }

  const filteredUnrecordedSessions = dismissedDates.size
    ? unrecordedSessions.filter((s) => !dismissedDates.has(s.sessionDate))
    : unrecordedSessions;
  const filteredUnsubmittedReportDates = dismissedDates.size
    ? unsubmittedReportDates.filter((r) => !dismissedDates.has(r.reportDate))
    : unsubmittedReportDates;

  filteredUnrecordedSessions.sort((a, b) => b.daysOverdue - a.daysOverdue);
  filteredUnsubmittedReportDates.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return { unrecordedSessions: filteredUnrecordedSessions, unsubmittedReportDates: filteredUnsubmittedReportDates };
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

// Builds the workspace for a PAST (non-today) date directly from what the
// trainer actually recorded in class_sessions that day, instead of
// re-projecting the CURRENT live timetable onto a past date. The timetable
// can be edited/regenerated after the fact, so reprojection was silently
// showing the wrong (or zero) lessons for past dates and made "catch up on
// a missed report" fail or submit an empty report. This is the graceful,
// ground-truth path for past dates. Returns null (caller falls through to
// the normal path) once the report for that date is already submitted, so
// the immutable submitted snapshot is always used for submitted reports.
async function buildPastRecordedDailyReportWorkspace(
  profile: any,
  reportDate: string,
): Promise<TrainerDailyReportWorkspace | null> {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const adminDb = createAdminClient();

  const { data: trainer } = await (adminDb as any)
    .from('trainers')
    .select('id, full_name, staff_number, department_id, departments(id, name)')
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!trainer?.id) return null;

  const trainerId = trainer.id;
  const departmentId = trainer.department_id || profile.activeDepartmentId || '';
  const departmentName = (trainer.departments as any)?.name || profile.departmentName || 'Department';

  const { data: existingReport } = await (adminDb as any)
    .from('trainer_daily_reports')
    .select('id, status, other_activity, concern')
    .eq('trainer_id', trainerId)
    .eq('report_date', reportDate)
    .maybeSingle();

  if (existingReport?.status === 'submitted') return null;

  const { data: daySessions } = await (adminDb as any)
    .from('class_sessions')
    .select(
      'id, unit_id, cohort_id, teaching_allocation_id, academic_period_id, scheduled_session_id, starts_at, ends_at, status, roster_count',
    )
    .eq('session_date', reportDate)
    .or(`trainer_id.eq.${trainerId},opened_by.eq.${profile.id}`);

  const sessions = daySessions ?? [];
  const unitIds = [...new Set(sessions.map((s: any) => s.unit_id).filter(Boolean))];
  const cohortIds = [...new Set(sessions.map((s: any) => s.cohort_id).filter(Boolean))];

  const [{ data: units }, { data: cohorts }] = await Promise.all([
    unitIds.length
      ? (adminDb as any).from('units').select('id, code, name').in('id', unitIds)
      : Promise.resolve({ data: [] }),
    cohortIds.length
      ? (adminDb as any).from('cohorts').select('id, name').in('id', cohortIds)
      : Promise.resolve({ data: [] }),
  ]);
  const unitMap = new Map((units ?? []).map((u: any) => [u.id, u]));
  const cohortMap = new Map((cohorts ?? []).map((c: any) => [c.id, c]));

  const sessionIds = sessions.map((s: any) => s.id);
  const statsBySession = new Map<string, { present: number; absent: number; absentees: any[] }>();
  if (sessionIds.length > 0) {
    const { data: entries } = await (adminDb as any)
      .from('class_attendance_entries')
      .select('class_session_id, attendance_status, note, students(id, admission_number, full_name)')
      .in('class_session_id', sessionIds);

    for (const entry of entries ?? []) {
      const cur = statsBySession.get(entry.class_session_id) || { present: 0, absent: 0, absentees: [] };
      if (entry.attendance_status === 'present') cur.present++;
      if (entry.attendance_status === 'absent') {
        cur.absent++;
        cur.absentees.push({
          studentId: entry.students?.id || '',
          admissionNumber: entry.students?.admission_number || '—',
          fullName: entry.students?.full_name || 'Student',
          note: entry.note || null,
        });
      }
      statsBySession.set(entry.class_session_id, cur);
    }
  }

  const lessons = sessions.map((s: any) => {
    const unit = unitMap.get(s.unit_id) as any;
    const cohort = cohortMap.get(s.cohort_id) as any;
    const stats = statsBySession.get(s.id) || { present: 0, absent: 0, absentees: [] };
    const attendanceStatus =
      s.status === 'completed' || s.status === 'cancelled'
        ? s.status
        : s.status === 'open'
          ? 'open'
          : 'not_started';

    return {
      id: s.id,
      departmentId,
      departmentName,
      timetableVersionId: '',
      timetableVersionNumber: 1,
      timetableTitle: '',
      scheduledSessionId: s.scheduled_session_id || '',
      teachingAllocationId: s.teaching_allocation_id || '',
      academicPeriodId: s.academic_period_id || '',
      cohortId: s.cohort_id || '',
      unitId: s.unit_id || '',
      sessionNumber: 1,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      unitCode: unit?.code || '',
      unitName: unit?.name || 'Unit',
      cohortName: cohort?.name || 'Cohort',
      roomName: null,
      deliveryMode: 'Teaching',
      attendanceSessionId: s.id,
      attendanceStatus,
      rosterCount: s.roster_count || 0,
      presentCount: stats.present,
      absentCount: stats.absent,
      absentees: stats.absentees,
    };
  });

  const anyOpen = sessions.some((s: any) => s.status === 'open');
  const lessonsComplete =
    lessons.length === 0 ||
    lessons.every((l) => l.attendanceStatus === 'completed' || l.attendanceStatus === 'cancelled');

  return {
    reportDate,
    trainerId,
    trainerName: trainer.full_name || profile.fullName,
    trainerNumber: trainer.staff_number || null,
    homeDepartmentId: departmentId,
    homeDepartmentName: departmentName,
    status: 'draft',
    reportId: existingReport?.id ? String(existingReport.id) : null,
    submittedAt: null,
    otherActivity: existingReport?.other_activity || '',
    concern: existingReport?.concern || '',
    readyToSubmit: lessonsComplete,
    blockingReason: anyOpen
      ? 'Finish the in-progress register for this date before submitting its report.'
      : !lessonsComplete
        ? 'Complete Class Attendance for all recorded lessons before submitting the daily report.'
        : null,
    lessons,
    pastUnrecordedSessions: [],
    unsubmittedPastReportDates: [],
    hasOverduePastSessions: false,
  } as TrainerDailyReportWorkspace;
}

export async function getTrainerDailyReportWorkspace(
  reportDate: string,
): Promise<TrainerDailyReportWorkspace> {
  const profile = await requireTrainerAccess();
  const supabase = await createClient();

  // Past dates: build strictly from what was actually recorded that day.
  // Never re-project the live/current timetable onto a past date — see
  // buildPastRecordedDailyReportWorkspace for why that was unreliable.
  const { nairobiToday } = await import('./domain');
  if (reportDate < nairobiToday()) {
    const pastWorkspace = await buildPastRecordedDailyReportWorkspace(profile, reportDate).catch(
      (err) => {
        console.warn('buildPastRecordedDailyReportWorkspace warning:', err);
        return null;
      },
    );
    if (pastWorkspace) return pastWorkspace;
  }

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

      // Defensive check: Reconcile cancelled & completed sessions from class_sessions directly
      // in case database RPC lateral join excluded them
      const scheduledSessionIds = data.lessons
        .map((l: any) => l.scheduledSessionId)
        .filter(Boolean);
      const allocationIds = data.lessons
        .map((l: any) => l.teachingAllocationId)
        .filter(Boolean);
      const unitIds = data.lessons
        .map((l: any) => l.unitId)
        .filter(Boolean);

      if (scheduledSessionIds.length > 0 || allocationIds.length > 0 || unitIds.length > 0) {
        try {
          const orFilter: string[] = [];
          if (scheduledSessionIds.length > 0) orFilter.push(`scheduled_session_id.in.(${scheduledSessionIds.join(',')})`);
          if (allocationIds.length > 0) orFilter.push(`teaching_allocation_id.in.(${allocationIds.join(',')})`);
          if (unitIds.length > 0) orFilter.push(`unit_id.in.(${unitIds.join(',')})`);

          const { data: realSessions } = await (supabase as any)
            .from('class_sessions')
            .select('id, scheduled_session_id, teaching_allocation_id, unit_id, status, notes')
            .eq('session_date', reportDate)
            .or(orFilter.join(','));

          for (const lesson of data.lessons) {
            const match = (realSessions ?? []).find(
              (cs: any) =>
                (cs.scheduled_session_id && cs.scheduled_session_id === lesson.scheduledSessionId) ||
                (cs.teaching_allocation_id && cs.teaching_allocation_id === lesson.teachingAllocationId) ||
                (cs.unit_id && cs.unit_id === lesson.unitId)
            );
            if (match) {
              if (match.status === 'cancelled') {
                lesson.attendanceStatus = 'cancelled';
                lesson.attendanceSessionId = match.id;
              } else if (match.status === 'completed') {
                lesson.attendanceStatus = 'completed';
                lesson.attendanceSessionId = match.id;
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

      // Past overdue items are informational only — they no longer gate
      // submission of TODAY's report. Only today's own attendance
      // completeness determines readyToSubmit.
      const hasOverduePastSessions = unrecordedSessions.length > 0 || unsubmittedReportDates.length > 0;
      const readyToSubmit = lessonsComplete;
      const blockingReason = !lessonsComplete
        ? 'Complete Class Attendance for all scheduled lessons before submitting the daily report.'
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

    // Past overdue items are informational only — they no longer gate
    // submission of TODAY's report.
    const hasOverduePastSessions = unrecordedSessions.length > 0 || unsubmittedReportDates.length > 0;
    const readyToSubmit = lessonsComplete;
    const blockingReason = !lessonsComplete
      ? 'Complete attendance for all scheduled lessons before submitting the daily report.'
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

  // 1. Resolve trainers belonging to the active department.
  // Strict scope: trainer.department_id must equal the HOD's active
  // department. No name-text fallback (home_department.ilike) — that
  // fuzzy matching previously let trainers from other departments with
  // overlapping name substrings leak into this list.
  let deptTrainersQuery = (adminDb as any)
    .from('trainers')
    .select('id, full_name, staff_number, department_id, home_department')
    .eq('is_active', true);

  if (departmentId && !isSysAdmin) {
    deptTrainersQuery = deptTrainersQuery.eq('department_id', departmentId);
  }

  const { data: deptTrainersData } = await deptTrainersQuery;
  const deptTrainerIdSet = new Set((deptTrainersData ?? []).map((t: any) => String(t.id)));

  try {
    const { data, error } = await (supabase as any).rpc(
      'get_department_trainer_daily_reports',
      { target_report_date: reportDate },
    );

    if (!error && data && Array.isArray(data.reports)) {
      // Strictly scope to this department's own trainers (home department
      // only). Deliberately no lesson-department or name-substring
      // fallback here — those were the source of other departments'
      // trainers leaking into this HOD's daily report list.
      const filteredReports = (data.reports as any[]).filter((r) => {
        if (isSysAdmin) return true;
        if (r.homeDepartmentId && departmentId) return r.homeDepartmentId === departmentId;
        return deptTrainerIdSet.has(String(r.trainerId));
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

    // Filter submitted reports strictly to this department's own trainers
    // (home department only). No lesson-department or name-substring
    // fallback — that previously leaked other departments' trainers in.
    const filteredReportsData = (reportsData ?? []).filter((r: any) => {
      if (isSysAdmin) return true;
      if (r.home_department_id && departmentId) return r.home_department_id === departmentId;
      return Boolean(r.trainer_id && deptTrainerIdSet.has(String(r.trainer_id)));
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
