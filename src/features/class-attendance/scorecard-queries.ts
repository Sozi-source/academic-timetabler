import 'server-only';

import { attendanceRate, getAttendanceStanding } from '@/features/attendance-analytics/domain';
import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  AttendanceScorecardCohortOption,
  AttendanceScorecardUnitColumn,
  StudentAttendanceScorecardData,
  StudentAttendanceScorecardItem,
  StudentUnitAttendanceScore,
} from './scorecard-types';

export async function getDepartmentStudentAttendanceScorecard(
  academicPeriodIdParam?: string,
): Promise<StudentAttendanceScorecardData> {
  const profile = await requireHodAccess();
  const admin = createAdminClient();

  // 1. Resolve Academic Period
  let periodQuery = admin
    .from('academic_periods')
    .select('id, name, code, status');

  if (academicPeriodIdParam) {
    periodQuery = periodQuery.eq('id', academicPeriodIdParam);
  } else {
    periodQuery = periodQuery.eq('status', 'active').order('starts_on', { ascending: false }).limit(1);
  }

  const { data: periodResult } = await periodQuery.maybeSingle();
  let period = periodResult;

  if (!period) {
    const { data: latestPeriod } = await admin
      .from('academic_periods')
      .select('id, name, code, status')
      .order('starts_on', { ascending: false })
      .limit(1)
      .maybeSingle();
    period = latestPeriod;
  }

  if (!period) {
    return {
      academicPeriodId: '',
      academicPeriodName: 'No Academic Period',
      students: [],
      cohorts: [],
      allUnits: [],
      stats: {
        totalStudents: 0,
        averageAttendanceRate: 0,
        goodStandingCount: 0,
        borderlineCount: 0,
        atRiskCount: 0,
        unrecordedCount: 0,
      },
    };
  }

  // 2. Query all active in-class students for this department
  let studentQuery = admin
    .from('students')
    .select(`
      id,
      admission_number,
      full_name,
      current_cohort_id,
      academic_phase,
      lifecycle_status,
      cohort:cohorts!students_current_cohort_id_fkey (
        id,
        name,
        code,
        programme:programmes!cohorts_programme_id_fkey (
          id,
          code,
          name,
          department_id
        )
      )
    `)
    .in('lifecycle_status', ['admitted', 'active']);

  if (profile.activeDepartmentId) {
    studentQuery = studentQuery.eq('department_id', profile.activeDepartmentId);
  }

  const { data: rawStudents, error: studentError } = await studentQuery.order('admission_number', { ascending: true });
  if (studentError) {
    throw new Error(`Unable to load student attendance scorecard: ${studentError.message}`);
  }

  // Filter out any student on attachment or internship or suspended/deferred
  const validStudents = (rawStudents ?? []).filter((s) => {
    if (!s?.id) return false;
    const lifecycle = (s.lifecycle_status || '').toLowerCase();
    if (['suspended', 'deferred', 'dropped_out', 'completed', 'graduated'].includes(lifecycle)) return false;
    const phase = (s.academic_phase || '').toLowerCase();
    if (phase && phase !== 'in_class') return false;
    return true;
  });

  const studentIds = validStudents.map((s) => s.id);
  if (studentIds.length === 0) {
    return {
      academicPeriodId: period.id,
      academicPeriodName: period.name,
      students: [],
      cohorts: [],
      allUnits: [],
      stats: {
        totalStudents: 0,
        averageAttendanceRate: 0,
        goodStandingCount: 0,
        borderlineCount: 0,
        atRiskCount: 0,
        unrecordedCount: 0,
      },
    };
  }

  // 3. Query verified unit registrations for these students in this period
  const { data: rawRegistrations } = await admin
    .from('student_unit_registrations')
    .select(`
      student_id,
      unit_id,
      unit:units!student_unit_registrations_unit_id_fkey (
        id,
        code,
        name
      )
    `)
    .eq('academic_period_id', period.id)
    .eq('registration_status', 'registered')
    .in('student_id', studentIds);

  const studentRegisteredUnits = new Map<string, Map<string, { unitId: string; unitCode: string; unitName: string }>>();
  const allUnitsMap = new Map<string, AttendanceScorecardUnitColumn>();

  for (const reg of rawRegistrations ?? []) {
    const u = Array.isArray(reg.unit) ? reg.unit[0] : reg.unit;
    if (!u?.id) continue;
    allUnitsMap.set(u.id, { id: u.id, code: u.code || 'UNIT', name: u.name || 'Unit' });

    if (!studentRegisteredUnits.has(reg.student_id)) {
      studentRegisteredUnits.set(reg.student_id, new Map());
    }
    studentRegisteredUnits.get(reg.student_id)!.set(u.id, {
      unitId: u.id,
      unitCode: u.code || 'UNIT',
      unitName: u.name || 'Unit',
    });
  }

  // 4. Query attendance aggregates for this period
  const { data: sessionRows } = await admin
    .from('class_sessions')
    .select('id, unit_id, status')
    .eq('academic_period_id', period.id)
    .in('status', ['completed', 'open']);

  const sessionUnitMap = new Map<string, string>();
  const activeSessionIds: string[] = [];
  for (const sess of sessionRows ?? []) {
    sessionUnitMap.set(sess.id, sess.unit_id);
    activeSessionIds.push(sess.id);
  }

  // Map of `${student_id}:${unit_id}` -> { sessions: Set<string>; present: number; absent: number }
  const studentUnitAttendanceStats = new Map<string, { sessions: Set<string>; present: number; absent: number }>();

  if (activeSessionIds.length > 0) {
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < studentIds.length; i += CHUNK_SIZE) {
      const chunk = studentIds.slice(i, i + CHUNK_SIZE);
      const { data: entries } = await admin
        .from('class_attendance_entries')
        .select('class_session_id, student_id, attendance_status')
        .in('student_id', chunk)
        .in('class_session_id', activeSessionIds)
        .in('attendance_status', ['present', 'absent', 'late']);

      for (const entry of entries ?? []) {
        const uId = sessionUnitMap.get(entry.class_session_id);
        if (!uId) continue;
        const key = `${entry.student_id}:${uId}`;
        if (!studentUnitAttendanceStats.has(key)) {
          studentUnitAttendanceStats.set(key, { sessions: new Set(), present: 0, absent: 0 });
        }
        const stat = studentUnitAttendanceStats.get(key)!;
        stat.sessions.add(entry.class_session_id);
        if (entry.attendance_status === 'present' || entry.attendance_status === 'late') {
          stat.present++;
        } else if (entry.attendance_status === 'absent') {
          stat.absent++;
        }
      }
    }
  }

  // 5. Build final student scorecard rows
  const cohortStudentCountMap = new Map<string, AttendanceScorecardCohortOption>();
  let sumOfRates = 0;
  let countOfRatedStudents = 0;
  let goodCount = 0;
  let borderlineCount = 0;
  let atRiskCount = 0;
  let unrecordedCount = 0;

  const scorecardStudents: StudentAttendanceScorecardItem[] = [];

  for (const st of validStudents) {
    const cohort = Array.isArray(st.cohort) ? st.cohort[0] : st.cohort;
    const prog = cohort && (Array.isArray(cohort.programme) ? cohort.programme[0] : cohort.programme);
    const cohortId = cohort?.id || st.current_cohort_id || 'unknown';
    const cohortName = cohort?.name || 'Cohort';
    const cohortCode = cohort?.code || 'COHORT';

    if (!cohortStudentCountMap.has(cohortId)) {
      cohortStudentCountMap.set(cohortId, { id: cohortId, name: cohortName, code: cohortCode, studentCount: 0 });
    }
    cohortStudentCountMap.get(cohortId)!.studentCount++;

    const registeredUnitsMap = studentRegisteredUnits.get(st.id) ?? new Map();
    const unitScores: StudentUnitAttendanceScore[] = [];

    let totalStudentCompleted = 0;
    let totalStudentPresent = 0;
    let totalStudentAbsent = 0;

    for (const [uId, uInfo] of registeredUnitsMap.entries()) {
      const key = `${st.id}:${uId}`;
      const stat = studentUnitAttendanceStats.get(key);
      const completedSessions = stat ? stat.sessions.size : 0;
      const present = stat ? stat.present : 0;
      const absent = stat ? stat.absent : 0;
      const marked = present + absent;
      const rate = attendanceRate({ present, absent });

      totalStudentCompleted += completedSessions;
      totalStudentPresent += present;
      totalStudentAbsent += absent;

      unitScores.push({
        unitId: uId,
        unitCode: uInfo.unitCode,
        unitName: uInfo.unitName,
        completedSessions,
        presentCount: present,
        absentCount: absent,
        attendanceRate: rate,
      });
    }

    unitScores.sort((a, b) => a.unitCode.localeCompare(b.unitCode));

    const totalMarked = totalStudentPresent + totalStudentAbsent;
    const overallScore = totalMarked > 0 ? attendanceRate({ present: totalStudentPresent, absent: totalStudentAbsent }) : null;
    const standing = getAttendanceStanding(overallScore);

    if (overallScore !== null) {
      sumOfRates += overallScore;
      countOfRatedStudents++;
      if (standing === 'good') goodCount++;
      else if (standing === 'borderline') borderlineCount++;
      else if (standing === 'at_risk') atRiskCount++;
    } else {
      unrecordedCount++;
    }

    scorecardStudents.push({
      studentId: st.id,
      admissionNumber: st.admission_number || '—',
      fullName: st.full_name || 'Student',
      cohortId,
      cohortName,
      programmeCode: prog?.code || '',
      programmeName: prog?.name || '',
      units: unitScores,
      totalCompletedSessions: totalStudentCompleted,
      totalPresent: totalStudentPresent,
      totalAbsent: totalStudentAbsent,
      overallScore,
      standing,
    });
  }

  scorecardStudents.sort((a, b) => {
    const cComp = a.cohortName.localeCompare(b.cohortName);
    if (cComp !== 0) return cComp;
    return a.admissionNumber.localeCompare(b.admissionNumber, undefined, { numeric: true, sensitivity: 'base' });
  });

  const averageAttendanceRate = countOfRatedStudents > 0 ? Math.round((sumOfRates / countOfRatedStudents) * 10) / 10 : 0;
  const sortedCohorts = Array.from(cohortStudentCountMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const sortedUnits = Array.from(allUnitsMap.values()).sort((a, b) => a.code.localeCompare(b.code));

  return {
    academicPeriodId: period.id,
    academicPeriodName: period.name,
    students: scorecardStudents,
    cohorts: sortedCohorts,
    allUnits: sortedUnits,
    stats: {
      totalStudents: scorecardStudents.length,
      averageAttendanceRate,
      goodStandingCount: goodCount,
      borderlineCount: borderlineCount,
      atRiskCount: atRiskCount,
      unrecordedCount: unrecordedCount,
    },
  };
}
