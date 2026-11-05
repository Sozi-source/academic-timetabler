import { UsersRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { FastTab } from '@/components/ui/fast-tab';
import { requireHodAccess } from '@/features/auth/authorization';
import { deactivateStudentClassAssignment } from '@/features/students/class-assignment-actions';
import { StudentClassAssignmentForm, type StudentClassAssignmentOption } from '@/features/students/student-class-assignment-form';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type SearchParams = Promise<{ error?: string; saved?: string; removed?: string }>;

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function StudentClassAssignmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: SearchParams;
}) {
  const profile = await requireHodAccess();
  const [{ studentId }, query, supabase] = await Promise.all([params, searchParams, createClient()]);
  let studentQuery = createAdminClient()
    .from('students')
    .select('id, department_id, full_name, admission_number, current_cohort:cohorts!students_current_cohort_id_fkey(name)')
    .eq('id', studentId);

  if (profile.role !== 'system_admin') {
    if (!profile.activeDepartmentId) {
      return <p className="p-6 text-sm text-text-secondary">Select the department you manage, then reload this page.</p>;
    }
    const { data: canManageDepartment, error: accessError } = await supabase.rpc(
      'current_user_can_manage_department',
      { requested_department: profile.activeDepartmentId },
    );
    if (accessError) throw new Error(`Unable to verify department access: ${accessError.message}`);
    if (!canManageDepartment) {
      return <p className="p-6 text-sm text-text-secondary">You do not have management access to the active department.</p>;
    }
    studentQuery = studentQuery.eq('department_id', profile.activeDepartmentId);
  }

  const [{ data: student, error: studentError }, { data: periods }, { data: registrations }] = await Promise.all([
    studentQuery.maybeSingle(),
    supabase.from('academic_periods').select('id, name, code').eq('status', 'active'),
    supabase
      .from('student_unit_registrations')
      .select('id, academic_period_id, unit:units(id, code, name), period:academic_periods(name, code)')
      .eq('student_id', studentId)
      .eq('registration_status', 'registered'),
  ]);
  if (studentError) throw new Error(`Unable to load student: ${studentError.message}`);
  if (!student) return <p className="p-6 text-sm text-text-secondary">Student not found.</p>;
  const activePeriodIds = (periods ?? []).map((period) => period.id);
  const eligibleRegistrations = (registrations ?? []).filter((registration) => activePeriodIds.includes(registration.academic_period_id));
  const registrationUnits = eligibleRegistrations
    .map((registration) => relation(registration.unit))
    .filter((unit): unit is NonNullable<typeof unit> & { id: string } => Boolean(unit?.id));
  const registrationUnitIds = [...new Set(registrationUnits.map((unit) => unit.id))];
  const [{ data: sourceMembers }, { data: assignments }] = activePeriodIds.length
    ? await Promise.all([
        registrationUnitIds.length
          ? supabase.from('unit_equivalence_members').select('unit_id, equivalence_group_id').in('unit_id', registrationUnitIds).eq('status', 'approved')
          : Promise.resolve({ data: [] }),
        supabase
          .from('student_class_assignments')
          .select('id, source_registration_id, teaching_allocation_id, reason, created_at, registration:student_unit_registrations!inner(unit:units(code, name), period:academic_periods(name, code)), allocation:teaching_allocations!inner(unit:units(code, name), cohort:cohorts(name))')
          .eq('student_id', studentId)
          .eq('is_active', true),
      ])
    : [{ data: [] }, { data: [] }];

  const equivalenceGroupIds = [...new Set((sourceMembers ?? []).map((member) => member.equivalence_group_id))];
  const { data: equivalentMembers } = equivalenceGroupIds.length
    ? await supabase.from('unit_equivalence_members').select('unit_id, equivalence_group_id').in('equivalence_group_id', equivalenceGroupIds).eq('status', 'approved')
    : { data: [] };
  const equivalentUnitIdsBySource = new Map<string, Set<string>>();
  for (const unitId of registrationUnitIds) equivalentUnitIdsBySource.set(unitId, new Set([unitId]));
  for (const member of sourceMembers ?? []) {
    const targetIds = equivalentUnitIdsBySource.get(member.unit_id);
    if (targetIds) {
      for (const equivalent of equivalentMembers ?? []) {
        if (equivalent.equivalence_group_id === member.equivalence_group_id) targetIds.add(equivalent.unit_id);
      }
    }
  }

  const allEquivalentUnitIds = [...new Set([...equivalentUnitIdsBySource.values()].flatMap((unitIds) => [...unitIds]))];
  const { data: allocations } = activePeriodIds.length && allEquivalentUnitIds.length
    ? await supabase
        .from('teaching_allocations')
        .select('id, academic_period_id, unit_id, unit:units(code, name), cohort:cohorts(name)')
        .in('academic_period_id', activePeriodIds)
        .in('unit_id', allEquivalentUnitIds)
        .eq('status', 'active')
    : { data: [] };

  const registrationOptions: StudentClassAssignmentOption[] = eligibleRegistrations.map((registration) => {
    const unit = relation(registration.unit);
    const period = relation(registration.period);
    return { id: registration.id, label: `${unit?.code ?? 'Unit'} · ${unit?.name ?? 'Unit'} — ${period?.name ?? period?.code ?? 'Period'}` };
  });
  const allocationsByRegistration: Record<string, StudentClassAssignmentOption[]> = {};
  const activeAssignmentKeys = new Set((assignments ?? []).map(
    (assignment) => `${assignment.source_registration_id}:${assignment.teaching_allocation_id}`,
  ));
  for (const registration of eligibleRegistrations) {
    const unit = relation(registration.unit);
    const matchingUnitIds = equivalentUnitIdsBySource.get(unit?.id ?? '') ?? new Set<string>();
    allocationsByRegistration[registration.id] = (allocations ?? [])
      .filter((allocation) => allocation.academic_period_id === registration.academic_period_id && matchingUnitIds.has(allocation.unit_id))
      .map((allocation) => {
        const targetUnit = relation(allocation.unit);
        const targetCohort = relation(allocation.cohort);
        const alreadyAssigned = activeAssignmentKeys.has(`${registration.id}:${allocation.id}`);
        return {
          id: allocation.id,
          label: `${targetUnit?.code ?? 'Unit'} · ${targetUnit?.name ?? 'Unit'} — ${targetCohort?.name ?? 'Cohort'}${alreadyAssigned ? ' (already assigned)' : ''}`,
          disabled: alreadyAssigned,
        };
      });
  }

  const activeCount = assignments?.length ?? 0;
  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-3.5 shadow-2xs">
        <p className="text-xs leading-5 text-text-secondary">
          Assign the student to an existing class for an approved equivalent unit. This affects attendance, CAT, and exam rosters only.
        </p>
        <Badge variant="neutral">Cohort &amp; timetable stay unchanged</Badge>
      </Card>

      {query.error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-subtle px-3.5 py-2.5 text-xs font-semibold text-danger"
        >
          Assignment failed:{' '}
          {query.error === 'duplicate'
            ? 'This student is already assigned to this class for this unit.'
            : query.error}
        </p>
      ) : null}
      {query.saved ? (
        <p
          role="status"
          className="rounded-lg border border-primary/20 bg-primary-soft px-3.5 py-2.5 text-xs font-semibold text-primary-deep"
        >
          Assignment saved.
        </p>
      ) : null}
      {query.removed ? (
        <p
          role="status"
          className="rounded-lg border border-primary/20 bg-primary-soft px-3.5 py-2.5 text-xs font-semibold text-primary-deep"
        >
          Assignment removed.
        </p>
      ) : null}

      <FastTab
        title="Add a class assignment"
        summary={`${eligibleRegistrations.length} eligible unit${eligibleRegistrations.length === 1 ? '' : 's'}`}
      >
        {eligibleRegistrations.length ? (
          <StudentClassAssignmentForm
            studentId={studentId}
            registrations={registrationOptions}
            allocationsByRegistration={allocationsByRegistration}
          />
        ) : (
          <p className="text-xs text-text-secondary">
            No registered units in an active period.
          </p>
        )}
      </FastTab>

      <FastTab
        title="Current assignments"
        summary={`${activeCount} active assignment${activeCount === 1 ? '' : 's'}`}
      >
        {!assignments?.length ? (
          <div className="flex items-center gap-2 py-2 text-xs text-text-muted">
            <UsersRound className="size-4 text-text-subtle" />
            <span>No assignments yet.</span>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {assignments.map((assignment) => {
              const source = relation(assignment.registration);
              const sourceUnit = relation(source?.unit);
              const target = relation(assignment.allocation);
              const targetUnit = relation(target?.unit);
              const targetCohort = relation(target?.cohort);
              return (
                <li
                  key={assignment.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-xs font-semibold text-text-primary">
                      {sourceUnit?.name} → {targetUnit?.name} · {targetCohort?.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {assignment.reason}
                    </p>
                  </div>
                  <form action={deactivateStudentClassAssignment}>
                    <input type="hidden" name="studentId" value={studentId} />
                    <input
                      type="hidden"
                      name="assignmentId"
                      value={assignment.id}
                    />
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center justify-center rounded-md border border-border-strong bg-surface px-2.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
                    >
                      Remove
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </FastTab>
    </div>
  );
}
