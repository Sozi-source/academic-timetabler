import { notFound } from 'next/navigation';

import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import { AssessmentUnitCohorts } from '@/features/assessment/assessment-unit-cohorts';

interface PageProps {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ periodId?: string | string[] }>;
}

type Relation<T> = T | T[] | null;
function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function AssessmentUnitPage({ params, searchParams }: PageProps) {
  const profile = await requireHodAccess();
  const [{ unitId }, query] = await Promise.all([params, searchParams]);
  if (!profile.activeDepartmentId) notFound();

  const periodId = typeof query.periodId === 'string' ? query.periodId : null;
  if (!periodId) notFound();

  const admin = createAdminClient();
  const [unitResult, periodResult] = await Promise.all([
    admin.from('units')
      .select('id,code,name,programme:programmes!inner(department_id)')
      .eq('id', unitId)
      .eq('programme.department_id', profile.activeDepartmentId)
      .maybeSingle(),
    admin.from('academic_periods')
      .select('id,name')
      .eq('id', periodId)
      .maybeSingle<{ id: string; name: string }>(),
  ]);
  if (unitResult.error || periodResult.error) throw new Error('Unable to load this unit roster.');
  if (!unitResult.data || !periodResult.data) notFound();

  const { data: equivalenceRows, error: equivalenceError } = await admin
    .from('unit_equivalence_members')
    .select('equivalence_group_id,group:unit_equivalence_groups!inner(id,canonical_name,status,department_id)')
    .eq('unit_id', unitId)
    .eq('status', 'approved');
  if (equivalenceError) throw new Error('Unable to load approved unit equivalences.');
  const approvedGroup = (equivalenceRows ?? []).map((row) => ({
    id: row.equivalence_group_id,
    group: one(row.group as Relation<{ id: string; canonical_name: string; status: string; department_id: string | null }>),
  })).find(({ group }) => group?.status === 'active' && (!group.department_id || group.department_id === profile.activeDepartmentId));
  let equivalentUnitIds = [unitId];
  let canonicalUnitName = unitResult.data.name;
  if (approvedGroup?.group) {
    canonicalUnitName = approvedGroup.group.canonical_name;
    const { data: members, error: membersError } = await admin
      .from('unit_equivalence_members')
      .select('unit_id,unit:units!inner(programme:programmes!inner(department_id))')
      .eq('equivalence_group_id', approvedGroup.id)
      .eq('status', 'approved')
      .eq('unit.programme.department_id', profile.activeDepartmentId);
    if (membersError) throw new Error('Unable to load equivalent unit members.');
    equivalentUnitIds = [...new Set((members ?? []).map((member) => member.unit_id))];
  }

  const [eventResult, registrationRows] = await Promise.all([
    admin.from('assessment_events')
      .select('id,unit_id,cohort_id,assessment_type,title')
      .eq('department_id', profile.activeDepartmentId)
      .eq('academic_period_id', periodId)
      .in('unit_id', equivalentUnitIds)
      .eq('title', 'Unit Markbook')
      .order('created_at', { ascending: true }),
    (async () => {
      const rows: Array<{
        unit_id: string;
        student_id: string;
        cohort_id: string;
        student: Relation<{ id: string; admission_number: string; full_name: string }>;
        cohort: Relation<{ id: string; code: string | null; name: string }>;
      }> = [];
      const pageSize = 1000;
      let offset = 0;
      while (true) {
        const { data, error } = await admin.from('student_unit_registrations')
          .select('unit_id,student_id,cohort_id,student:students!inner(id,admission_number,full_name),cohort:cohorts!inner(id,code,name)')
          .eq('academic_period_id', periodId)
          .in('unit_id', equivalentUnitIds)
          .eq('registration_status', 'registered')
          .order('cohort_id', { ascending: true })
          .order('student_id', { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) throw new Error(`Unable to load current registrations: ${error.message}`);
        if (!data?.length) break;
        rows.push(...data);
        if (data.length < pageSize) break;
        offset += pageSize;
      }
      return rows;
    })(),
  ]);

  if (eventResult.error) throw new Error('Unable to load cohort markbooks.');
  if (!eventResult.data?.length) notFound();
  const unit = unitResult.data;
  const studentsByCohort = new Map<string, { id: string; code: string; name: string; unitIds: Set<string>; students: Array<{ id: string; admissionNumber: string; fullName: string }> }>();
  for (const row of registrationRows) {
    const student = one(row.student);
    const cohort = one(row.cohort);
    if (!student || !cohort) continue;
    if (!studentsByCohort.has(row.cohort_id)) {
      studentsByCohort.set(row.cohort_id, {
        id: cohort.id,
        code: cohort.code ?? '',
        name: cohort.name,
        unitIds: new Set<string>(),
        students: [],
      });
    }
    const cohortRoster = studentsByCohort.get(row.cohort_id);
    cohortRoster?.unitIds.add(row.unit_id);
    if (cohortRoster && !cohortRoster.students.some((existing) => existing.id === student.id)) {
      cohortRoster.students.push({
        id: student.id,
        admissionNumber: student.admission_number,
        fullName: student.full_name,
      });
    }
  }

  const cohorts = [...studentsByCohort.values()]
    .map((cohort) => ({
      ...cohort,
      students: cohort.students.sort((first, second) => first.admissionNumber.localeCompare(second.admissionNumber, undefined, { numeric: true })),
      markbooks: (eventResult.data ?? [])
        .filter((event) => cohort.unitIds.has(event.unit_id) && (event.cohort_id === cohort.id || event.cohort_id === null))
        .map((event) => ({ id: event.id, assessmentType: event.assessment_type })),
    }))
    .sort((first, second) => first.name.localeCompare(second.name));

  return (
    <AssessmentUnitCohorts
      unit={{ id: unit.id, code: unit.code, name: canonicalUnitName }}
      periodName={periodResult.data.name}
      periodId={periodId}
      cohorts={cohorts}
    />
  );
}
