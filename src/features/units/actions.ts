'use server';

import { revalidatePath } from 'next/cache';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type {
  UnitActionState,
} from './types';
import {
  unitFormSchema,
  unitIdSchema,
} from './validation';

function revalidateUnitPages(
  id?: string,
) {
  revalidatePath('/dashboard');
  revalidatePath('/timetable/units');

  if (id) {
    revalidatePath(
      `/timetable/units/${id}/edit`,
    );
  }
}

function getUnitDatabaseErrorMessage(
  code?: string,
  message?: string,
) {
  if (
    message?.includes(
      'units_programme_code_unique_idx',
    )
  ) {
    return 'A unit with this code already exists under the selected programme.';
  }

  if (
    message?.includes(
      'units_programme_name_unique_idx',
    )
  ) {
    return 'A unit with this name already exists under the selected programme.';
  }

  if (
    message?.includes(
      'Academic Period exceeds',
    )
  ) {
    return 'The selected Academic Period exceeds the parent programme structure.';
  }

  if (
    message?.includes(
      'inactive programme',
    )
  ) {
    return 'Active units cannot belong to an inactive programme.';
  }

  if (
    message?.includes(
      'not available for timetabling',
    )
  ) {
    return 'The parent programme is not available for timetabling.';
  }

  switch (code) {
    case '23503':
      return 'The selected programme no longer exists.';

    case '23505':
      return 'A unit with the same code or name already exists under this programme.';

    case '23514':
      return 'The unit does not satisfy the required validation rules.';

    case '42501':
      return 'You are not authorized to manage units.';

    case 'P0001':
      return message ??
        'The unit conflicts with the parent programme configuration.';

    case 'P0002':
      return 'The selected programme was not found.';

    default:
      return 'The unit could not be saved. Please try again.';
  }
}

function normalizeOptionalValue(
  formData: FormData,
  fieldName: string,
) {
  const value = formData.get(fieldName);

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  return normalized || undefined;
}

function parseUnitForm(
  formData: FormData,
) {
  return unitFormSchema.safeParse({
    programmeId:
      formData.get('programmeId'),

    code:
      formData.get('code'),

    name:
      formData.get('name'),

    shortName:
      normalizeOptionalValue(
        formData,
        'shortName',
      ),

    category:
      formData.get('category'),

    academicPeriodNumber:
      formData.get(
        'academicPeriodNumber',
      ),

    theoryHours:
      formData.get('theoryHours'),

    practicalHours:
      formData.get('practicalHours'),

    weeklySessions:
      formData.get('weeklySessions'),

    preferredRoomType:
      normalizeOptionalValue(
        formData,
        'preferredRoomType',
      ),

    notes:
      normalizeOptionalValue(
        formData,
        'notes',
      ),
  });
}

export async function createUnitAction(
  _previousState: UnitActionState,
  formData: FormData,
): Promise<UnitActionState> {
  await requireHodAccess();

  const parsed =
    parseUnitForm(formData);

  if (!parsed.success) {
    return {
      status: 'error',
      message:
        'Review the highlighted fields.',
      fieldErrors:
        parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('units')
    .insert({
      programme_id:
        parsed.data.programmeId,
      code:
        parsed.data.code,
      name:
        parsed.data.name,
      short_name:
        parsed.data.shortName || null,
      category:
        parsed.data.category,
      academic_period_number:
        parsed.data.academicPeriodNumber,
      theory_hours:
        parsed.data.theoryHours,
      practical_hours:
        parsed.data.practicalHours,
      weekly_sessions:
        parsed.data.weeklySessions,
      preferred_room_type:
        parsed.data.preferredRoomType ||
        null,
      is_active: true,
      is_timetable_available: true,
      notes:
        parsed.data.notes || null,
    });

  if (error) {
    return {
      status: 'error',
      message:
        getUnitDatabaseErrorMessage(
          error.code,
          error.message,
        ),
    };
  }

  revalidateUnitPages();

  return {
    status: 'success',
    message:
      'Unit created successfully.',
  };
}

export async function updateUnitAction(
  _previousState: UnitActionState,
  formData: FormData,
): Promise<UnitActionState> {
  await requireHodAccess();

  const idResult =
    unitIdSchema.safeParse(
      formData.get('id'),
    );

  if (!idResult.success) {
    return {
      status: 'error',
      message:
        'The unit identifier is invalid.',
    };
  }

  const parsed =
    parseUnitForm(formData);

  if (!parsed.success) {
    return {
      status: 'error',
      message:
        'Review the highlighted fields.',
      fieldErrors:
        parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('units')
    .update({
      programme_id:
        parsed.data.programmeId,
      code:
        parsed.data.code,
      name:
        parsed.data.name,
      short_name:
        parsed.data.shortName || null,
      category:
        parsed.data.category,
      academic_period_number:
        parsed.data.academicPeriodNumber,
      theory_hours:
        parsed.data.theoryHours,
      practical_hours:
        parsed.data.practicalHours,
      weekly_sessions:
        parsed.data.weeklySessions,
      preferred_room_type:
        parsed.data.preferredRoomType ||
        null,
      notes:
        parsed.data.notes || null,
    })
    .eq('id', idResult.data);

  if (error) {
    return {
      status: 'error',
      message:
        getUnitDatabaseErrorMessage(
          error.code,
          error.message,
        ),
    };
  }

  revalidateUnitPages(
    idResult.data,
  );

  return {
    status: 'success',
    message:
      'Unit updated successfully.',
  };
}

export async function setUnitActiveAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const idResult =
    unitIdSchema.safeParse(
      formData.get('id'),
    );

  if (!idResult.success) {
    throw new Error(
      'Invalid unit identifier.',
    );
  }

  const isActive =
    formData.get('isActive') === 'true';

  const supabase = await createClient();

  const updateValues:
    Record<string, boolean> = {
      is_active: isActive,
    };

  if (!isActive) {
    updateValues.is_timetable_available =
      false;
  }

  const { error } = await supabase
    .from('units')
    .update(updateValues)
    .eq('id', idResult.data);

  if (error) {
    throw new Error(
      getUnitDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    );
  }

  revalidateUnitPages(
    idResult.data,
  );
}

export async function setUnitTimetableAvailabilityAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const idResult =
    unitIdSchema.safeParse(
      formData.get('id'),
    );

  if (!idResult.success) {
    throw new Error(
      'Invalid unit identifier.',
    );
  }

  const isAvailable =
    formData.get(
      'isTimetableAvailable',
    ) === 'true';

  const supabase = await createClient();

  if (isAvailable) {
    const {
      data: unit,
      error: lookupError,
    } = await supabase
      .from('units')
      .select('is_active')
      .eq('id', idResult.data)
      .maybeSingle();

    if (lookupError) {
      throw new Error(
        getUnitDatabaseErrorMessage(
          lookupError.code,
          lookupError.message,
        ),
      );
    }

    if (!unit) {
      throw new Error(
        'The requested unit was not found.',
      );
    }

    if (!unit.is_active) {
      throw new Error(
        'Activate the unit before making it available for timetabling.',
      );
    }
  }

  const { error } = await supabase
    .from('units')
    .update({
      is_timetable_available:
        isAvailable,
    })
    .eq('id', idResult.data);

  if (error) {
    throw new Error(
      getUnitDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    );
  }

  revalidateUnitPages(
    idResult.data,
  );
}