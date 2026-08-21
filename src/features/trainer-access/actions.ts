'use server';

import {
  revalidatePath,
} from 'next/cache';
import {
  z,
} from 'zod';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';

import type {
  TrainerAccessActionState,
} from './types';

const trainerIdSchema =
  z.uuid();

export async function provisionTrainerAccessAction(
  _previousState:
    TrainerAccessActionState,
  formData: FormData,
): Promise<TrainerAccessActionState> {
  await requireHodAccess();

  const parsed =
    trainerIdSchema.safeParse(
      formData.get(
        'trainerId',
      ),
    );

  if (!parsed.success) {
    return {
      status:
        'error',
      message:
        'Invalid trainer.',
    };
  }

  const supabase =
    await createClient();

  const {
    error,
  } =
    await supabase.rpc(
      'provision_trainer_access',
      {
        target_trainer_id:
          parsed.data,
      },
    );

  if (error) {
    return {
      status:
        'error',
      message:
        error.message,
    };
  }

  revalidatePath(
    '/timetable/trainers',
  );

  revalidatePath(
    '/timetable/trainers/access',
  );

  return {
    status:
      'success',
    message:
      'Staff access linked.',
  };
}
