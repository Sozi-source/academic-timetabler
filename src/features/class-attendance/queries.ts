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
  try {
    const { requireTrainerAccess } = await import('@/features/auth/authorization');
    const { getStaffWorkspace } = await import('@/features/staff-assessment/queries');

    const profile = await requireTrainerAccess();
    const workspace = await getStaffWorkspace(profile.id);
    const supabase = await createClient();

    // 1. Fetch published timetable versions
    const { data: publishedVersions } = await (supabase as any)
      .from('timetable_versions')
      .select('id, academic_period_id, snapshot, status')
      .eq('status', 'published')
      .order('version_number', { ascending: false });

    const items: ClassAttendanceScheduleItem[] = [];
    const seenIds = new Set<string>();

    const allocMap = new Map<string, any>();
    for (const alloc of workspace.allocations) {
      allocMap.set(alloc.allocationId, alloc);
      allocMap.set(`${alloc.unitId}:${alloc.cohortId}`, alloc);
    }

    // 2. Extract sessions from published timetable snapshots
    for (const version of publishedVersions ?? []) {
      const snapshot = Array.isArray(version.snapshot) ? (version.snapshot as UnknownRow[]) : [];
      for (const rawItem of snapshot) {
        const item = rawItem as Record<string, any>;
        const sessionId = String(item.id || '');
        if (!sessionId || seenIds.has(sessionId)) continue;

        const itemTrainerId = String(item.trainerId || item.trainer_id || '');
        const itemAllocId = String(item.teachingAllocationId || item.allocationId || item.teaching_allocation_id || '');
        const itemUnitId = String(item.unitId || item.unit_id || '');
        const itemCohortId = String(item.cohortId || item.cohort_id || '');

        const isTrainerMatch =
          itemTrainerId === workspace.trainerId ||
          allocMap.has(itemAllocId) ||
          allocMap.has(`${itemUnitId}:${itemCohortId}`);

        if (!isTrainerMatch) continue;

        seenIds.add(sessionId);

        const alloc = allocMap.get(itemAllocId) || allocMap.get(`${itemUnitId}:${itemCohortId}`) || workspace.allocations[0];
        const dayStr = String(item.day || item.dayOfWeek || item.day_of_week || 'Friday');
        const startsAt = String(item.startTime || item.startsAt || item.starts_at || '08:00');
        const endsAt = String(item.endTime || item.endsAt || item.ends_at || '10:00');

        items.push({
          scheduledSessionId: sessionId,
          teachingAllocationId: alloc?.allocationId || itemAllocId || '',
          academicPeriodId: String(version.academic_period_id || alloc?.academicPeriodId || ''),
          academicPeriodName: alloc?.academicPeriodName || 'Current Term',
          cohortId: itemCohortId || alloc?.cohortId || '',
          cohortName: String(item.cohortName || alloc?.cohortName || 'Cohort'),
          unitId: itemUnitId || alloc?.unitId || '',
          unitName: String(item.unitName || alloc?.unitName || 'Unit'),
          dayOfWeek: dayStr.charAt(0).toUpperCase() + dayStr.slice(1).toLowerCase(),
          daySequence: 1,
          startsAt,
          endsAt,
          sessionNumber: Number(item.sessionNumber || item.session_number || items.length + 1),
          teachingStartsOn: String(alloc?.teachingStartsOn || ''),
          teachingEndsOn: String(alloc?.teachingEndsOn || ''),
          latestClassSessionId: null,
          latestSessionDate: null,
          latestStatus: null,
        });
      }
    }

    if (items.length > 0) {
      // Attach latest class sessions if any exist
      const sessionIds = items.map((i) => i.scheduledSessionId);
      const { data: classSessions } = await (supabase as any)
        .from('class_sessions')
        .select('id, scheduled_session_id, session_date, status')
        .in('scheduled_session_id', sessionIds)
        .order('session_date', { ascending: false });

      const csMap = new Map();
      for (const cs of classSessions ?? []) {
        if (!csMap.has(cs.scheduled_session_id)) {
          csMap.set(cs.scheduled_session_id, cs);
        }
      }

      for (const item of items) {
        const cs = csMap.get(item.scheduledSessionId);
        if (cs) {
          item.latestClassSessionId = String(cs.id);
          item.latestSessionDate = String(cs.session_date);
          item.latestStatus = cs.status as ClassSessionStatus;
        }
      }

      return items;
    }

    return [];
  } catch (err) {
    console.error('getStaffClassAttendanceSchedule failed:', err);
    return [];
  }
}

export async function getStaffClassAttendanceHistory(
  limit =
    30,
): Promise<ClassAttendanceHistoryItem[]> {
  const supabase =
    await createClient();

  try {
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
      return [];
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
  } catch (err) {
    console.warn('getStaffClassAttendanceHistory error:', err);
    return [];
  }
}

export async function getClassAttendanceWorkspace(
  classSessionId:
    string,
): Promise<ClassAttendanceWorkspace | null> {
  const supabase =
    await createClient();

  try {
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

    if (!error && data && Array.isArray(data) && data.length > 0) {
      const rows = data as UnknownRow[];
      const first = rows[0];
      const teachingAllocationId = asString(first.teaching_allocation_id);
      const scheduledSessionId = asString(first.scheduled_session_id);
      const sessionDate = asString(first.session_date);
      const sessionStatus = asString(first.session_status) as ClassSessionStatus | null;

      if (teachingAllocationId && scheduledSessionId && sessionDate && sessionStatus) {
        return {
          classSessionId,
          teachingAllocationId,
          scheduledSessionId,
          sessionDate,
          sessionStatus,
          academicPeriodName: asString(first.academic_period_name) ?? 'Academic Period',
          unitName: asString(first.unit_name) ?? 'Unit',
          cohortName: asString(first.cohort_name) ?? 'Cohort',
          startsAt: asString(first.starts_at) ?? '',
          endsAt: asString(first.ends_at) ?? '',
          rosterCount: asNumber(first.roster_count),
          students: rows
            .map((row) => {
              const studentId = asString(row.student_id);
              if (!studentId) return null;
              return {
                studentId,
                admissionNumber: asString(row.admission_number) ?? '',
                fullName: asString(row.full_name) ?? 'Student',
                attendanceStatus: (asString(row.attendance_status) ?? 'unmarked') as ClassAttendanceStatus,
                note: asString(row.note),
              };
            })
            .filter((st): st is NonNullable<typeof st> => Boolean(st)),
        };
      }
    }
  } catch (err) {
    console.warn('get_class_attendance_workspace RPC warning:', err);
  }

  // Direct Query Fallback
  try {
    const { data: cs } = await (supabase as any)
      .from('class_sessions')
      .select('id, scheduled_session_id, session_date, status, starts_at, ends_at, teaching_allocation_id, cohort_id, unit_id, academic_period_id')
      .eq('id', classSessionId)
      .maybeSingle();

    if (!cs) return null;

    const [
      { data: period },
      { data: unit },
      { data: cohort },
      { data: records },
    ] = await Promise.all([
      cs.academic_period_id ? (supabase as any).from('academic_periods').select('name').eq('id', cs.academic_period_id).maybeSingle() : { data: null },
      cs.unit_id ? (supabase as any).from('units').select('name').eq('id', cs.unit_id).maybeSingle() : { data: null },
      cs.cohort_id ? (supabase as any).from('cohorts').select('name').eq('id', cs.cohort_id).maybeSingle() : { data: null },
      (supabase as any).from('class_attendance_records').select('student_id, status, note, students(admission_number, full_name)').eq('class_session_id', cs.id),
    ]);

    const students = (records ?? []).map((r: any) => ({
      studentId: String(r.student_id),
      admissionNumber: String(r.students?.admission_number || ''),
      fullName: String(r.students?.full_name || 'Student'),
      attendanceStatus: (r.status || 'unmarked') as ClassAttendanceStatus,
      note: r.note ? String(r.note) : null,
    }));

    return {
      classSessionId: cs.id,
      teachingAllocationId: cs.teaching_allocation_id || '',
      scheduledSessionId: cs.scheduled_session_id || '',
      sessionDate: cs.session_date,
      sessionStatus: (cs.status || 'open') as ClassSessionStatus,
      academicPeriodName: period?.name || 'Current Term',
      unitName: unit?.name || 'Unit',
      cohortName: cohort?.name || 'Cohort',
      startsAt: cs.starts_at || '',
      endsAt: cs.ends_at || '',
      rosterCount: students.length,
      students,
    };
  } catch (directErr) {
    console.error('getClassAttendanceWorkspace direct query failed:', directErr);
    return null;
  }
}
