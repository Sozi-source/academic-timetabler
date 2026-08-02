'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type {
  AcademicPeriodActionState,
} from './types';
import {
  academicPeriodFormSchema,
  academicPeriodIdSchema,
  academicPeriodStatusSchema,
} from './validation';

function revalidateAcademicPeriodPages(
  id?: string,
) {
  revalidatePath('/dashboard');
  revalidatePath('/timetable/academic-periods');
  revalidatePath('/timetable/academic-years');

  if (id) {
    revalidatePath(
      `/timetable/academic-periods/${id}/edit`,
    );
  }
}

function getDatabaseErrorMessage(
  code?: string,
  message?: string,
) {
  if (
    message?.includes(
      'parent Academic Year must be active',
    )
  ) {
    return 'Activate the parent Academic Year before activating this period.';
  }

  if (
    message?.includes(
      'must fall within the Academic Year',
    )
  ) {
    return 'The period dates must fall within the selected Academic Year.';
  }

  if (
    message?.includes(
      'Archived Academic Periods cannot be changed',
    )
  ) {
    return 'Archived Academic Periods cannot be changed.';
  }

  if (
    message?.includes(
      'Close the active Academic Period',
    )
  ) {
    return 'Close the active Academic Period before archiving it.';
  }

  switch (code) {
    case '23505':
      return 'This name, code or sequence is already used in the selected Academic Year.';

    case '23P01':
      return 'The dates overlap with another Academic Period in this Academic Year.';

    case '23514':
      return 'The Academic Period does not satisfy the required date or content rules.';

    case '42501':
      return 'You are not authorized to perform this operation.';

    case 'P0002':
      return 'The requested Academic Period was not found.';

    default:
      return 'The Academic Period could not be saved. Please try again.';
  }
}

function parseAcademicPeriodForm(
  formData: FormData,
) {
  return academicPeriodFormSchema.safeParse({
    academicYearId:
      formData.get('academicYearId'),
    name: formData.get('name'),
    code: formData.get('code'),
    sequenceNumber:
      formData.get('sequenceNumber'),
    startsOn: formData.get('startsOn'),
    endsOn: formData.get('endsOn'),
    teachingStartsOn:
      formData.get('teachingStartsOn'),
    teachingEndsOn:
      formData.get('teachingEndsOn'),
    notes:
      formData.get('notes') || undefined,
  });
}

export async function createAcademicPeriodAction(
  _previousState: AcademicPeriodActionState,
  formData: FormData,
): Promise<AcademicPeriodActionState> {
  await requireHodAccess();

  const parsed =
    parseAcademicPeriodForm(formData);

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Review the highlighted fields.',
      fieldErrors:
        parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('academic_periods')
    .insert({
      academic_year_id:
        parsed.data.academicYearId,
      name: parsed.data.name,
      code: parsed.data.code,
      sequence_number:
        parsed.data.sequenceNumber,
      starts_on: parsed.data.startsOn,
      ends_on: parsed.data.endsOn,
      teaching_starts_on:
        parsed.data.teachingStartsOn,
      teaching_ends_on:
        parsed.data.teachingEndsOn,
      notes: parsed.data.notes || null,
      status: 'planned',
    });

  if (error) {
    return {
      status: 'error',
      message: getDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    };
  }

  revalidateAcademicPeriodPages();

  return {
    status: 'success',
    message:
      'Academic Period created successfully.',
  };
}

export async function updateAcademicPeriodAction(
  _previousState: AcademicPeriodActionState,
  formData: FormData,
): Promise<AcademicPeriodActionState> {
  await requireHodAccess();

  const idResult =
    academicPeriodIdSchema.safeParse(
      formData.get('id'),
    );

  if (!idResult.success) {
    return {
      status: 'error',
      message:
        'The Academic Period identifier is invalid.',
    };
  }

  const parsed =
    parseAcademicPeriodForm(formData);

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Review the highlighted fields.',
      fieldErrors:
        parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const {
    data: existingPeriod,
    error: existingError,
  } = await supabase
    .from('academic_periods')
    .select('status')
    .eq('id', idResult.data)
    .maybeSingle();

  if (existingError) {
    return {
      status: 'error',
      message: getDatabaseErrorMessage(
        existingError.code,
        existingError.message,
      ),
    };
  }

  if (!existingPeriod) {
    return {
      status: 'error',
      message:
        'The requested Academic Period was not found.',
    };
  }

  if (existingPeriod.status === 'archived') {
    return {
      status: 'error',
      message:
        'Archived Academic Periods cannot be changed.',
    };
  }

  const { error } = await supabase
    .from('academic_periods')
    .update({
      academic_year_id:
        parsed.data.academicYearId,
      name: parsed.data.name,
      code: parsed.data.code,
      sequence_number:
        parsed.data.sequenceNumber,
      starts_on: parsed.data.startsOn,
      ends_on: parsed.data.endsOn,
      teaching_starts_on:
        parsed.data.teachingStartsOn,
      teaching_ends_on:
        parsed.data.teachingEndsOn,
      notes: parsed.data.notes || null,
    })
    .eq('id', idResult.data);

  if (error) {
    return {
      status: 'error',
      message: getDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    };
  }

  revalidateAcademicPeriodPages(
    idResult.data,
  );

  return {
    status: 'success',
    message:
      'Academic Period updated successfully.',
  };
}

export async function setAcademicPeriodStatusAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const idResult =
    academicPeriodIdSchema.safeParse(
      formData.get('id'),
    );

  const statusResult =
    academicPeriodStatusSchema.safeParse(
      formData.get('status'),
    );

  if (
    !idResult.success ||
    !statusResult.success
  ) {
    throw new Error(
      'Invalid Academic Period status request.',
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc(
    'set_academic_period_status',
    {
      period_id: idResult.data,
      new_status: statusResult.data,
    },
  );

  if (error) {
    throw new Error(
      getDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    );
  }

  revalidateAcademicPeriodPages(
    idResult.data,
  );
}