'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type {
  BatchStudentActionState,
  StudentProgressionActionState,
  UpdateAdmissionNumberActionState,
} from './types';
import {
  batchReassignStudentCohortSchema,
  batchUpdateStudentStatusSchema,
  studentProgressionSchema,
  updateAdmissionNumberSchema,
} from './validation';
import { inferStudentAdmissionNumber } from './admission-number';

function optionalText(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function progressionError(message?: string) {
  if (message?.includes('Only an HOD') || message?.includes('42501')) return 'You do not have permission to update this student.';
  if (message?.includes('Student not found') || message?.includes('P0002')) return 'Student record not found.';
  if (message?.includes('Invalid target status')) return 'Select a valid student status.';
  return 'The student status could not be saved.';
}

export async function recordStudentProgressionAction(
  _previousState: StudentProgressionActionState,
  formData: FormData,
): Promise<StudentProgressionActionState> {
  await requireHodAccess();

  const parsed = studentProgressionSchema.safeParse({
    studentId: formData.get('studentId'),
    eventType: formData.get('eventType'),
    effectiveDate: new Date().toISOString().slice(0, 10),
    targetStatus: formData.get('targetStatus'),
    academicPlacement: formData.get('academicPlacement'),
    reportingStatus: formData.get('reportingStatus'),
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Select a valid student status.', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const lifecycleResult = await supabase.rpc('set_student_status', {
    target_student_id: parsed.data.studentId,
    target_status: parsed.data.targetStatus,
  });
  if (lifecycleResult.error) return { status: 'error', message: progressionError(lifecycleResult.error.message) };

  const placementResult = await supabase.rpc('set_student_status', {
    target_student_id: parsed.data.studentId,
    target_status: parsed.data.academicPlacement,
  });
  if (placementResult.error) return { status: 'error', message: progressionError(placementResult.error.message) };

  const reportingResult = await supabase.rpc('set_student_status', {
    target_student_id: parsed.data.studentId,
    target_status: parsed.data.reportingStatus,
  });
  if (reportingResult.error) return { status: 'error', message: progressionError(reportingResult.error.message) };

  revalidatePath('/students');
  revalidatePath('/students/registry');
  revalidatePath('/students/progression');
  revalidatePath('/students/unit-registration');
  revalidatePath(`/students/registry/${parsed.data.studentId}`);
  return { status: 'success', message: 'Student status updated.' };
}

function admissionNumberError(message?: string) {
  if (!message) return 'The admission number could not be updated.';
  if (message.includes('already exists') || message.includes('23505')) {
    return 'This admission number already exists in this department.';
  }
  if (message.includes('cannot manage') || message.includes('42501')) {
    return 'You do not have permission to modify students in this department.';
  }
  if (message.includes('Student not found') || message.includes('P0002')) {
    return 'Student record not found.';
  }
  if (message.includes('between 3 and 80 characters')) {
    return 'Admission number must be between 3 and 80 characters.';
  }
  return message;
}

export async function updateStudentAdmissionNumberAction(
  _previousState: UpdateAdmissionNumberActionState,
  formData: FormData,
): Promise<UpdateAdmissionNumberActionState> {
  const profile = await requireHodAccess();

  const parsed = updateAdmissionNumberSchema.safeParse({
    studentId: formData.get('studentId'),
    admissionNumber: formData.get('admissionNumber'),
    reason: optionalText(formData, 'reason'),
    notes: optionalText(formData, 'notes'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Review the highlighted admission number fields.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const cleanAdmission = parsed.data.admissionNumber;
  const inference = inferStudentAdmissionNumber(cleanAdmission);
  const supabase = await createClient();

  // 1. Fetch current student record
  const { data: student, error: fetchErr } = await supabase
    .from('students')
    .select('id, department_id, admission_number, programme_id, admission_cohort_id, current_cohort_id')
    .eq('id', parsed.data.studentId)
    .single();

  if (fetchErr || !student) {
    return { status: 'error', message: 'Student record not found.' };
  }

  if (profile.role !== 'system_admin' && profile.activeDepartmentId && student.department_id !== profile.activeDepartmentId) {
    return { status: 'error', message: 'You cannot manage students in this department.' };
  }

  // 2. Resolve new programme & cohort if inference indicates a programme
  let newProgrammeId: string | undefined;
  let newCohortId: string | undefined;

  if (inference.programmeCode) {
    const { data: matchedProg } = await supabase
      .from('programmes')
      .select('id, code, name')
      .eq('department_id', student.department_id)
      .ilike('code', inference.programmeCode)
      .maybeSingle();

    if (matchedProg) {
      newProgrammeId = matchedProg.id;

      const { data: progCohorts } = await supabase
        .from('cohorts')
        .select('id, code, name, intake_date')
        .eq('programme_id', matchedProg.id);

      if (progCohorts && progCohorts.length > 0) {
        const matchedCohort = progCohorts.find((c) => {
          const normName = c.name.toUpperCase().replace(/\s+/g, ' ');
          const normCode = c.code.toUpperCase().replace(/\s+/g, ' ');
          if (inference.suggestedCohortCode && (normName === inference.suggestedCohortCode.toUpperCase() || normCode === inference.suggestedCohortCode.toUpperCase())) {
            return true;
          }
          if (inference.intakeLabel && inference.admissionYear) {
            const shortYear = String(inference.admissionYear).slice(-2);
            return (
              normCode.includes(inference.intakeLabel) &&
              (normCode.includes(String(inference.admissionYear)) || normCode.includes(shortYear))
            );
          }
          return false;
        });

        if (matchedCohort) {
          newCohortId = matchedCohort.id;
        }
      }
    }
  }

  // If unchanged and no programme/cohort changes needed
  if (
    cleanAdmission === student.admission_number &&
    (!newProgrammeId || newProgrammeId === student.programme_id) &&
    (!newCohortId || newCohortId === student.admission_cohort_id)
  ) {
    return {
      status: 'success',
      message: 'Admission number is unchanged.',
      newAdmissionNumber: cleanAdmission,
    };
  }

  // 3. Check for duplicate admission number in department
  const { data: duplicate } = await supabase
    .from('students')
    .select('id')
    .eq('department_id', student.department_id)
    .ilike('admission_number', cleanAdmission)
    .neq('id', student.id)
    .maybeSingle();

  if (duplicate) {
    return { status: 'error', message: `Admission number "${cleanAdmission}" is already in use in this department.` };
  }

  // 4. Try database RPC if available
  const { error } = await supabase.rpc('update_student_admission_number', {
    target_student_id: parsed.data.studentId,
    new_admission_number: cleanAdmission,
    correction_reason: parsed.data.reason ?? null,
    correction_notes: parsed.data.notes ?? null,
    new_inference: inference,
    new_programme_id: newProgrammeId ?? null,
    new_cohort_id: newCohortId ?? null,
  });

  const isRpcMissing =
    error &&
    (error.code === 'PGRST202' ||
      error.message?.includes('schema cache') ||
      error.message?.includes('does not exist') ||
      error.message?.includes('Could not find the function'));

  if (error && !isRpcMissing) {
    return { status: 'error', message: admissionNumberError(error.message) };
  }

  // If RPC was missing or not yet migrated, perform direct update with identical safety
  if (isRpcMissing) {
    const updatePayload: Record<string, unknown> = {
      admission_number: cleanAdmission,
      admission_number_inference: inference,
      updated_at: new Date().toISOString(),
    };

    if (newProgrammeId && newProgrammeId !== student.programme_id) {
      updatePayload.programme_id = newProgrammeId;
    }
    if (newCohortId && newCohortId !== student.admission_cohort_id) {
      updatePayload.admission_cohort_id = newCohortId;
      updatePayload.current_cohort_id = newCohortId;
    }

    const { error: updErr } = await supabase
      .from('students')
      .update(updatePayload)
      .eq('id', student.id);

    if (updErr) return { status: 'error', message: updErr.message };

    // Keep open cohort assignments consistent with the updated programme & cohort
    if (newCohortId) {
      await supabase
        .from('student_cohort_assignments')
        .update({
          cohort_id: newCohortId,
          assignment_reason: 'Updated with admission number correction',
        })
        .eq('student_id', student.id)
        .is('effective_to', null);
    }

    await supabase.from('student_lifecycle_events').insert({
      student_id: student.id,
      event_type: 'administrative_correction',
      effective_date: new Date().toISOString().slice(0, 10),
      reason: parsed.data.reason ?? `Admission number corrected from ${student.admission_number} to ${cleanAdmission}`,
      notes: parsed.data.notes ?? `Admission number changed from "${student.admission_number}" to "${cleanAdmission}".`,
    });
  }

  revalidatePath('/students');
  revalidatePath('/students/registry');
  revalidatePath('/students/progression');
  revalidatePath(`/students/registry/${parsed.data.studentId}`);
  revalidatePath('/students/access');
  revalidatePath('/students/unit-registration');

  return {
    status: 'success',
    message: `Admission number updated to ${cleanAdmission}.`,
    newAdmissionNumber: cleanAdmission,
  };
}

export async function batchUpdateStudentStatusAction(
  _previousState: BatchStudentActionState,
  formData: FormData,
): Promise<BatchStudentActionState> {
  await requireHodAccess();
  const studentIds = formData.getAll('studentIds').filter((v): v is string => typeof v === 'string' && v.length > 0);
  const parsed = batchUpdateStudentStatusSchema.safeParse({
    studentIds,
    status: formData.get('status'),
    effectiveDate: formData.get('effectiveDate') || new Date().toISOString().slice(0, 10),
  });
  if (!parsed.success) return { status: 'error', message: 'Select a valid student status.', fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  for (const studentId of parsed.data.studentIds) {
    const { error } = await supabase.rpc('set_student_status', {
      target_student_id: studentId,
      target_status: parsed.data.status,
      effective_date: parsed.data.effectiveDate,
    });
    if (error) return { status: 'error', message: error.message };
  }

  revalidatePath('/students');
  revalidatePath('/students/registry');
  revalidatePath('/students/progression');
  revalidatePath('/students/unit-registration');
  return { status: 'success', message: `${parsed.data.studentIds.length} student(s) updated successfully.` };
}

export async function batchReassignStudentCohortAction(
  _previousState: BatchStudentActionState,
  formData: FormData,
): Promise<BatchStudentActionState> {
  await requireHodAccess();

  const studentIds = formData
    .getAll('studentIds')
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  const targetCohortId = formData.get('targetCohortId');
  const effectiveDate = formData.get('effectiveDate') || new Date().toISOString().slice(0, 10);
  const reason = optionalText(formData, 'reason');
  const notes = optionalText(formData, 'notes');

  const parsed = batchReassignStudentCohortSchema.safeParse({
    studentIds,
    targetCohortId,
    effectiveDate,
    reason,
    notes,
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please resolve the validation errors.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'batch_reassign_student_cohort',
    {
      target_student_ids: parsed.data.studentIds,
      new_cohort_id: parsed.data.targetCohortId,
      effective_date: parsed.data.effectiveDate,
      reason: parsed.data.reason ?? 'Cohort reassignment (repeat/progression)',
      notes: parsed.data.notes ?? null,
    },
  );

  let reassignedCount = parsed.data.studentIds.length;

  if (rpcError) {
    if (rpcError.code === 'PGRST202' || rpcError.message.includes('batch_reassign_student_cohort')) {
      // Direct fallback
      const { data: cohort } = await supabase
        .from('cohorts')
        .select('id, name, expected_completion_date')
        .eq('id', parsed.data.targetCohortId)
        .single();

      if (!cohort) return { status: 'error', message: 'Target cohort not found.' };

      const { data: students } = await supabase
        .from('students')
        .select('id, current_cohort_id')
        .in('id', parsed.data.studentIds);

      for (const st of students ?? []) {
        if (st.current_cohort_id === cohort.id) continue;

        // Close open assignment
        await supabase
          .from('student_cohort_assignments')
          .update({
            effective_to: parsed.data.effectiveDate,
          })
          .eq('student_id', st.id)
          .is('effective_to', null);

        // Insert new assignment
        await supabase.from('student_cohort_assignments').insert({
          student_id: st.id,
          cohort_id: cohort.id,
          effective_from: parsed.data.effectiveDate,
          is_admission_cohort: false,
          assignment_reason: parsed.data.reason ?? 'Cohort reassignment (repeat/progression)',
          notes: parsed.data.notes ?? null,
        });

        // Update student
        await supabase
          .from('students')
          .update({
            current_cohort_id: cohort.id,
            projected_completion_date: cohort.expected_completion_date,
            updated_at: new Date().toISOString(),
          })
          .eq('id', st.id);

        // Audit event
        await supabase.from('student_lifecycle_events').insert({
          student_id: st.id,
          event_type: 'cohort_change',
          effective_date: parsed.data.effectiveDate,
          reason: parsed.data.reason ?? `Reassigned to ${cohort.name}`,
          notes: parsed.data.notes ?? null,
          from_cohort_id: st.current_cohort_id,
          to_cohort_id: cohort.id,
        });
      }
    } else {
      return { status: 'error', message: rpcError.message };
    }
  } else if (rpcData && typeof rpcData === 'object' && 'reassigned_count' in rpcData) {
    reassignedCount = Number(rpcData.reassigned_count) || reassignedCount;
  }

  revalidatePath('/students');
  revalidatePath('/students/registry');
  revalidatePath('/students/progression');
  revalidatePath('/students/unit-registration');

  return {
    status: 'success',
    message: `${reassignedCount} student${reassignedCount === 1 ? '' : 's'} reassigned to new cohort successfully.`,
    updatedCount: reassignedCount,
  };
}


