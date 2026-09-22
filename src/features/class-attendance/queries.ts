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
  Record<string, any>;

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

    // Current/future attendance must follow the live locked timetable.
    // Published snapshots are historical reporting data; they are not the
    // source of truth for the trainer's current attendance register.
    const { data: liveSessions, error: liveSessionsError } = await (supabase as any)
      .from('scheduled_sessions')
      .select(`
        id,
        academic_period_id,
        teaching_allocation_id,
        cohort_id,
        unit_id,
        trainer_id,
        working_day_id,
        start_time_slot_id,
        end_time_slot_id,
        session_number
      `)
      .eq('trainer_id', workspace.trainerId)
      .eq('status', 'locked');

    if (liveSessionsError) {
      throw liveSessionsError;
    }

    const sessions = (liveSessions ?? []) as UnknownRow[];
    const unitIds = [...new Set(sessions.map((row) => String(row.unit_id || '')).filter(Boolean))];
    const cohortIds = [...new Set(sessions.map((row) => String(row.cohort_id || '')).filter(Boolean))];
    const workingDayIds = [...new Set(sessions.map((row) => String(row.working_day_id || '')).filter(Boolean))];
    const timeSlotIds = [...new Set(
      sessions.flatMap((row) => [String(row.start_time_slot_id || ''), String(row.end_time_slot_id || '')]).filter(Boolean),
    )];

    const [unitsResult, cohortsResult, daysResult, slotsResult] = await Promise.all([
      unitIds.length
        ? (supabase as any).from('units').select('id, name').in('id', unitIds)
        : Promise.resolve({ data: [] }),
      cohortIds.length
        ? (supabase as any).from('cohorts').select('id, name').in('id', cohortIds)
        : Promise.resolve({ data: [] }),
      workingDayIds.length
        ? (supabase as any).from('working_days').select('id, day_of_week').in('id', workingDayIds)
        : Promise.resolve({ data: [] }),
      timeSlotIds.length
        ? (supabase as any).from('time_slots').select('id, starts_at, ends_at').in('id', timeSlotIds)
        : Promise.resolve({ data: [] }),
    ]);

    const unitMap = new Map((unitsResult.data ?? []).map((row: any) => [String(row.id), row]));
    const cohortMap = new Map((cohortsResult.data ?? []).map((row: any) => [String(row.id), row]));
    const dayMap = new Map((daysResult.data ?? []).map((row: any) => [String(row.id), row]));
    const slotMap = new Map((slotsResult.data ?? []).map((row: any) => [String(row.id), row]));

    const allocMap = new Map<string, any>();
    for (const alloc of workspace.allocations) {
      allocMap.set(alloc.allocationId, alloc);
      allocMap.set(`${alloc.unitId}:${alloc.cohortId}`, alloc);
    }

    const items: ClassAttendanceScheduleItem[] = [];
    const seenIds = new Set<string>();

    for (const raw of sessions) {
      const sessionId = String(raw.id || '');
      if (!sessionId || seenIds.has(sessionId)) continue;

      const allocationId = String(raw.teaching_allocation_id || '');
      const unitId = String(raw.unit_id || '');
      const cohortId = String(raw.cohort_id || '');
      const alloc = allocMap.get(allocationId) || allocMap.get(`${unitId}:${cohortId}`);
      const day = dayMap.get(String(raw.working_day_id || ''));
      const startSlot = slotMap.get(String(raw.start_time_slot_id || ''));
      const endSlot = slotMap.get(String(raw.end_time_slot_id || ''));
      const unit = unitMap.get(unitId);
      const cohort = cohortMap.get(cohortId);

      if (!unit || !cohort || !day || !startSlot || !endSlot) continue;

      seenIds.add(sessionId);
      const dayStr = String((day as any).day_of_week || '');

      items.push({
        scheduledSessionId: sessionId,
        teachingAllocationId: allocationId,
        academicPeriodId: String(raw.academic_period_id || alloc?.academicPeriodId || ''),
        academicPeriodName: alloc?.academicPeriodName || 'Current Term',
        cohortId,
        cohortName: String((cohort as any).name || alloc?.cohortName || 'Cohort'),
        unitId,
        unitName: String((unit as any).name || alloc?.unitName || 'Unit'),
        dayOfWeek: dayStr.charAt(0).toUpperCase() + dayStr.slice(1).toLowerCase(),
        daySequence: 1,
        startsAt: String((startSlot as any).starts_at || '08:00'),
        endsAt: String((endSlot as any).ends_at || '10:00'),
        sessionNumber: Number(raw.session_number || 0),
        teachingStartsOn: String(alloc?.teachingStartsOn || ''),
        teachingEndsOn: String(alloc?.teachingEndsOn || ''),
        latestClassSessionId: null,
        latestSessionDate: null,
        latestStatus: null,
      });
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

      // Attach latest class sessions if any exist (querying by scheduled_session_id, allocation IDs, and unit IDs)
      const sessionIds = items.map((i) => i.scheduledSessionId).filter(Boolean);
      const allocIds = [...new Set(items.map((i) => i.teachingAllocationId).filter(Boolean))];
      const unitIds = [...new Set(items.map((i) => i.unitId).filter(Boolean))];

      let csQuery = (supabase as any)
        .from('class_sessions')
        .select('id, scheduled_session_id, teaching_allocation_id, unit_id, cohort_id, session_date, status')
        .order('session_date', { ascending: false });

      const orParts: string[] = [];
      if (sessionIds.length > 0) orParts.push(`scheduled_session_id.in.(${sessionIds.join(',')})`);
      if (allocIds.length > 0) orParts.push(`teaching_allocation_id.in.(${allocIds.join(',')})`);
      if (unitIds.length > 0) orParts.push(`unit_id.in.(${unitIds.join(',')})`);
      if (workspace.trainerId) orParts.push(`trainer_id.eq.${workspace.trainerId}`);
      if (profile.id) orParts.push(`opened_by.eq.${profile.id}`);

      if (orParts.length > 0) {
        csQuery = csQuery.or(orParts.join(','));
      }

      const { data: classSessions } = await csQuery;

      const csBySessionId = new Map();
      const csByAllocUnit = new Map();
      const csByUnitCohort = new Map();
      const csByUnit = new Map();

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
        if (cs.unit_id && !csByUnit.has(cs.unit_id)) {
          csByUnit.set(cs.unit_id, cs);
        }
      }

      for (const item of items) {
        const cs =
          csBySessionId.get(item.scheduledSessionId) ||
          csByAllocUnit.get(`${item.teachingAllocationId}:${item.unitId}`) ||
          csByUnitCohort.get(`${item.unitId}:${item.cohortId}`) ||
          csByUnit.get(item.unitId);

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
