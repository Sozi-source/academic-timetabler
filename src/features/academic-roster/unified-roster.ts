import { compareAdmissionNumbers } from '@/features/students/admission-number-sort';
import { canonicalizeSharedUnitTitle } from '@/features/teaching-allocations/shared-class-matching';

export interface UnifiedRosterCandidate {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  cohortId: string;
  cohortName: string;
  registrationStatus: 'registered' | 'enrolled';
  attendanceStatus: 'expected' | 'absent';
  reportingStatus?: 'reported' | 'pending' | 'deferred' | 'dropped_out' | 'unreported';
}

export interface UnifiedUnitRoster {
  unitId: string;
  academicPeriodId: string;
  cohortIds: string[];
  cohortNames: string[];
  joinedCohortName: string;
  programmes: Array<{ id: string; name: string; code: string }>;
  joinedProgrammeName: string;
  departmentName: string;
  students: UnifiedRosterCandidate[];
  totalCount: number;
}

interface GetUnifiedUnitRosterParams {
  supabase: any;
  unitId?: string | null;
  academicPeriodId?: string | null;
  allocationId?: string | null;
}

export async function getUnifiedUnitRoster({
  supabase,
  unitId: initialUnitId,
  academicPeriodId: initialPeriodId,
  allocationId,
}: GetUnifiedUnitRosterParams): Promise<UnifiedUnitRoster> {
  let unitId = initialUnitId;
  let academicPeriodId = initialPeriodId;
  let allocationCohortId: string | null = null;
  let allocationParticipantCohortIds: string[] = [];

  // 1. Resolve allocation details if allocationId provided
  let allocationTeachingOfferingId: string | null = null;

  if (allocationId) {
    const { data: alloc } = await supabase
      .from('teaching_allocations')
      .select('id, unit_id, academic_period_id, cohort_id, participant_cohort_ids, teaching_offering_id')
      .eq('id', allocationId)
      .maybeSingle();

    if (alloc) {
      if (!unitId) unitId = alloc.unit_id;
      if (!academicPeriodId) academicPeriodId = alloc.academic_period_id;
      allocationCohortId = alloc.cohort_id;
      allocationTeachingOfferingId = alloc.teaching_offering_id || null;
      if (Array.isArray(alloc.participant_cohort_ids)) {
        allocationParticipantCohortIds = alloc.participant_cohort_ids.filter(Boolean);
      }
    }
  }

  if (!unitId || !academicPeriodId) {
    return {
      unitId: unitId || '',
      academicPeriodId: academicPeriodId || '',
      cohortIds: [],
      cohortNames: [],
      joinedCohortName: 'Cohort',
      programmes: [],
      joinedProgrammeName: 'Programme',
      departmentName: 'Department',
      students: [],
      totalCount: 0,
    };
  }

  // 2. Discover all equivalent / shared unit IDs in this academic period
  const cohortIdSet = new Set<string>();
  if (allocationCohortId) cohortIdSet.add(allocationCohortId);
  for (const cid of allocationParticipantCohortIds) cohortIdSet.add(cid);

  const relatedUnitIdSet = new Set<string>();
  if (unitId) relatedUnitIdSet.add(unitId);

  let sharedOfferingId = allocationTeachingOfferingId;

  // If no sharedOfferingId from allocation, check if unit_offerings has confirmed_shared_offering_id
  if (!sharedOfferingId) {
    try {
      const { data: directOfferings } = await supabase
        .from('unit_offerings')
        .select('confirmed_shared_offering_id')
        .eq('academic_period_id', academicPeriodId)
        .eq('unit_id', unitId)
        .not('confirmed_shared_offering_id', 'is', null);

      for (const off of directOfferings ?? []) {
        if (off?.confirmed_shared_offering_id) {
          sharedOfferingId = off.confirmed_shared_offering_id;
          break;
        }
      }
    } catch {
      // Ignore if table/query is unavailable in test mocks
    }
  }

  // If we have a sharedOfferingId, fetch all units and cohorts belonging to this shared offering
  if (sharedOfferingId) {
    try {
      const { data: sharedOfferings } = await supabase
        .from('unit_offerings')
        .select('unit_id, cohort_id')
        .eq('academic_period_id', academicPeriodId)
        .eq('confirmed_shared_offering_id', sharedOfferingId);

      for (const off of sharedOfferings ?? []) {
        if (off?.unit_id) relatedUnitIdSet.add(off.unit_id);
        if (off?.cohort_id) cohortIdSet.add(off.cohort_id);
      }
    } catch {
      // Ignore if unavailable in test mocks
    }
  }

  // Also check if any participant cohorts have unit offerings with matching canonical unit title
  const participantCohorts = Array.from(cohortIdSet);
  if (participantCohorts.length > 0) {
    try {
      const { data: unitData } = await supabase
        .from('units')
        .select('name')
        .eq('id', unitId)
        .maybeSingle();

      if (unitData?.name) {
        const canonicalTitle = canonicalizeSharedUnitTitle(unitData.name);
        const { data: cohortOfferings } = await supabase
          .from('unit_offerings')
          .select('unit_id, cohort_id, units(name)')
          .eq('academic_period_id', academicPeriodId)
          .in('cohort_id', participantCohorts);

        for (const off of cohortOfferings ?? []) {
          const u = Array.isArray(off?.units) ? off.units[0] : off?.units;
          if (u?.name && canonicalizeSharedUnitTitle(u.name) === canonicalTitle) {
            if (off?.unit_id) relatedUnitIdSet.add(off.unit_id);
            if (off?.cohort_id) cohortIdSet.add(off.cohort_id);
          }
        }
      }
    } catch {
      // Ignore if unavailable in test mocks
    }
  }

  const allUnitIds = Array.from(relatedUnitIdSet);

  // 3. Discover all offerings, allocations, and verified registrations across related units
  const offeringsQuery = supabase
    .from('unit_offerings')
    .select('cohort_id')
    .eq('academic_period_id', academicPeriodId);

  const allocsQuery = supabase
    .from('teaching_allocations')
    .select('cohort_id, participant_cohort_ids')
    .eq('academic_period_id', academicPeriodId);

  const regQuery = supabase
    .from('student_unit_registrations')
    .select(`
      student_id,
      cohort_id,
      registration_status,
      student:students(id, admission_number, full_name, current_cohort_id, lifecycle_status)
    `)
    .eq('academic_period_id', academicPeriodId)
    .eq('registration_status', 'registered');

  const [
    { data: offerings },
    { data: otherAllocs },
    { data: registrations },
  ] = await Promise.all([
    allUnitIds.length === 1 ? offeringsQuery.eq('unit_id', allUnitIds[0]) : offeringsQuery.in('unit_id', allUnitIds),
    allUnitIds.length === 1 ? allocsQuery.eq('unit_id', allUnitIds[0]) : allocsQuery.in('unit_id', allUnitIds),
    allUnitIds.length === 1 ? regQuery.eq('unit_id', allUnitIds[0]) : regQuery.in('unit_id', allUnitIds),
  ]);

  for (const off of offerings ?? []) {
    if (off.cohort_id) cohortIdSet.add(off.cohort_id);
  }

  for (const alloc of otherAllocs ?? []) {
    if (alloc.cohort_id) cohortIdSet.add(alloc.cohort_id);
    if (Array.isArray(alloc.participant_cohort_ids)) {
      for (const cid of alloc.participant_cohort_ids) {
        if (cid) cohortIdSet.add(cid);
      }
    }
  }

  for (const reg of registrations ?? []) {
    if (reg.cohort_id) cohortIdSet.add(reg.cohort_id);
    const st = Array.isArray(reg.student) ? reg.student[0] : reg.student;
    if (st?.current_cohort_id) cohortIdSet.add(st.current_cohort_id);
  }

  const allCohortIds = Array.from(cohortIdSet);

  // 3. Query details of all resolved cohorts
  const cohortMap = new Map<string, {
    id: string;
    name: string;
    code: string;
    programme?: { id: string; name: string; code: string; department?: { id: string; name: string } | null } | null;
  }>();

  if (allCohortIds.length > 0) {
    const { data: cohortRecords } = await supabase
      .from('cohorts')
      .select(`
        id,
        name,
        code,
        programme:programmes(
          id,
          name,
          code,
          department:departments(id, name)
        )
      `)
      .in('id', allCohortIds);

    for (const c of cohortRecords ?? []) {
      const prog = Array.isArray(c.programme) ? c.programme[0] : c.programme;
      const dept = prog && Array.isArray(prog.department) ? prog.department[0] : prog?.department;
      cohortMap.set(c.id, {
        id: c.id,
        name: c.name,
        code: c.code,
        programme: prog ? {
          id: prog.id,
          name: prog.name,
          code: prog.code,
          department: dept ? { id: dept.id, name: dept.name } : null,
        } : null,
      });
    }
  }

  // Build cohort names list and programmes list
  const sortedCohorts = Array.from(cohortMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const cohortNames = sortedCohorts.map((c) => c.name);
  const joinedCohortName = cohortNames.length > 0 ? cohortNames.join(' / ') : 'Cohort';

  const programmeMap = new Map<string, { id: string; name: string; code: string }>();
  let departmentName = '';

  for (const c of sortedCohorts) {
    if (c.programme) {
      programmeMap.set(c.programme.id, {
        id: c.programme.id,
        name: c.programme.name,
        code: c.programme.code,
      });
      if (c.programme.department?.name && !departmentName) {
        departmentName = c.programme.department.name;
      }
    }
  }

  const programmes = Array.from(programmeMap.values());
  const joinedProgrammeName = programmes.length > 0
    ? programmes.map((p) => p.name).join(' / ')
    : 'Programme';

  // 4. Populate candidates strictly from verified unit registrations
  // Students must be explicitly registered for this unit; merely belonging to a cohort
  // sharing the timetable slot does not place an unregistered student on the roster.
  const candidateMap = new Map<string, UnifiedRosterCandidate>();

  for (const reg of registrations ?? []) {
    const st = Array.isArray(reg.student) ? reg.student[0] : reg.student;
    if (!st?.id) continue;
    if (st.lifecycle_status && !['admitted', 'active'].includes(st.lifecycle_status)) continue;

    const cohortId = reg.cohort_id || st.current_cohort_id || '';
    const cohortInfo = cohortMap.get(cohortId);

    candidateMap.set(st.id, {
      studentId: st.id,
      admissionNumber: st.admission_number ?? '—',
      fullName: st.full_name ?? 'Student',
      cohortId,
      cohortName: cohortInfo?.name ?? 'Cohort',
      registrationStatus: 'registered',
      attendanceStatus: 'expected',
    });
  }

  // 5. Attach student reporting status from student_period_reporting
  const allCandidateStudentIds = Array.from(candidateMap.keys());
  if (allCandidateStudentIds.length > 0 && academicPeriodId) {
    try {
      const { data: reportingRecords } = await supabase
        .from('student_period_reporting')
        .select('student_id, reporting_status')
        .eq('academic_period_id', academicPeriodId)
        .in('student_id', allCandidateStudentIds);

      const reportingMap = new Map<string, 'reported' | 'pending' | 'deferred' | 'dropped_out' | 'unreported'>();
      for (const r of reportingRecords ?? []) {
        if (r.student_id) {
          reportingMap.set(r.student_id, (r.reporting_status || 'pending') as any);
        }
      }

      for (const [sId, cand] of candidateMap.entries()) {
        cand.reportingStatus = reportingMap.get(sId) || 'unreported';
      }
    } catch (repErr) {
      console.warn('Could not load student_period_reporting for unified roster:', repErr);
    }
  }

  // 6. Sort naturally by cohort first, then by admission number within each cohort
  const students = Array.from(candidateMap.values()).sort((a, b) => {
    const cohortComparison = (a.cohortName || '').localeCompare(b.cohortName || '');
    if (cohortComparison !== 0) return cohortComparison;
    return compareAdmissionNumbers(a.admissionNumber, b.admissionNumber);
  });

  return {
    unitId,
    academicPeriodId,
    cohortIds: allCohortIds,
    cohortNames,
    joinedCohortName,
    programmes,
    joinedProgrammeName,
    departmentName: departmentName || 'Department',
    students,
    totalCount: students.length,
  };
}
