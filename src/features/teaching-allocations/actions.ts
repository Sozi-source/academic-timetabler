'use server';

import { revalidatePath } from 'next/cache';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

import type {
  TeachingAllocationActionState,
} from './types';
import {
  teachingAllocationFormSchema,
  teachingAllocationIdSchema,
  teachingAllocationStatusActionSchema,
} from './validation';

function revalidateAllocationPages(
  id?: string,
) {
  revalidatePath('/dashboard');
  revalidatePath(
    '/timetable/teaching-allocations',
  );
  revalidatePath('/timetable/generator');

  if (id) {
    revalidatePath(
      `/timetable/teaching-allocations/${id}/edit`,
    );
  }
}

function getAllocationDatabaseErrorMessage(
  code?: string,
  message?: string,
) {
  if (
    message?.includes(
      'teaching_allocations_period_cohort_unit_unique_idx',
    )
  ) {
    return 'This unit is already allocated to the selected cohort in this Academic Period.';
  }

  if (
    message?.includes(
      'does not belong to the cohort programme',
    )
  ) {
    return 'The selected unit does not belong to the cohort programme.';
  }

  if (
    message?.includes(
      'does not belong to the cohort current programme period',
    )
  ) {
    return 'The selected unit does not match the cohort current programme period.';
  }

  if (
    message?.includes(
      'Academic Period is not open',
    )
  ) {
    return 'The selected Academic Period is not open for timetable allocation.';
  }

  if (
    message?.includes(
      'cohort is not available',
    ) ||
    message?.includes(
      'cohort is not enabled',
    )
  ) {
    return 'The selected cohort is not available for timetabling.';
  }

  if (
    message?.includes(
      'unit is not available',
    )
  ) {
    return 'The selected unit is not available for timetabling.';
  }

  if (
    message?.includes(
      'trainer is not available',
    )
  ) {
    return 'The selected trainer is not available for timetabling.';
  }

  if (
    message?.includes(
      'preferred room is not available',
    )
  ) {
    return 'The preferred room is not available for timetabling.';
  }

  if (
    message?.includes(
      'room capacity is below',
    )
  ) {
    return 'The preferred room cannot accommodate the cohort enrolment.';
  }

  switch (code) {
    case '23503':
      return 'One of the selected records no longer exists. Refresh the page and try again.';

    case '23505':
      return 'This cohort already has an allocation for the selected unit and Academic Period.';

    case '23514':
      return 'The allocation does not satisfy the required scheduling rules.';

    case '42501':
      return 'You are not authorized to manage teaching allocations.';

    case 'P0001':
      return message ??
        'The allocation conflicts with the current scheduling configuration.';

    case 'P0002':
      return message ??
        'A selected timetable resource was not found.';

    default:
      return 'The teaching allocation could not be saved. Please try again.';
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

function parseAllocationForm(
  formData: FormData,
) {
  return teachingAllocationFormSchema.safeParse({
    academicPeriodId:
      formData.get('academicPeriodId'),

    cohortId:
      formData.get('cohortId'),

    unitId:
      formData.get('unitId'),

    trainerId:
      formData.get('trainerId'),

    preferredRoomId:
      formData.get('preferredRoomId') ||
      undefined,

    deliveryMode:
      formData.get('deliveryMode'),

    weeklySessions:
      formData.get('weeklySessions'),

    sessionDurationMinutes:
      formData.get(
        'sessionDurationMinutes',
      ),

    status:
      formData.get('status'),

    notes:
      normalizeOptionalValue(
        formData,
        'notes',
      ),
  });
}

async function validateTrainerWorkload({
  trainerId,
  academicPeriodId,
  weeklySessions,
  sessionDurationMinutes,
  excludedAllocationId,
}: {
  trainerId: string;
  academicPeriodId: string;
  weeklySessions: number;
  sessionDurationMinutes: number;
  excludedAllocationId?: string;
}) {
  const supabase = await createClient();

  const {
    data: trainer,
    error: trainerError,
  } = await supabase
    .from('trainers')
    .select(
      'maximum_weekly_hours',
    )
    .eq('id', trainerId)
    .maybeSingle();

  if (trainerError) {
    throw new Error(
      getAllocationDatabaseErrorMessage(
        trainerError.code,
        trainerError.message,
      ),
    );
  }

  if (!trainer) {
    throw new Error(
      'The selected trainer was not found.',
    );
  }

  let allocationQuery = supabase
    .from('teaching_allocations')
    .select(
      'id, weekly_sessions, session_duration_minutes',
    )
    .eq('trainer_id', trainerId)
    .eq(
      'academic_period_id',
      academicPeriodId,
    )
    .in('status', [
      'draft',
      'active',
    ]);

  if (excludedAllocationId) {
    allocationQuery =
      allocationQuery.neq(
        'id',
        excludedAllocationId,
      );
  }

  const {
    data: existingAllocations,
    error: allocationError,
  } = await allocationQuery;

  if (allocationError) {
    throw new Error(
      getAllocationDatabaseErrorMessage(
        allocationError.code,
        allocationError.message,
      ),
    );
  }

  const existingMinutes = (
    existingAllocations ?? []
  ).reduce(
    (total, allocation) =>
      total +
      allocation.weekly_sessions *
        allocation.session_duration_minutes,
    0,
  );

  const proposedMinutes =
    weeklySessions *
    sessionDurationMinutes;

  const maximumMinutes =
    Number(
      trainer.maximum_weekly_hours,
    ) * 60;

  if (
    existingMinutes + proposedMinutes >
    maximumMinutes
  ) {
    const allocatedHours =
      existingMinutes / 60;

    const proposedHours =
      proposedMinutes / 60;

    const maximumHours = Number(
      trainer.maximum_weekly_hours,
    );

    throw new Error(
      `This allocation would exceed the trainer's weekly limit. The trainer already has ${allocatedHours} hours, this allocation adds ${proposedHours} hours, and the maximum is ${maximumHours} hours.`,
    );
  }
}

export async function createTeachingAllocationAction(
  _previousState:
    TeachingAllocationActionState,
  formData: FormData,
): Promise<TeachingAllocationActionState> {
  await requireHodAccess();

  const parsed =
    parseAllocationForm(formData);

  if (!parsed.success) {
    return {
      status: 'error',
      message:
        'Review the highlighted fields.',
      fieldErrors:
        parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await validateTrainerWorkload({
      trainerId:
        parsed.data.trainerId,
      academicPeriodId:
        parsed.data.academicPeriodId,
      weeklySessions:
        parsed.data.weeklySessions,
      sessionDurationMinutes:
        parsed.data.sessionDurationMinutes,
    });
  }
  catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Trainer workload validation failed.',
    };
  }

  const timetableEnabled =
    parsed.data.status === 'draft' ||
    parsed.data.status === 'active';

  const supabase = await createClient();

  const { error } = await supabase
    .from('teaching_allocations')
    .insert({
      academic_period_id:
        parsed.data.academicPeriodId,
      cohort_id:
        parsed.data.cohortId,
      unit_id:
        parsed.data.unitId,
      trainer_id:
        parsed.data.trainerId,
      preferred_room_id:
        parsed.data.preferredRoomId ??
        null,
      delivery_mode:
        parsed.data.deliveryMode,
      weekly_sessions:
        parsed.data.weeklySessions,
      session_duration_minutes:
        parsed.data.sessionDurationMinutes,
      status:
        parsed.data.status,
      is_timetable_enabled:
        timetableEnabled,
      notes:
        parsed.data.notes || null,
    });

  if (error) {
    return {
      status: 'error',
      message:
        getAllocationDatabaseErrorMessage(
          error.code,
          error.message,
        ),
    };
  }

  revalidateAllocationPages();

  return {
    status: 'success',
    message:
      'Teaching allocation created successfully.',
  };
}

export async function updateTeachingAllocationAction(
  _previousState:
    TeachingAllocationActionState,
  formData: FormData,
): Promise<TeachingAllocationActionState> {
  await requireHodAccess();

  const idResult =
    teachingAllocationIdSchema.safeParse(
      formData.get('id'),
    );

  if (!idResult.success) {
    return {
      status: 'error',
      message:
        'The teaching allocation identifier is invalid.',
    };
  }

  const parsed =
    parseAllocationForm(formData);

  if (!parsed.success) {
    return {
      status: 'error',
      message:
        'Review the highlighted fields.',
      fieldErrors:
        parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await validateTrainerWorkload({
      trainerId:
        parsed.data.trainerId,
      academicPeriodId:
        parsed.data.academicPeriodId,
      weeklySessions:
        parsed.data.weeklySessions,
      sessionDurationMinutes:
        parsed.data.sessionDurationMinutes,
      excludedAllocationId:
        idResult.data,
    });
  }
  catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Trainer workload validation failed.',
    };
  }

  const timetableEnabled =
    parsed.data.status === 'draft' ||
    parsed.data.status === 'active';

  const supabase = await createClient();

  const { error } = await supabase
    .from('teaching_allocations')
    .update({
      academic_period_id:
        parsed.data.academicPeriodId,
      cohort_id:
        parsed.data.cohortId,
      unit_id:
        parsed.data.unitId,
      trainer_id:
        parsed.data.trainerId,
      preferred_room_id:
        parsed.data.preferredRoomId ??
        null,
      delivery_mode:
        parsed.data.deliveryMode,
      weekly_sessions:
        parsed.data.weeklySessions,
      session_duration_minutes:
        parsed.data.sessionDurationMinutes,
      status:
        parsed.data.status,
      is_timetable_enabled:
        timetableEnabled,
      notes:
        parsed.data.notes || null,
    })
    .eq('id', idResult.data);

  if (error) {
    return {
      status: 'error',
      message:
        getAllocationDatabaseErrorMessage(
          error.code,
          error.message,
        ),
    };
  }

  revalidateAllocationPages(
    idResult.data,
  );

  return {
    status: 'success',
    message:
      'Teaching allocation updated successfully.',
  };
}

export async function setTeachingAllocationStatusAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const parsed =
    teachingAllocationStatusActionSchema.safeParse(
      {
        id: formData.get('id'),
        status: formData.get('status'),
      },
    );

  if (!parsed.success) {
    throw new Error(
      'Invalid teaching allocation lifecycle request.',
    );
  }

  const isTimetableEnabled =
    parsed.data.status === 'draft' ||
    parsed.data.status === 'active';

  const supabase = await createClient();

  const { error } = await supabase
    .from('teaching_allocations')
    .update({
      status: parsed.data.status,
      is_timetable_enabled:
        isTimetableEnabled,
    })
    .eq('id', parsed.data.id);

  if (error) {
    throw new Error(
      getAllocationDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    );
  }

  revalidateAllocationPages(
    parsed.data.id,
  );
}

export async function setTeachingAllocationEnabledAction(
  formData: FormData,
): Promise<void> {
  await requireHodAccess();

  const idResult =
    teachingAllocationIdSchema.safeParse(
      formData.get('id'),
    );

  if (!idResult.success) {
    throw new Error(
      'Invalid teaching allocation identifier.',
    );
  }

  const isEnabled =
    formData.get(
      'isTimetableEnabled',
    ) === 'true';

  const supabase = await createClient();

  if (isEnabled) {
    const {
      data: allocation,
      error: lookupError,
    } = await supabase
      .from('teaching_allocations')
      .select('status')
      .eq('id', idResult.data)
      .maybeSingle();

    if (lookupError) {
      throw new Error(
        getAllocationDatabaseErrorMessage(
          lookupError.code,
          lookupError.message,
        ),
      );
    }

    if (!allocation) {
      throw new Error(
        'The teaching allocation was not found.',
      );
    }

    if (
      allocation.status !== 'draft' &&
      allocation.status !== 'active'
    ) {
      throw new Error(
        'Only draft or active allocations can be enabled for timetable generation.',
      );
    }
  }

  const { error } = await supabase
    .from('teaching_allocations')
    .update({
      is_timetable_enabled:
        isEnabled,
    })
    .eq('id', idResult.data);

  if (error) {
    throw new Error(
      getAllocationDatabaseErrorMessage(
        error.code,
        error.message,
      ),
    );
  }

  revalidateAllocationPages(
    idResult.data,
  );
}