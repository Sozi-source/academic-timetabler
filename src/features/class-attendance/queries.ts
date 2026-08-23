import 'server-only';

import {
  createClient,
} from '@/lib/supabase/server';

import type {
  ClassAttendanceHistoryItem,
  ClassAttendanceScheduleItem,
  ClassAttendanceStatus,
  ClassAttendanceWorkspace,
  ClassSessionStatus,
} from './types';

type UnknownRow =
  Record<string, unknown>;

function asString(
  value:
    unknown,
): string | null {
  return typeof value ===
    'string'
    ? value
    : null;
}

function asNumber(
  value:
    unknown,
): number {
  const result =
    Number(
      value ??
      0,
    );

  return Number.isFinite(
    result,
  )
    ? result
    : 0;
}

export async function getStaffClassAttendanceSchedule(): Promise<ClassAttendanceScheduleItem[]> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase.rpc('get_staff_class_attendance_schedule');

    if (!error && Array.isArray(data) && data.length > 0) {
      const items = (data as UnknownRow[])
        .map((row): ClassAttendanceScheduleItem | null => {
          const scheduledSessionId = asString(row.scheduled_session_id);
          const teachingAllocationId = asString(row.teaching_allocation_id);
          const academicPeriodId = asString(row.academic_period_id);
          const cohortId = asString(row.cohort_id);
          const unitId = asString(row.unit_id);

          if (!scheduledSessionId || !teachingAllocationId || !academicPeriodId || !cohortId || !unitId) {
            return null;
          }

          return {
            scheduledSessionId,
            teachingAllocationId,
            academicPeriodId,
            academicPeriodName: asString(row.academic_period_name) ?? 'Academic Period',
            cohortId,
            cohortName: asString(row.cohort_name) ?? 'Cohort',
            unitId,
            unitName: asString(row.unit_name) ?? 'Unit',
            dayOfWeek: asString(row.day_of_week) ?? '',
            daySequence: asNumber(row.day_sequence),
            startsAt: asString(row.starts_at) ?? '',
            endsAt: asString(row.ends_at) ?? '',
            sessionNumber: asNumber(row.session_number),
            teachingStartsOn: asString(row.teaching_starts_on) ?? '',
            teachingEndsOn: asString(row.teaching_ends_on) ?? '',
            latestClassSessionId: asString(row.latest_class_session_id),
            latestSessionDate: asString(row.latest_session_date),
            latestStatus: asString(row.latest_status) as ClassSessionStatus | null,
          };
        })
        .filter((item): item is ClassAttendanceScheduleItem => Boolean(item));

      if (items.length > 0) {
        return items;
      }
    }
  } catch (err) {
    console.warn('RPC get_staff_class_attendance_schedule warning:', err);
  }

  // Direct Query Fallback: Pull from published timetable & allocations
  try {
    const { requireTrainerAccess } = await import('@/features/auth/authorization');
    const { getStaffWorkspace } = await import('@/features/staff-workspace/queries');

    const profile = await requireTrainerAccess();
    const workspace = await getStaffWorkspace(profile.id);

    // 1. Get published timetable periods
    const { data: publishedVersions } = await (supabase as any)
      .from('timetable_versions')
      .select('academic_period_id')
      .eq('status', 'published');

    const publishedPeriodIds = new Set(
      (publishedVersions ?? []).map((v: any) => String(v.academic_period_id))
    );

    // 2. Query scheduled sessions for trainer
    const { data: rawSessions } = await (supabase as any)
      .from('scheduled_sessions')
      .select('id, teaching_allocation_id, academic_period_id, cohort_id, unit_id, day_of_week, day_sequence, starts_at, ends_at, session_number')
      .eq('trainer_id', workspace.trainerId)
      .neq('status', 'cancelled');

    let sessions = (rawSessions ?? []).filter((s: any) =>
      publishedPeriodIds.has(String(s.academic_period_id))
    );

    if (sessions.length === 0 && workspace.allocations.length > 0) {
      const allocIds = workspace.allocations.map((a) => a.allocationId);
      const { data: allocSessions } = await (supabase as any)
        .from('scheduled_sessions')
        .select('id, teaching_allocation_id, academic_period_id, cohort_id, unit_id, day_of_week, day_sequence, starts_at, ends_at, session_number')
        .in('teaching_allocation_id', allocIds)
        .neq('status', 'cancelled');

      sessions = (allocSessions ?? []).filter((s: any) =>
        publishedPeriodIds.has(String(s.academic_period_id))
      );
    }

    if (sessions.length === 0) {
      return [];
    }

    // 3. Fetch academic periods, cohorts, units, and recent sessions
    const periodIds = [...new Set(sessions.map((s: any) => s.academic_period_id))];
    const cohortIds = [...new Set(sessions.map((s: any) => s.cohort_id))];
    const unitIds = [...new Set(sessions.map((s: any) => s.unit_id))];
    const sessionIds = sessions.map((s: any) => s.id);

    const [
      { data: periods },
      { data: cohorts },
      { data: units },
      { data: classSessions },
    ] = await Promise.all([
      (supabase as any).from('academic_periods').select('id, name, teaching_starts_on, teaching_ends_on').in('id', periodIds),
      (supabase as any).from('cohorts').select('id, name').in('id', cohortIds),
      (supabase as any).from('units').select('id, name').in('id', unitIds),
      (supabase as any).from('class_sessions').select('id, scheduled_session_id, session_date, status').in('scheduled_session_id', sessionIds).order('session_date', { ascending: false }),
    ]);

    const periodMap = new Map((periods ?? []).map((p: any) => [p.id, p]));
    const cohortMap = new Map((cohorts ?? []).map((c: any) => [c.id, c.name]));
    const unitMap = new Map((units ?? []).map((u: any) => [u.id, u.name]));
    const classSessionMap = new Map();
    for (const cs of classSessions ?? []) {
      if (!classSessionMap.has(cs.scheduled_session_id)) {
        classSessionMap.set(cs.scheduled_session_id, cs);
      }
    }

    return sessions.map((s: any) => {
      const period = periodMap.get(s.academic_period_id);
      const latestCs = classSessionMap.get(s.id);

      return {
        scheduledSessionId: String(s.id),
        teachingAllocationId: String(s.teaching_allocation_id || ''),
        academicPeriodId: String(s.academic_period_id),
        academicPeriodName: String(period?.name || 'Academic Period'),
        cohortId: String(s.cohort_id),
        cohortName: String(cohortMap.get(s.cohort_id) || 'Cohort'),
        unitId: String(s.unit_id),
        unitName: String(unitMap.get(s.unit_id) || 'Unit'),
        dayOfWeek: String(s.day_of_week || ''),
        daySequence: Number(s.day_sequence || 0),
        startsAt: String(s.starts_at || ''),
        endsAt: String(s.ends_at || ''),
        sessionNumber: Number(s.session_number || 1),
        teachingStartsOn: String(period?.teaching_starts_on || ''),
        teachingEndsOn: String(period?.teaching_ends_on || ''),
        latestClassSessionId: latestCs ? String(latestCs.id) : null,
        latestSessionDate: latestCs ? String(latestCs.session_date) : null,
        latestStatus: latestCs ? (String(latestCs.status) as ClassSessionStatus) : null,
      };
    });
  } catch (err) {
    console.error('Attendance schedule direct fallback failed:', err);
    return [];
  }
}

export async function getStaffClassAttendanceHistory(
  limit =
    30,
): Promise<ClassAttendanceHistoryItem[]> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_staff_class_attendance_history',
      {
        target_limit:
          limit,
      },
    );

  if (error) {
    throw new Error(
      `Unable to load attendance history: ${error.message}`,
    );
  }

  return (
    (
      data ??
      []
    ) as UnknownRow[]
  )
    .map(
      (
        row,
      ): ClassAttendanceHistoryItem | null => {
        const classSessionId =
          asString(
            row.class_session_id,
          );

        const teachingAllocationId =
          asString(
            row.teaching_allocation_id,
          );

        const sessionDate =
          asString(
            row.session_date,
          );

        const status =
          asString(
            row.status,
          ) as
            | ClassSessionStatus
            | null;

        if (
          !classSessionId ||
          !teachingAllocationId ||
          !sessionDate ||
          !status
        ) {
          return null;
        }

        return {
          classSessionId,
          teachingAllocationId,
          sessionDate,
          status,
          unitName:
            asString(
              row.unit_name,
            ) ??
            'Unit',
          cohortName:
            asString(
              row.cohort_name,
            ) ??
            'Cohort',
          startsAt:
            asString(
              row.starts_at,
            ) ??
            '',
          endsAt:
            asString(
              row.ends_at,
            ) ??
            '',
          rosterCount:
            asNumber(
              row.roster_count,
            ),
          presentCount:
            asNumber(
              row.present_count,
            ),
          absentCount:
            asNumber(
              row.absent_count,
            ),
          unmarkedCount:
            asNumber(
              row.unmarked_count,
            ),
        };
      },
    )
    .filter(
      (
        item,
      ): item is
        ClassAttendanceHistoryItem =>
        Boolean(
          item,
        ),
    );
}

export async function getClassAttendanceWorkspace(
  classSessionId:
    string,
): Promise<ClassAttendanceWorkspace | null> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_class_attendance_workspace',
      {
        target_class_session_id:
          classSessionId,
      },
    );

  if (error) {
    if (
      error.code ===
        'P0002' ||
      error.code ===
        '42501'
    ) {
      return null;
    }

    throw new Error(
      `Unable to load class attendance: ${error.message}`,
    );
  }

  const rows =
    (
      data ??
      []
    ) as UnknownRow[];

  if (
    rows.length ===
    0
  ) {
    return null;
  }

  const first =
    rows[0];

  const teachingAllocationId =
    asString(
      first.teaching_allocation_id,
    );

  const scheduledSessionId =
    asString(
      first.scheduled_session_id,
    );

  const sessionDate =
    asString(
      first.session_date,
    );

  const sessionStatus =
    asString(
      first.session_status,
    ) as
      | ClassSessionStatus
      | null;

  if (
    !teachingAllocationId ||
    !scheduledSessionId ||
    !sessionDate ||
    !sessionStatus
  ) {
    return null;
  }

  return {
    classSessionId,
    teachingAllocationId,
    scheduledSessionId,
    sessionDate,
    sessionStatus,
    academicPeriodName:
      asString(
        first.academic_period_name,
      ) ??
      'Academic Period',
    unitName:
      asString(
        first.unit_name,
      ) ??
      'Unit',
    cohortName:
      asString(
        first.cohort_name,
      ) ??
      'Cohort',
    startsAt:
      asString(
        first.starts_at,
      ) ??
      '',
    endsAt:
      asString(
        first.ends_at,
      ) ??
      '',
    rosterCount:
      asNumber(
        first.roster_count,
      ),
    students:
      rows
        .map(
          (row) => {
            const studentId =
              asString(
                row.student_id,
              );

            if (!studentId) {
              return null;
            }

            return {
              studentId,
              admissionNumber:
                asString(
                  row.admission_number,
                ) ??
                '',
              fullName:
                asString(
                  row.full_name,
                ) ??
                'Student',
              attendanceStatus:
                (
                  asString(
                    row.attendance_status,
                  ) ??
                  'unmarked'
                ) as
                  ClassAttendanceStatus,
              note:
                asString(
                  row.note,
                ),
            };
          },
        )
        .filter(
          (
            student,
          ): student is
            NonNullable<
              typeof student
            > =>
            Boolean(
              student,
            ),
        ),
  };
}
