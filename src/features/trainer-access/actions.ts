'use server';

import {
  revalidatePath,
} from 'next/cache';
import { randomBytes, randomInt, createHash } from 'node:crypto';
import {
  z,
} from 'zod';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  createClient,
} from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

import type {
  TrainerAccessActionState,
} from './types';

const trainerIdSchema =
  z.uuid();

function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new Error('The access request timed out.')),
      timeoutMs,
    );

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

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
    '/trainers',
  );

  revalidatePath(
    '/trainers/access',
  );

  return {
    status:
      'success',
    message:
      'Staff access linked.',
  };
}

export async function generateTrainerAccessPinAction(
  _previousState: TrainerAccessActionState,
  formData: FormData,
): Promise<TrainerAccessActionState> {
  try {
    return await generateTrainerAccessPin(formData);
  } catch {
    return { status: 'error', message: 'PIN generation could not be completed. Please try again.' };
  }
}

async function generateTrainerAccessPin(
  formData: FormData,
): Promise<TrainerAccessActionState> {
  const hod = await requireHodAccess();
  const parsed = trainerIdSchema.safeParse(formData.get('trainerId'));
  if (!parsed.success) return { status: 'error', message: 'Invalid trainer.' };

  const admin = createAdminClient({ timeoutMs: 15_000 });
  const { data: trainer, error: trainerError } = await admin
    .from('trainers')
    .select('id,full_name,email,profile_id,is_active,department_id')
    .eq('id', parsed.data)
    .maybeSingle();

  if (trainerError || !trainer) return { status: 'error', message: 'Trainer not found.' };
  if (hod.role !== 'system_admin' && trainer.department_id !== hod.activeDepartmentId) {
    return { status: 'error', message: 'You cannot manage access for this department.' };
  }
  if (!trainer.is_active || !trainer.email?.trim()) {
    return { status: 'error', message: 'An active trainer with a registered email is required.' };
  }

  let profileId = trainer.profile_id;
  if (!profileId) {
    const { data: matchingProfile, error: profileLookupError } = await admin
      .from('profiles')
      .select('id,role,is_active')
      .ilike('email', trainer.email.trim())
      .maybeSingle();

    if (profileLookupError) return { status: 'error', message: 'Unable to check the trainer account.' };

    if (matchingProfile) {
      if (!matchingProfile.is_active || !['pending', 'trainer'].includes(matchingProfile.role)) {
        return { status: 'error', message: 'The matching account cannot be linked as a trainer.' };
      }

      const supabase = await createClient();
      const { error } = await withTimeout(
        supabase.rpc('provision_trainer_access', {
          target_trainer_id: trainer.id,
        }),
        15_000,
      );
      if (error) return { status: 'error', message: error.message };
      profileId = matchingProfile.id;
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: trainer.email.trim().toLowerCase(),
        password: randomBytes(32).toString('base64url'),
        email_confirm: true,
        user_metadata: { role: 'trainer', full_name: trainer.full_name },
      });
      if (error || !created.user) {
        return { status: 'error', message: error?.message ?? 'Unable to prepare trainer access.' };
      }
      profileId = created.user.id;
    }
  }

  const { data: profile, error: linkedProfileError } = await admin
    .from('profiles')
    .select('email,role,is_active')
    .eq('id', profileId)
    .maybeSingle();

  if (linkedProfileError || !profile || !profile.is_active || profile.role !== 'trainer' || !profile.email) {
    return { status: 'error', message: 'Trainer account is not linked and active. Review the trainer access register.' };
  }

  const pin = randomInt(0, 100_000_000).toString().padStart(8, '0');
  const pinHash = createHash('sha256').update(pin).digest('hex');
  const { error: pinError } = await admin
    .from('external_trainer_access_pins')
    .upsert({
      trainer_id: trainer.id,
      pin_hash: pinHash,
      issued_by: hod.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'trainer_id' });

  if (pinError) return { status: 'error', message: `Unable to save trainer PIN: ${pinError.message}` };

  revalidatePath('/trainers/access');
  return { status: 'success', message: 'Share this PIN with the trainer. It will not be shown again.', pin };
}
