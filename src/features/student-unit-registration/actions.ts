'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

export async function verifyStudentUnitRegistration(formData: FormData) {
  await requireHodAccess();
  const submissionId = formData.get('submissionId');
  if (typeof submissionId !== 'string') return;

  const noteValue = formData.get('verificationNote');
  const note = typeof noteValue === 'string' ? noteValue.trim() : '';
  const supabase = await createClient();

  const { error } = await supabase.rpc('verify_student_unit_registration', {
    target_submission_id: submissionId,
    decision_note: note || null,
  });

  if (error) throw new Error(`Verification failed: ${error.message}`);
  revalidatePath('/students/unit-registration');
}

export async function returnStudentUnitRegistration(formData: FormData) {
  await requireHodAccess();
  const submissionId = formData.get('submissionId');
  const noteValue = formData.get('verificationNote');
  const note = typeof noteValue === 'string' ? noteValue.trim() : '';
  if (typeof submissionId !== 'string' || note.length < 3) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc('return_student_unit_registration', {
    target_submission_id: submissionId,
    decision_note: note,
  });

  if (error) throw new Error(`Return failed: ${error.message}`);
  revalidatePath('/students/unit-registration');
}


export async function registerStudentUnitsByDepartment(formData: FormData) {
  await requireHodAccess();

  const studentId = formData.get('studentId');
  const academicPeriodId = formData.get('academicPeriodId');
  const unitIds = formData
    .getAll('unitIds')
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const noteValue = formData.get('registrationNote');
  const note = typeof noteValue === 'string' ? noteValue.trim() : '';

  if (typeof studentId !== 'string' || typeof academicPeriodId !== 'string') {
    redirect('/students/unit-registration?error=invalid');
  }

  if (unitIds.length === 0) {
    redirect(`/students/unit-registration/register/${studentId}?error=units`);
  }

  const supabase = await createClient();

  const { data: stageContext } = await supabase
    .from('students')
    .select('current_stage_id, current_cohort:cohorts!students_current_cohort_id_fkey(current_stage_id)')
    .eq('id', studentId)
    .maybeSingle();

  const cohort = Array.isArray(stageContext?.current_cohort)
    ? stageContext.current_cohort[0]
    : stageContext?.current_cohort;
  const stageId = stageContext?.current_stage_id || cohort?.current_stage_id || null;
  const { data: stageUnits } = stageId
    ? await supabase
        .from('programme_stage_units')
        .select('unit_id')
        .eq('stage_id', stageId)
    : { data: [] };
  const expectedUnitIds = new Set((stageUnits ?? []).map((unit) => unit.unit_id));
  const hasOverride = !stageId || unitIds.some((unitId) => !expectedUnitIds.has(unitId));

  if (hasOverride && note.length < 3) {
    redirect(`/students/unit-registration/register/${studentId}?error=${encodeURIComponent('Provide a reason for additional or cross-stage units.')}`);
  }

  // Ensure every selected unit has an active unit offering in this period for registration validity
  const { data: student } = await supabase
    .from('students')
    .select('current_cohort_id, programme_id')
    .eq('id', studentId)
    .single();

  if (student?.current_cohort_id) {
    const { data: existingOfferings } = await supabase
      .from('unit_offerings')
      .select('unit_id')
      .eq('academic_period_id', academicPeriodId)
      .in('unit_id', unitIds)
      .eq('selection_state', 'included')
      .neq('status', 'cancelled');

    const offeredSet = new Set((existingOfferings ?? []).map((o) => o.unit_id));
    const missingUnitIds = unitIds.filter((id) => !offeredSet.has(id));

    if (missingUnitIds.length > 0) {
      for (const missingId of missingUnitIds) {
        await supabase
          .from('unit_offerings')
          .insert({
            academic_period_id: academicPeriodId,
            cohort_id: student.current_cohort_id,
            unit_id: missingId,
            selection_state: 'included',
            status: 'active',
            offering_type: 'classroom',
            origin: 'special',
            exception_reason: 'Department unit offering',
            is_timetable_enabled: true,
            weekly_sessions: 2,
            session_duration_minutes: 120,
          });
      }
    }
  }

  const { error } = await supabase.rpc('department_register_student_units', {
    target_student_id: studentId,
    target_academic_period_id: academicPeriodId,
    selected_unit_ids: unitIds,
    supplied_note: note || 'Department authorized registration',
  });

  if (error) {
    redirect(
      `/students/unit-registration/register/${studentId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/students/unit-registration');
  revalidatePath(`/students/unit-registration/register/${studentId}`);
  redirect(`/students/unit-registration/register/${studentId}?saved=1`);
}


export async function setStudentProgrammeStage(formData: FormData) {
  await requireHodAccess();

  const studentId = formData.get('studentId');
  const stageId = formData.get('stageId');

  if (typeof studentId !== 'string' || typeof stageId !== 'string' || !stageId) {
    redirect('/students/unit-registration?error=stage');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_student_programme_stage', {
    target_student_id: studentId,
    target_stage_id: stageId,
  });

  if (error) {
    redirect(`/students/unit-registration/register/${studentId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/students/unit-registration');
  revalidatePath(`/students/unit-registration/register/${studentId}`);
  redirect(`/students/unit-registration/register/${studentId}?stage_updated=1`);
}

export async function createProgrammeStage(formData: FormData) {
  await requireHodAccess();

  const programmeId = formData.get('programmeId');
  const stageNumberValue = formData.get('stageNumber');
  const stageNameValue = formData.get('stageName');
  const stageNumber = Number(stageNumberValue);
  const stageName = typeof stageNameValue === 'string' ? stageNameValue.trim() : '';

  if (typeof programmeId !== 'string' || !Number.isInteger(stageNumber) || stageNumber < 1) {
    redirect('/students/unit-registration/stages?error=stage');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_programme_stage', {
    target_programme_id: programmeId,
    supplied_stage_number: stageNumber,
    supplied_name: stageName || null,
  });

  if (error) redirect(`/students/unit-registration/stages?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/students/unit-registration/stages');
  redirect('/students/unit-registration/stages');
}

export async function saveProgrammeStageUnits(formData: FormData) {
  await requireHodAccess();

  const stageId = formData.get('stageId');
  const unitIds = formData
    .getAll('unitIds')
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  if (typeof stageId !== 'string') redirect('/students/unit-registration/stages?error=stage');

  const supabase = await createClient();
  const { error } = await supabase.rpc('save_programme_stage_units', {
    target_stage_id: stageId,
    selected_unit_ids: unitIds,
  });

  if (error) redirect(`/students/unit-registration/stages?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/students/unit-registration/stages');
  redirect('/students/unit-registration/stages');
}


export async function generateStandardProgrammeStages(formData: FormData) {
  await requireHodAccess();

  const programmeId = formData.get('programmeId');

  if (typeof programmeId !== 'string' || !programmeId) {
    redirect('/students/unit-registration/stages?error=programme');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('generate_standard_programme_stages', {
    target_programme_id: programmeId,
  });

  if (error) {
    redirect(
      `/students/unit-registration/stages?programme=${encodeURIComponent(programmeId)}&error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/students/unit-registration/stages');
  redirect(`/students/unit-registration/stages?programme=${encodeURIComponent(programmeId)}&generated=1`);
}
