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
  const { error } = await supabase.rpc('department_register_student_units', {
    target_student_id: studentId,
    target_academic_period_id: academicPeriodId,
    selected_unit_ids: unitIds,
    supplied_note: note || null,
  });

  if (error) {
    redirect(
      `/students/unit-registration/register/${studentId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/students/unit-registration');
  revalidatePath(`/students/unit-registration/register/${studentId}`);
  redirect('/students/unit-registration?registered=1');
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
  redirect(`/students/unit-registration/register/${studentId}`);
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
