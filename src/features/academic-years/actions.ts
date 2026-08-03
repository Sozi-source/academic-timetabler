'use server';

import {
  revalidatePath,
} from 'next/cache';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

import type {
  AcademicYearActionState,
} from './types';
import {
  academicYearFormSchema,
  academicYearIdSchema,
  academicYearStatusSchema,
} from './validation';

function revalidateAcademicYearPages() {
  revalidatePath('/dashboard');

  revalidatePath(
    '/timetable/academic-years',
  );

  revalidatePath(
    '/timetable/academic-periods',
  );

  revalidatePath(
    '/timetable/cohorts',
  );
}

function getDatabaseErrorMessage(
  code?: string,
  message?: string,
) {
  switch (code) {
    case '23505':
      return 'An Academic Year with this name already exists.';

    case '23P01':
      return 'The dates overlap another Academic Year.';

    case '23514':
      return 'The Academic Year does not satisfy the required rules.';

    case '42501':
      return 'You are not authorized to perform this operation.';

    case 'P0002':
      return 'The Academic Year was not found.';

    case '22023':
      return 'The selected status is invalid.';

    default:
      return (
        message ??
        'The Academic Year could not be saved.'
      );
  }
}

export async function createAcademicYearAction(
  _previousState:
    AcademicYearActionState,
  formData: FormData,
): Promise<AcademicYearActionState> {
  await requireHodAccess();

  const parsed =
    academicYearFormSchema.safeParse({
      name: formData.get('name'),

      startsOn:
        formData.get('startsOn'),

      endsOn:
        formData.get('endsOn'),

      notes:
        formData.get('notes') ||
        undefined,
    });

  if (!parsed.success) {
    return {
      status: 'error',
      message:
        'Review the highlighted fields.',
      fieldErrors:
        parsed.error.flatten()
          .fieldErrors,
    };
  }

  const supabase =
    await createClient();

  const { error } = await supabase
    .from('academic_years')
    .insert({
      name: parsed.data.name,

      starts_on:
        parsed.data.startsOn,

      ends_on:
        parsed.data.endsOn,

      notes:
        parsed.data.notes || null,

      status: 'planned',
    });

  if (error) {
    return {
      status: 'error',

      message:
        getDatabaseErrorMessage(
          error.code,
          error.message,
        ),
    };
  }

  revalidateAcademicYearPages();

  return {
    status: 'success',
    message:
      'Academic Year created.',
  };
}

export async function updateAcademicYearAction(
  _previousState:
    AcademicYearActionState,
  formData: FormData,
): Promise<AcademicYearActionState> {
  await requireHodAccess();

  const idResult =
    academicYearIdSchema.safeParse(
      formData.get('id'),
    );

  const formResult =
    academicYearFormSchema.safeParse({
      name: formData.get('name'),

      startsOn:
        formData.get('startsOn'),

      endsOn:
        formData.get('endsOn'),

      notes:
        formData.get('notes') ||
        undefined,
    });

  if (!idResult.success) {
    return {
      status: 'error',
      message:
        'Invalid Academic Year.',
    };
  }

  if (!formResult.success) {
    return {
      status: 'error',
      message:
        'Review the highlighted fields.',
      fieldErrors:
        formResult.error.flatten()
          .fieldErrors,
    };
  }

  const supabase =
    await createClient();

  const { error } = await supabase
    .from('academic_years')
    .update({
      name: formResult.data.name,

      starts_on:
        formResult.data.startsOn,

      ends_on:
        formResult.data.endsOn,

      notes:
        formResult.data.notes ||
        null,
    })
    .eq('id', idResult.data);

  if (error) {
    return {
      status: 'error',

      message:
        getDatabaseErrorMessage(
          error.code,
          error.message,
        ),
    };
  }

  revalidateAcademicYearPages();

  return {
    status: 'success',
    message:
      'Academic Year updated.',
  };
}

export async function setAcademicYearStatusAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const idResult =
    academicYearIdSchema.safeParse(
      formData.get('id'),
    );

  const statusResult =
    academicYearStatusSchema.safeParse(
      formData.get('status'),
    );

  if (
    !idResult.success ||
    !statusResult.success
  ) {
    throw new Error(
      'Invalid Academic Year status request.',
    );
  }

  const supabase =
    await createClient();

  const { error } =
    await supabase.rpc(
      'set_academic_year_status',
      {
        p_academic_year_id:
          idResult.data,

        p_status:
          statusResult.data,
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

  revalidateAcademicYearPages();
}