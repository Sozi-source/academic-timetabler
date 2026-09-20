import 'server-only';

import {
  createClient,
} from '@/lib/supabase/server';
import { getUnifiedUnitRoster } from '@/features/academic-roster/unified-roster';

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
      // Resolve multi-cohort names for each unit & academic period
      const unitPeriodKeys = [...new Set(items.map((i) => `${i.unitId}:${i.academicPeriodId}`).filter(Boolean))];
      const multiCohortMap = new Map<string, string>();

      await Promise.all(
        unitPeriodKeys.map(async (key) => {
          const [uId, pId] = key.split(':');
          try {
            const roster = await getUnifiedUnitRoster({
              supabase,
              unitId: uId,
              academicPeriodId: pId,
            });
            if (roster.joinedCohortName && roster.joinedCohortName !== 'Cohort') {
              multiCohortMap.set(key, roster.joinedCohortName);
            }
          } catch {
            // Ignore failure, retain snapshot cohort name
          }
        })
      );

      for (const item of items) {
        const fullCohortName = multiCohortMap.get(`${item.unitId}:${item.academicPeriodId}`);
        if (fullCohortName) {
          item.cohortName = fullCohortName;
        }
      }

      // Attach latest class sessions if any exist (querying by both scheduled_session_id and allocation IDs)
      const sessionIds = items.map((i) => i.scheduledSessionId).filter(Boolean);
      const allocIds = [...new Set(items.map((i) => i.teachingAllocationId).filter(Boolean))];
      const unitIds = [...new Set(items.map((i) => i.unitId).filter(Boolean))];

      let csQuery = (supabase as any)
        .from('class_sessions')
        .select('id, scheduled_session_id, teaching_allocation_id, unit_id, cohort_id, session_date, status')
        .order('session_date', { ascending: false });

      if (sessionIds.length > 0 && allocIds.length > 0) {
        csQuery = csQuery.or(`scheduled_session_id.in.(${sessionIds.join(',')}),teaching_allocation_id.in.(${allocIds.join(',')})`);
      } else if (sessionIds.length > 0) {
        csQuery = csQuery.in('scheduled_session_id', sessionIds);
      } else if (allocIds.length > 0) {
        csQuery = csQuery.in('teaching_allocation_id', allocIds);
      }

      const { data: classSessions } = await csQuery;

      const csBySessionId = new Map();
      const csByAllocUnit = new Map();
      const csByUnitCohort = new Map();

      for (const cs of classSessions ?? []) {
        if (cs.scheduled_session_id && !csBySessionId.has(cs.scheduled_session_id)) {
          csBySessionId.set(cs.scheduled_session_id, cs);
        }
        const allocKey = `${cs.teaching_allocation_id}:${cs.unit_id}`;
        if (cs.teaching_allocation_id && !csByAllocUnit.has(allocKey)) {
          csByAllocUnit.set(allocKey, cs);
        }
        const unitCohortKey = `${cs.unit_id}:${cs.cohort_id}`;
        if (cs.unit_id && cs.cohort_id && !csByUnitCohort.has(unitCohortKey)) {
          csByUnitCohort.set(unitCohortKey, cs);
        }
      }

      for (const item of items) {
        const cs =
          csBySessionId.get(item.scheduledSessionId) ||
          csByAllocUnit.get(`${item.teachingAllocationId}:${item.unitId}`) ||
          csByUnitCohort.get(`${item.unitId}:${item.cohortId}`);

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
  classSessionId: string,
): Promise<ClassAttendanceWorkspace | null> {
  const supabase = await createClient();

  try {
    const { data: cs } = await (supabase as any)
      .from('class_sessions')
      .select('id, scheduled_session_id, session_date, status, starts_at, ends_at, teaching_allocation_id, cohort_id, unit_id, academic_period_id, roster_count')
      .eq('id', classSessionId)
      .maybeSingle();

    if (!cs) return null;

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const adminDb = createAdminClient();

    const [roster, periodResult, unitResult, entriesResult] = await Promise.all([
      getUnifiedUnitRoster({
        supabase: adminDb,
        unitId: cs.unit_id,
        academicPeriodId: cs.academic_period_id,
        allocationId: cs.teaching_allocation_id,
      }),
      cs.academic_period_id ? (supabase as any).from('academic_periods').select('name').eq('id', cs.academic_period_id).maybeSingle() : { data: null },
      cs.unit_id ? (supabase as any).from('units').select('name').eq('id', cs.unit_id).maybeSingle() : { data: null },
      (adminDb as any).from('class_attendance_entries').select('student_id, attendance_status, note').eq('class_session_id', cs.id),
    ]);

    const existingEntriesMap = new Map<string, { attendanceStatus: ClassAttendanceStatus; note: string | null }>();
    for (const entry of (entriesResult.data ?? [])) {
      existingEntriesMap.set(String(entry.student_id), {
        attendanceStatus: (entry.attendance_status || 'unmarked') as ClassAttendanceStatus,
        note: entry.note ? String(entry.note) : null,
      });
    }

    // Purge any legacy entries for students not registered for this unit
    const validStudentIdSet = new Set(roster.students.map((st) => st.studentId));
    const orphanedStudentIds = (entriesResult.data ?? [])
      .map((entry: any) => String(entry.student_id))
      .filter((sId: string) => !validStudentIdSet.has(sId));

    if (orphanedStudentIds.length > 0) {
      await (adminDb as any)
        .from('class_attendance_entries')
        .delete()
        .eq('class_session_id', cs.id)
        .in('student_id', orphanedStudentIds);

      for (const oId of orphanedStudentIds) {
        existingEntriesMap.delete(oId);
      }

      await (adminDb as any)
        .from('class_sessions')
        .update({ roster_count: roster.totalCount, updated_at: new Date().toISOString() })
        .eq('id', cs.id);
    }

    // Auto-seed missing registered students into class_attendance_entries
    const missingStudents = roster.students.filter((st) => !existingEntriesMap.has(st.studentId));
    if (missingStudents.length > 0) {
      const newRecords = missingStudents.map((st) => ({
        class_session_id: cs.id,
        student_id: st.studentId,
        cohort_id: st.cohortId || cs.cohort_id,
        attendance_status: 'unmarked',
      }));

      await (adminDb as any)
        .from('class_attendance_entries')
        .upsert(newRecords, { onConflict: 'class_session_id,student_id', ignoreDuplicates: true });

      for (const rec of newRecords) {
        existingEntriesMap.set(rec.student_id, {
          attendanceStatus: rec.attendance_status as ClassAttendanceStatus,
          note: null,
        });
      }

      await (adminDb as any)
        .from('class_sessions')
        .update({ roster_count: roster.totalCount, updated_at: new Date().toISOString() })
        .eq('id', cs.id);
    }

    const students = roster.students.map((st) => {
      const entry = existingEntriesMap.get(st.studentId);
      return {
        studentId: st.studentId,
        admissionNumber: st.admissionNumber,
        fullName: st.fullName,
        attendanceStatus: entry?.attendanceStatus ?? 'unmarked',
        note: entry?.note ?? null,
      };
    });

    return {
      classSessionId: cs.id,
      teachingAllocationId: cs.teaching_allocation_id || '',
      scheduledSessionId: cs.scheduled_session_id || '',
      sessionDate: cs.session_date,
      sessionStatus: (cs.status || 'open') as ClassSessionStatus,
      academicPeriodName: periodResult.data?.name || 'Current Term',
      unitName: unitResult.data?.name || 'Unit',
      cohortName: roster.joinedCohortName || 'Cohort',
      startsAt: cs.starts_at || '',
      endsAt: cs.ends_at || '',
      rosterCount: students.length,
      students,
    };
  } catch (err) {
    console.error('getClassAttendanceWorkspace failed:', err);
    return null;
  }
}
