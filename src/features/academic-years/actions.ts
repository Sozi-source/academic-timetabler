'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type {
  AcademicYearActionState,
  AcademicYearStatus,
} from './types';
import {
  academicYearFormSchema,
  academicYearIdSchema,
  academicYearStatusSchema,
} from './validation';

function revalidateAcademicYearPages() {
  revalidatePath('/dashboard');
  revalidatePath('/timetable/academic-years');
}

function getDatabaseErrorMessage(code?: string) {
  switch (code) {
    case '23505':
      return 'An Academic Year with this name already exists, or another Academic Year is already active.';

    case '23P01':
      return 'The dates overlap with another Academic Year. Academic Years must have separate date ranges.';

    case '23514':
      return 'The Academic Year does not satisfy the required date or content rules.';

    case '42501':
      return 'You are not authorized to perform this operation.';

    default:
      return 'The Academic Year could not be saved. Please try again.';
  }
}

export async function createAcademicYearAction(
  _previousState: AcademicYearActionState,
  formData: FormData,
): Promise<AcademicYearActionState> {
  await requireHodAccess();

  const parsed = academicYearFormSchema.safeParse({
    name: formData.get('name'),
    startsOn: formData.get('startsOn'),
    endsOn: formData.get('endsOn'),
    notes: formData.get('notes') || undefined,
  });

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
    .from('academic_years')
    .insert({
      name: parsed.data.name,
      starts_on: parsed.data.startsOn,
      ends_on: parsed.data.endsOn,
      notes: parsed.data.notes || null,
      status: 'planned',
    });

  if (error) {
    return {
      status: 'error',
      message: getDatabaseErrorMessage(error.code),
    };
  }

  revalidateAcademicYearPages();

  return {
    status: 'success',
    message: 'Academic Year created successfully.',
  };
}

export async function updateAcademicYearAction(
  _previousState: AcademicYearActionState,
  formData: FormData,
): Promise<AcademicYearActionState> {
  await requireHodAccess();

  const idResult = academicYearIdSchema.safeParse(
    formData.get('id'),
  );

  const formResult =
    academicYearFormSchema.safeParse({
      name: formData.get('name'),
      startsOn: formData.get('startsOn'),
      endsOn: formData.get('endsOn'),
      notes: formData.get('notes') || undefined,
    });

  if (!idResult.success) {
    return {
      status: 'error',
      message: 'The Academic Year identifier is invalid.',
    };
  }

  if (!formResult.success) {
    return {
      status: 'error',
      message: 'Review the highlighted fields.',
      fieldErrors:
        formResult.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('academic_years')
    .update({
      name: formResult.data.name,
      starts_on: formResult.data.startsOn,
      ends_on: formResult.data.endsOn,
      notes: formResult.data.notes || null,
    })
    .eq('id', idResult.data);

  if (error) {
    return {
      status: 'error',
      message: getDatabaseErrorMessage(error.code),
    };
  }

  revalidateAcademicYearPages();

  return {
    status: 'success',
    message: 'Academic Year updated successfully.',
  };
}

export async function setAcademicYearStatusAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const idResult = academicYearIdSchema.safeParse(
    formData.get('id'),
  );

  const statusResult =
    academicYearStatusSchema.safeParse(
      formData.get('status'),
    );

  if (!idResult.success || !statusResult.success) {
    throw new Error(
      'Invalid Academic Year status request.',
    );
  }

  const status: AcademicYearStatus =
    statusResult.data;

  const supabase = await createClient();

  /*
   * Activating a year is performed in two controlled steps.
   * The database unique index remains the final safeguard.
   */
  if (status === 'active') {
    const { error: resetError } = await supabase
      .from('academic_years')
      .update({
        status: 'closed',
      })
      .eq('status', 'active')
      .neq('id', idResult.data);

    if (resetError) {
      throw new Error(
        getDatabaseErrorMessage(resetError.code),
      );
    }
  }

  const { error } = await supabase
    .from('academic_years')
    .update({
      status,
    })
    .eq('id', idResult.data);

  if (error) {
    throw new Error(
      getDatabaseErrorMessage(error.code),
    );
  }

  revalidateAcademicYearPages();
}