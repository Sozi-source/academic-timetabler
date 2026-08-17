import { createAdminClient } from '@/lib/supabase/admin';

import type { StudentPortalRegistrationContext, StudentPortalUnit } from './types';

export async function getStudentPortalRegistrationContext(
  studentId: string,
): Promise<StudentPortalRegistrationContext | null> {
  const admin = createAdminClient();

  const { data: student, error: studentError } = await admin
    .from('students')
    .select(`
      id,
      admission_number,
      full_name,
      current_cohort_id,
      programme_id,
      programme:programmes!students_programme_id_fkey(code, name),
      department:departments!students_department_id_fkey(name),
      current_cohort:cohorts!students_current_cohort_id_fkey(id, name, current_academic_period_number)
    `)
    .eq('id', studentId)
    .maybeSingle();

  if (studentError) throw new Error(`Unable to load student: ${studentError.message}`);
  if (!student || !student.current_cohort_id) return null;

  const programme = Array.isArray(student.programme) ? student.programme[0] : student.programme;
  const department = Array.isArray(student.department) ? student.department[0] : student.department;
  const cohort = Array.isArray(student.current_cohort) ? student.current_cohort[0] : student.current_cohort;
  if (!programme || !department || !cohort) return null;

  const { data: period, error: periodError } = await admin
    .from('academic_periods')
    .select('id, code, name')
    .eq('status', 'active')
    .maybeSingle();
  if (periodError) throw new Error(`Unable to load active period: ${periodError.message}`);

  if (!period) {
    return {
      student: {
        id: student.id,
        admissionNumber: student.admission_number,
        fullName: student.full_name,
        programmeName: programme.name,
        programmeCode: programme.code,
        departmentName: department.name,
        cohortId: cohort.id,
        cohortName: cohort.name,
        academicPeriodNumber: cohort.current_academic_period_number,
      },
      period: null,
      submission: null,
      units: [],
    };
  }

  const [{ data: offerings, error: offeringError }, { data: submission, error: submissionError }] = await Promise.all([
    admin
      .from('unit_offerings')
      .select(`
        id,
        cohort_id,
        unit_id,
        unit:units!unit_offerings_unit_id_fkey(code, name, programme_id)
      `)
      .eq('academic_period_id', period.id)
      .eq('selection_state', 'included')
      .neq('status', 'cancelled'),
    admin
      .from('student_unit_registration_submissions')
      .select('id, status, has_exception, exception_reason, verification_note, submitted_at, verified_at')
      .eq('student_id', student.id)
      .eq('academic_period_id', period.id)
      .maybeSingle(),
  ]);

  if (offeringError) throw new Error(`Unable to load units: ${offeringError.message}`);
  if (submissionError) throw new Error(`Unable to load registration: ${submissionError.message}`);

  let selectedUnitIds = new Set<string>();
  if (submission) {
    const { data: registrations, error: registrationError } = await admin
      .from('student_unit_registrations')
      .select('unit_id')
      .eq('submission_id', submission.id)
      .eq('registration_status', 'registered');
    if (registrationError) throw new Error(`Unable to load selected units: ${registrationError.message}`);
    selectedUnitIds = new Set((registrations ?? []).map((row) => row.unit_id));
  }

  const unique = new Map<string, StudentPortalUnit>();
  for (const offering of offerings ?? []) {
    const unit = Array.isArray(offering.unit) ? offering.unit[0] : offering.unit;
    if (!unit || unit.programme_id !== student.programme_id) continue;
    const expected = offering.cohort_id === student.current_cohort_id;
    const existing = unique.get(offering.unit_id);
    if (!existing || (expected && !existing.expected)) {
      unique.set(offering.unit_id, {
        offeringId: offering.id,
        unitId: offering.unit_id,
        unitCode: unit.code,
        unitName: unit.name,
        expected,
        selected: submission ? selectedUnitIds.has(offering.unit_id) : expected,
      });
    }
  }

  return {
    student: {
      id: student.id,
      admissionNumber: student.admission_number,
      fullName: student.full_name,
      programmeName: programme.name,
      programmeCode: programme.code,
      departmentName: department.name,
      cohortId: cohort.id,
      cohortName: cohort.name,
      academicPeriodNumber: cohort.current_academic_period_number,
    },
    period: { id: period.id, code: period.code, name: period.name },
    submission: submission
      ? {
          id: submission.id,
          status: submission.status,
          hasException: submission.has_exception,
          exceptionReason: submission.exception_reason,
          verificationNote: submission.verification_note,
          submittedAt: submission.submitted_at,
          verifiedAt: submission.verified_at,
        }
      : null,
    units: [...unique.values()].sort((a, b) => a.unitCode.localeCompare(b.unitCode)),
  };
}
