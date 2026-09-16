'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

export async function batchRegisterExpectedUnits(
  formData: FormData,
) {
  await requireHodAccess();

  const academicPeriodId = formData.get('academicPeriodId');
  const mode = formData.get('mode');
  const cohortId = formData.get('cohortId');

  const studentIds = formData
    .getAll('studentIds')
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.length > 0,
    );

  if (
    typeof academicPeriodId !== 'string' ||
    !academicPeriodId
  ) {
    redirect(
      '/students/unit-registration/batch?error=period',
    );
  }

  if (
    mode !== 'cohort' &&
    mode !== 'selected'
  ) {
    redirect(
      '/students/unit-registration/batch?error=mode',
    );
  }

  if (
    mode === 'cohort' &&
    (typeof cohortId !== 'string' || !cohortId)
  ) {
    redirect(
      '/students/unit-registration/batch?error=cohort',
    );
  }

  if (studentIds.length === 0) {
    redirect(
      '/students/unit-registration/batch?error=students',
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    'batch_register_expected_student_units',
    {
      target_academic_period_id: academicPeriodId,
      target_cohort_id:
        mode === 'cohort' &&
        typeof cohortId === 'string'
          ? cohortId
          : null,
      selected_student_ids: studentIds,
    },
  );

  if (error) {
    redirect(
      `/students/unit-registration/batch?error=${encodeURIComponent(
        error.message,
      )}`,
    );
  }

  const summary =
    data && typeof data === 'object'
      ? data as Record<string, unknown>
      : {};

  const params = new URLSearchParams({
    success: '1',
    selected: String(summary.selected_students ?? 0),
    eligible: String(summary.eligible_students ?? 0),
    created: String(summary.registrations_created ?? 0),
    skipped: String(
      summary.existing_registrations_skipped ?? 0,
    ),
    attention: String(summary.attention_students ?? 0),
  });

  revalidatePath('/students/unit-registration');
  revalidatePath('/students/unit-registration/batch');

  redirect(
    `/students/unit-registration/batch?${params.toString()}`,
  );
}

export async function batchRegisterOverrideUnits(
  formData: FormData,
) {
  await requireHodAccess();

  const academicPeriodId = formData.get('academicPeriodId');
  const studentIds = selectedStudentIds(formData);
  const unitIds = formData
    .getAll('unitIds')
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.length > 0,
    );
  const reasonValue = formData.get('overrideReason');
  const overrideReason =
    typeof reasonValue === 'string'
      ? reasonValue.trim()
      : '';

  if (typeof academicPeriodId !== 'string' || !academicPeriodId) {
    redirect('/students/unit-registration/batch?error=period');
  }

  if (studentIds.length === 0 || unitIds.length === 0) {
    redirect('/students/unit-registration/batch?error=override_selection');
  }

  if (overrideReason.length < 3) {
    redirect('/students/unit-registration/batch?error=override_reason');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    'batch_register_override_units',
    {
      target_academic_period_id: academicPeriodId,
      target_student_ids: studentIds,
      selected_unit_ids: unitIds,
      override_reason: overrideReason,
    },
  );

  if (error) {
    redirect(
      `/students/unit-registration/batch?error=${encodeURIComponent(error.message)}`,
    );
  }

  const summary =
    data && typeof data === 'object'
      ? data as Record<string, unknown>
      : {};

  const params = new URLSearchParams({
    success: '1',
    selected: String(summary.selected_students ?? 0),
    eligible: String(summary.eligible_students ?? 0),
    created: String(summary.registrations_created ?? 0),
    skipped: String(summary.existing_registrations_skipped ?? 0),
    attention: String(summary.attention_students ?? 0),
  });

  revalidatePath('/students/unit-registration');
  revalidatePath('/students/unit-registration/batch');
  revalidatePath('/student/unit-registration');

  redirect(`/students/unit-registration/batch?${params.toString()}`);
}

function selectedStudentIds(formData: FormData): string[] {
  return formData
    .getAll('studentIds')
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.length > 0,
    );
}

export async function confirmReportedStudents(formData: FormData) {
  await requireHodAccess();

  const academicPeriodId = formData.get('academicPeriodId');
  const studentIds = selectedStudentIds(formData);

  if (typeof academicPeriodId !== 'string' || !academicPeriodId) {
    redirect('/students/unit-registration/batch?error=period');
  }

  if (studentIds.length === 0) {
    redirect('/students/unit-registration/batch?error=students');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('confirm_students_reported', {
    target_academic_period_id: academicPeriodId,
    target_student_ids: studentIds,
    reporting_date: new Date().toISOString().slice(0, 10),
  });

  if (error) {
    redirect(
      `/students/unit-registration/batch?error=${encodeURIComponent(error.message)}`,
    );
  }

  const result = data && typeof data === 'object'
    ? data as Record<string, unknown>
    : {};

  revalidatePath('/students');
  revalidatePath('/students/unit-registration');
  revalidatePath('/students/unit-registration/batch');
  revalidatePath('/student/unit-registration');

  redirect(
    `/students/unit-registration/batch?reporting=confirmed&students=${String(result.confirmed_students ?? studentIds.length)}&restored=${String(result.restored_registrations ?? 0)}`,
  );
}

export async function dropUnconfirmedStudentUnits(formData: FormData) {
  await requireHodAccess();

  const academicPeriodId = formData.get('academicPeriodId');
  const studentIds = selectedStudentIds(formData);

  if (typeof academicPeriodId !== 'string' || !academicPeriodId) {
    redirect('/students/unit-registration/batch?error=period');
  }

  if (studentIds.length === 0) {
    redirect('/students/unit-registration/batch?error=students');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    'drop_unconfirmed_student_units',
    {
      target_academic_period_id: academicPeriodId,
      target_student_ids: studentIds,
    },
  );

  if (error) {
    redirect(
      `/students/unit-registration/batch?error=${encodeURIComponent(error.message)}`,
    );
  }

  const result = data && typeof data === 'object'
    ? data as Record<string, unknown>
    : {};

  revalidatePath('/students/unit-registration');
  revalidatePath('/students/unit-registration/batch');
  revalidatePath('/student/unit-registration');

  redirect(
    `/students/unit-registration/batch?reporting=dropped&students=${String(result.affected_students ?? 0)}&registrations=${String(result.dropped_registrations ?? 0)}`,
  );
}
