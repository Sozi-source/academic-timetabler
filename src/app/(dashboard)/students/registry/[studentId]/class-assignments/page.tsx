import Link from 'next/link';
import { ArrowLeft, UsersRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { requireHodAccess } from '@/features/auth/authorization';
import { addStudentClassAssignment, deactivateStudentClassAssignment } from '@/features/students/class-assignment-actions';
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
      .select('id, academic_period_id, unit:units(code, name), period:academic_periods(name, code)')
      .eq('student_id', studentId)
      .eq('registration_status', 'registered'),
  ]);
  if (studentError) throw new Error(`Unable to load student: ${studentError.message}`);
  if (!student) return <p className="p-6 text-sm text-text-secondary">Student not found.</p>;
  const activePeriodIds = (periods ?? []).map((period) => period.id);
  const eligibleRegistrations = (registrations ?? []).filter((registration) => activePeriodIds.includes(registration.academic_period_id));
  const [{ data: allocations }, { data: assignments }] = activePeriodIds.length
    ? await Promise.all([
        supabase
          .from('teaching_allocations')
          .select('id, academic_period_id, unit:units(code, name), cohort:cohorts(name)')
          .in('academic_period_id', activePeriodIds)
          .eq('status', 'active'),
        supabase
          .from('student_class_assignments')
          .select('id, source_registration_id, teaching_allocation_id, reason, created_at, registration:student_unit_registrations!inner(unit:units(code, name), period:academic_periods(name, code)), allocation:teaching_allocations!inner(unit:units(code, name), cohort:cohorts(name))')
          .eq('student_id', studentId)
          .eq('is_active', true),
      ])
    : [{ data: [] }, { data: [] }];

  const cohort = relation(student.current_cohort);
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <Link href={`/students/registry/${studentId}`} className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary">
        <ArrowLeft className="size-4" /> Student profile
      </Link>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Individual class assignments</p>
            <h1 className="mt-1 text-xl font-bold text-text-primary">{student.full_name}</h1>
            <p className="mt-1 text-sm text-text-secondary">{student.admission_number} · Home cohort: {cohort?.name ?? 'Not assigned'}</p>
          </div>
          <Badge variant="neutral">Does not change cohort or timetable</Badge>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-text-secondary">Assign this student to an existing class for an approved equivalent unit. Only this student is added to the class and its attendance, CAT, and exam rosters.</p>
      </Card>

      {query.error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Assignment could not be saved: {query.error}</p> : null}
      {query.saved ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Class assignment saved.</p> : null}
      {query.removed ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Class assignment removed.</p> : null}

      <Card className="p-5">
        <h2 className="font-semibold text-text-primary">Add a class assignment</h2>
        {eligibleRegistrations.length && allocations?.length ? (
          <form action={addStudentClassAssignment} className="mt-4 grid gap-3 md:grid-cols-2">
            <input type="hidden" name="studentId" value={studentId} />
            <label className="grid gap-1 text-sm font-medium text-text-secondary">Student&apos;s registered unit
              <select required name="registrationId" className="h-10 rounded-lg border border-border bg-surface px-3 text-text-primary">
                {eligibleRegistrations.map((registration) => {
                  const unit = relation(registration.unit);
                  const period = relation(registration.period);
                  return <option key={registration.id} value={registration.id}>{unit?.code} · {unit?.name} — {period?.name ?? period?.code}</option>;
                })}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-text-secondary">Existing target class
              <select required name="allocationId" className="h-10 rounded-lg border border-border bg-surface px-3 text-text-primary">
                {allocations.map((allocation) => {
                  const unit = relation(allocation.unit);
                  const targetCohort = relation(allocation.cohort);
                  return <option key={allocation.id} value={allocation.id}>{unit?.code} · {unit?.name} — {targetCohort?.name}</option>;
                })}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-text-secondary md:col-span-2">Reason
              <input required minLength={3} maxLength={500} name="reason" placeholder="For example: resuming deferred units with the current delivery cohort" className="h-10 rounded-lg border border-border bg-surface px-3 text-text-primary" />
            </label>
            <button className="h-10 w-fit rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover">Add student to class</button>
          </form>
        ) : <p className="mt-3 text-sm text-text-secondary">This student needs active unit registrations and the department needs an active period with existing class allocations.</p>}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border p-4"><UsersRound className="size-4 text-primary" /><h2 className="font-semibold text-text-primary">Current assignments</h2></div>
        {!assignments?.length ? <p className="p-5 text-sm text-text-secondary">No individual class assignments yet.</p> : (
          <ul className="divide-y divide-border">
            {assignments.map((assignment) => {
              const source = relation(assignment.registration);
              const sourceUnit = relation(source?.unit);
              const target = relation(assignment.allocation);
              const targetUnit = relation(target?.unit);
              const targetCohort = relation(target?.cohort);
              return <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div><p className="text-sm font-semibold text-text-primary">{sourceUnit?.name} → {targetUnit?.name} · {targetCohort?.name}</p><p className="mt-1 text-xs text-text-muted">{assignment.reason}</p></div>
                <form action={deactivateStudentClassAssignment}><input type="hidden" name="studentId" value={studentId} /><input type="hidden" name="assignmentId" value={assignment.id} /><button className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-subtle">Remove</button></form>
              </li>;
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
