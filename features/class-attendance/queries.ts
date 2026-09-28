import 'server-only';

import {
  createClient,
} from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUnifiedUnitRoster } from '@/features/academic-roster/unified-roster';
import { normalizeDayOfWeek } from './domain';

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

export async function resolveTrainerAttendanceSchedule(
  profileId: string,
): Promise<ClassAttendanceScheduleItem[]> {
  try {
    const { getStaffWorkspace } = await import('@/features/staff-assessment/queries');
    const workspace = await getStaffWorkspace(profileId);
    const admin = createAdminClient();

    const allocationIds = workspace.allocations
      .map((a) => a.allocationId)
      .filter(Boolean);

    const allocMap = new Map<string, any>();
    for (const alloc of workspace.allocations) {
      allocMap.set(alloc.allocationId, alloc);
      allocMap.set(`${alloc.unitId}:${alloc.cohortId}`, alloc);
      allocMap.set(alloc.unitId, alloc);
    }

    // 1. Fetch academic periods for metadata
    const { data: periodsData } = await (admin as any)
      .from('academic_periods')
      .select('id, name, teaching_starts_on, teaching_ends_on');

    const periodMap = new Map<string, any>(
      (periodsData ?? []).map((p: any) => [String(p.id), p]),
    );

    const items: ClassAttendanceScheduleItem[] = [];
    const seenSessionIds = new Set<string>();

    // 2. Load published timetable snapshots (exact same authoritative source as /staff/timetable)
    const { data: publishedVersions } = await (admin as any)
      .from('timetable_versions')
      .select('id, academic_period_id, snapshot, status, version_number')
      .eq('status', 'published')
      .order('version_number', { ascending: false });

    if (publishedVersions && publishedVersions.length > 0) {
      for (const v of publishedVersions) {
        const periodId = String(v.academic_period_id || '');
        const period = periodMap.get(periodId);
        const snapshot = Array.isArray(v.snapshot) ? v.snapshot : [];

        for (const raw of snapshot) {
          const sessionId = String(raw.id || '');
          if (!sessionId || seenSessionIds.has(sessionId)) continue;

          const rawTrainerId = String(raw.trainerId || '');
          const rawAllocId = String(raw.teachingAllocationId || raw.allocationId || '');
          const rawUnitId = String(raw.unitId || '');
          const rawCohortId = String(raw.cohortId || '');

          const isTrainerMatch = rawTrainerId && rawTrainerId === String(workspace.trainerId);
          const isAllocMatch = rawAllocId && allocationIds.includes(rawAllocId);
          const isUnitCohortMatch = allocMap.has(`${rawUnitId}:${rawCohortId}`);
          const isUnitMatch = allocMap.has(rawUnitId);

          if (isTrainerMatch || isAllocMatch || isUnitCohortMatch || isUnitMatch) {
            seenSessionIds.add(sessionId);

            const alloc = allocMap.get(rawAllocId) || allocMap.get(`${rawUnitId}:${rawCohortId}`) || allocMap.get(rawUnitId);
            const unitName = String(raw.unitName || alloc?.unitName || 'Unit');
            const cohortName = String(raw.cohortName || alloc?.cohortName || 'Cohort');
            const dayOfWeek = normalizeDayOfWeek(raw.day || raw.dayOfWeek);

            items.push({
              scheduledSessionId: sessionId,
              teachingAllocationId: rawAllocId || alloc?.allocationId || '',
              academicPeriodId: periodId || alloc?.academicPeriodId || '',
              academicPeriodName: period?.name || alloc?.academicPeriodName || 'Current Term',
              cohortId: rawCohortId || alloc?.cohortId || '',
              cohortName,
              unitId: rawUnitId || alloc?.unitId || '',
              unitName,
              dayOfWeek,
              daySequence: Number(raw.daySequence || 1),
              startsAt: String(raw.startTime || '08:00'),
              endsAt: String(raw.endTime || '10:00'),
              sessionNumber: Number(raw.sessionNumber || 1),
              teachingStartsOn: String(period?.teaching_starts_on || alloc?.teachingStartsOn || ''),
              teachingEndsOn: String(period?.teaching_ends_on || alloc?.teachingEndsOn || ''),
              latestClassSessionId: null,
              latestSessionDate: null,
              latestStatus: null,
            });
          }
        }
      }
    }

    // 3. Supplement with live scheduled sessions (draft, confirmed, or locked)
    const [byTrainerResult, byAllocationResult] = await Promise.all([
      (admin as any)
        .from('scheduled_sessions')
        .select('id, academic_period_id, teaching_allocation_id, cohort_id, unit_id, trainer_id, working_day_id, start_time_slot_id, end_time_slot_id, session_number, status')
        .eq('trainer_id', workspace.trainerId)
        .neq('status', 'cancelled'),
      allocationIds.length > 0
        ? (admin as any)
            .from('scheduled_sessions')
            .select('id, academic_period_id, teaching_allocation_id, cohort_id, unit_id, trainer_id, working_day_id, start_time_slot_id, end_time_slot_id, session_number, status')
            .in('teaching_allocation_id', allocationIds)
            .neq('status', 'cancelled')
        : Promise.resolve({ data: [] }),
    ]);

    const liveSessions: UnknownRow[] = [];
    for (const row of [
      ...((byTrainerResult.data ?? []) as UnknownRow[]),
      ...((byAllocationResult.data ?? []) as UnknownRow[]),
    ]) {
      const sid = String(row.id || '');
      if (sid && !seenSessionIds.has(sid)) {
        seenSessionIds.add(sid);
        liveSessions.push(row);
      }
    }

    if (liveSessions.length > 0) {
      const unitIds = [...new Set(liveSessions.map((r) => String(r.unit_id || '')).filter(Boolean))];
      const cohortIds = [...new Set(liveSessions.map((r) => String(r.cohort_id || '')).filter(Boolean))];
      const workingDayIds = [...new Set(liveSessions.map((r) => String(r.working_day_id || '')).filter(Boolean))];
      const timeSlotIds = [...new Set(
        liveSessions.flatMap((r) => [String(r.start_time_slot_id || ''), String(r.end_time_slot_id || '')]).filter(Boolean),
      )];

      const [unitsResult, cohortsResult, daysResult, slotsResult] = await Promise.all([
        unitIds.length ? (admin as any).from('units').select('id, name').in('id', unitIds) : Promise.resolve({ data: [] }),
        cohortIds.length ? (admin as any).from('cohorts').select('id, name').in('id', cohortIds) : Promise.resolve({ data: [] }),
        workingDayIds.length ? (admin as any).from('working_days').select('id, day_of_week, sequence_number').in('id', workingDayIds) : Promise.resolve({ data: [] }),
        timeSlotIds.length ? (admin as any).from('time_slots').select('id, starts_at, ends_at').in('id', timeSlotIds) : Promise.resolve({ data: [] }),
      ]);

      const unitMap = new Map<string, any>((unitsResult.data ?? []).map((r: any) => [String(r.id), r]));
      const cohortMap = new Map<string, any>((cohortsResult.data ?? []).map((r: any) => [String(r.id), r]));
      const dayMap = new Map<string, any>((daysResult.data ?? []).map((r: any) => [String(r.id), r]));
      const slotMap = new Map<string, any>((slotsResult.data ?? []).map((r: any) => [String(r.id), r]));

      for (const raw of liveSessions) {
        const sessionId = String(raw.id || '');
        const allocationId = String(raw.teaching_allocation_id || '');
        const unitId = String(raw.unit_id || '');
        const cohortId = String(raw.cohort_id || '');
        const periodId = String(raw.academic_period_id || '');
        const period = periodMap.get(periodId);
        const alloc = allocMap.get(allocationId) || allocMap.get(`${unitId}:${cohortId}`) || allocMap.get(unitId);
        const day = dayMap.get(String(raw.working_day_id || ''));
        const startSlot = slotMap.get(String(raw.start_time_slot_id || ''));
        const endSlot = slotMap.get(String(raw.end_time_slot_id || ''));
        const unit = unitMap.get(unitId);
        const cohort = cohortMap.get(cohortId);

        const dayStr = day ? String(day.day_of_week || '') : 'Monday';
        const dayOfWeek = normalizeDayOfWeek(dayStr);
        const unitName = String(unit?.name || alloc?.unitName || 'Unit');
        const cohortName = String(cohort?.name || alloc?.cohortName || 'Cohort');

        items.push({
          scheduledSessionId: sessionId,
          teachingAllocationId: allocationId || alloc?.allocationId || '',
          academicPeriodId: periodId || alloc?.academicPeriodId || '',
          academicPeriodName: period?.name || alloc?.academicPeriodName || 'Current Term',
          cohortId,
          cohortName,
          unitId,
          unitName,
          dayOfWeek,
          daySequence: Number(day?.sequence_number || 1),
          startsAt: String(startSlot?.starts_at || '08:00'),
          endsAt: String(endSlot?.ends_at || '10:00'),
          sessionNumber: Number(raw.session_number || 1),
          teachingStartsOn: String(period?.teaching_starts_on || alloc?.teachingStartsOn || ''),
          teachingEndsOn: String(period?.teaching_ends_on || alloc?.teachingEndsOn || ''),
          latestClassSessionId: null,
          latestSessionDate: null,
          latestStatus: null,
        });
      }
    }

    if (items.length > 0) {
      // 4. Resolve multi-cohort names
      const unitPeriodKeys = [...new Set(items.map((i) => `${i.unitId}:${i.academicPeriodId}`).filter(Boolean))];
      const multiCohortMap = new Map<string, string>();

      await Promise.all(
        unitPeriodKeys.map(async (key) => {
          const [uId, pId] = key.split(':');
          try {
            const roster = await getUnifiedUnitRoster({
              supabase: admin,
              unitId: uId,
              academicPeriodId: pId,
            });
            if (roster.joinedCohortName && roster.joinedCohortName !== 'Cohort') {
              multiCohortMap.set(key, roster.joinedCohortName);
            }
          } catch {
            // Ignore failure, retain cohort name
          }
        }),
      );

      for (const item of items) {
        const fullCohortName = multiCohortMap.get(`${item.unitId}:${item.academicPeriodId}`);
        if (fullCohortName) {
          item.cohortName = fullCohortName;
        }
      }

      // 5. Attach latest class sessions from class_sessions
      const sessionIds = items.map((i) => i.scheduledSessionId).filter(Boolean);
      const allAllocIds = [...new Set(items.map((i) => i.teachingAllocationId).filter(Boolean))];
      const allUnitIds = [...new Set(items.map((i) => i.unitId).filter(Boolean))];

      let csQuery = (admin as any)
        .from('class_sessions')
        .select('id, scheduled_session_id, teaching_allocation_id, unit_id, cohort_id, session_date, status')
        .order('session_date', { ascending: false });

      const orParts: string[] = [];
      if (sessionIds.length > 0) orParts.push(`scheduled_session_id.in.(${sessionIds.join(',')})`);
      if (allAllocIds.length > 0) orParts.push(`teaching_allocation_id.in.(${allAllocIds.join(',')})`);
      if (allUnitIds.length > 0) orParts.push(`unit_id.in.(${allUnitIds.join(',')})`);
      if (workspace.trainerId) orParts.push(`trainer_id.eq.${workspace.trainerId}`);
      if (profileId) orParts.push(`opened_by.eq.${profileId}`);

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
    }

    // Sort items by daySequence, then startsAt, then unitName
    items.sort((a, b) => {
      if (a.daySequence !== b.daySequence) return a.daySequence - b.daySequence;
      if (a.startsAt !== b.startsAt) return a.startsAt.localeCompare(b.startsAt);
      return a.unitName.localeCompare(b.unitName);
    });

    return items;
  } catch (err) {
    console.error('resolveTrainerAttendanceSchedule failed:', err);
    return [];
  }
}

export async function getStaffClassAttendanceSchedule(): Promise<ClassAttendanceScheduleItem[]> {
  try {
    const { requireTrainerAccess } = await import('@/features/auth/authorization');
    const profile = await requireTrainerAccess();
    return await resolveTrainerAttendanceSchedule(profile.id);
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

/**
 * Admin-safe version of getStaffClassAttendanceSchedule.
 * Accepts an explicit profileId (the trainer's auth.users id) instead of
 * reading from the session, enabling HOD impersonation in portal-view pages.
 */
export async function getTrainerAttendanceScheduleForAdmin(
  profileId: string,
): Promise<ClassAttendanceScheduleItem[]> {
  return await resolveTrainerAttendanceSchedule(profileId);
}

/**
 * Admin-safe attendance history for a specific trainer, queried by trainerId
 * (trainer table UUID). Uses admin client to bypass RLS.
 * Replaces the session-scoped RPC used by getStaffClassAttendanceHistory.
 */
export async function getTrainerAttendanceHistoryForAdmin(
  trainerId: string,
  limit = 30,
): Promise<ClassAttendanceHistoryItem[]> {
  try {
    const admin = createAdminClient();

    const { data: sessions, error } = await (admin as any)
      .from('class_sessions')
      .select('id, teaching_allocation_id, session_date, status, starts_at, ends_at, unit_id, cohort_id, roster_count')
      .eq('trainer_id', trainerId)
      .order('session_date', { ascending: false })
      .limit(limit);

    if (error || !sessions?.length) return [];

    const unitIds = [...new Set((sessions as any[]).map((r) => String(r.unit_id || '')).filter(Boolean))];
    const cohortIds = [...new Set((sessions as any[]).map((r) => String(r.cohort_id || '')).filter(Boolean))];
    const sessionIds = (sessions as any[]).map((r) => String(r.id)).filter(Boolean);

    const [unitsRes, cohortsRes, entriesRes] = await Promise.all([
      unitIds.length ? (admin as any).from('units').select('id, name').in('id', unitIds) : Promise.resolve({ data: [] }),
      cohortIds.length ? (admin as any).from('cohorts').select('id, name').in('id', cohortIds) : Promise.resolve({ data: [] }),
      sessionIds.length
        ? (admin as any)
            .from('class_attendance_entries')
            .select('class_session_id, attendance_status')
            .in('class_session_id', sessionIds)
        : Promise.resolve({ data: [] }),
    ]);

    const unitMap = new Map<string, string>((unitsRes.data ?? []).map((r: any) => [String(r.id), String(r.name)]));
    const cohortMap = new Map<string, string>((cohortsRes.data ?? []).map((r: any) => [String(r.id), String(r.name)]));

    // Compute present/absent/unmarked counts per session
    const presentMap = new Map<string, number>();
    const absentMap = new Map<string, number>();
    const unmarkedMap = new Map<string, number>();
    for (const entry of entriesRes.data ?? []) {
      const sid = String(entry.class_session_id);
      if (entry.attendance_status === 'present') presentMap.set(sid, (presentMap.get(sid) ?? 0) + 1);
      else if (entry.attendance_status === 'absent') absentMap.set(sid, (absentMap.get(sid) ?? 0) + 1);
      else unmarkedMap.set(sid, (unmarkedMap.get(sid) ?? 0) + 1);
    }

    return (sessions as any[]).map((row): ClassAttendanceHistoryItem | null => {
      const classSessionId = asString(row.id);
      const teachingAllocationId = asString(row.teaching_allocation_id);
      const sessionDate = asString(row.session_date);
      const status = asString(row.status) as ClassSessionStatus | null;
      if (!classSessionId || !teachingAllocationId || !sessionDate || !status) return null;
      return {
        classSessionId,
        teachingAllocationId,
        sessionDate,
        status,
        unitName: unitMap.get(String(row.unit_id)) ?? 'Unit',
        cohortName: cohortMap.get(String(row.cohort_id)) ?? 'Cohort',
        startsAt: asString(row.starts_at) ?? '',
        endsAt: asString(row.ends_at) ?? '',
        rosterCount: asNumber(row.roster_count),
        presentCount: presentMap.get(classSessionId) ?? 0,
        absentCount: absentMap.get(classSessionId) ?? 0,
        unmarkedCount: unmarkedMap.get(classSessionId) ?? 0,
      };
    }).filter((item): item is ClassAttendanceHistoryItem => Boolean(item));
  } catch (err) {
    console.error('getTrainerAttendanceHistoryForAdmin failed:', err);
    return [];
  }
}
