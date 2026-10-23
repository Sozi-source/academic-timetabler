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
  TrainerAccessPinGrant,
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

export async function generateTrainerAccessPinsBulkAction(
  _previousState: TrainerAccessActionState,
  formData: FormData,
): Promise<TrainerAccessActionState> {
  try {
    const hod = await requireHodAccess();
    const parsed = z.array(trainerIdSchema).min(1).max(250).safeParse(formData.getAll('trainerId'));
    if (!parsed.success) {
      return { status: 'error', message: 'Select between 1 and 250 eligible trainers.' };
    }

    const trainerIds = [...new Set(parsed.data)];
    if (trainerIds.length !== parsed.data.length) {
      return { status: 'error', message: 'Duplicate trainers were included. Refresh and try again.' };
    }

    const admin = createAdminClient({ timeoutMs: 15_000 });
    const trainerQuery = admin
      .from('trainers')
      .select('id,full_name,email,profile_id,is_active,department_id')
      .in('id', trainerIds);

    const { data: selectedTrainers, error: trainerError } = await trainerQuery;
    if (trainerError) return { status: 'error', message: 'Unable to load the selected trainers.' };
    if (!selectedTrainers || selectedTrainers.length === 0) {
      return { status: 'error', message: 'No selected trainers are available in the app.' };
    }

    const eligibleTrainers = selectedTrainers.filter(
      (trainer) => trainer.is_active && Boolean(trainer.email?.trim()),
    );
    if (eligibleTrainers.length === 0) {
      return { status: 'error', message: 'The selected trainers need an active record and registered email.' };
    }

    const results = await mapWithConcurrency(eligibleTrainers, 4, async (trainer) => {
      const trainerFormData = new FormData();
      trainerFormData.set('trainerId', trainer.id);
      const result = await generateTrainerAccessPin(trainerFormData, {
        hod,
        replaceExisting: true,
        allowCrossDepartment: true,
      });

      if (result.status !== 'success' || !result.pin || !trainer.email) {
        return {
          pin: null,
          error: { trainerName: trainer.full_name, message: result.message ?? 'Unable to generate PIN.' },
        };
      }

      const grant: TrainerAccessPinGrant = {
        trainerId: trainer.id,
        fullName: trainer.full_name,
        email: trainer.email.trim(),
        pin: result.pin,
      };
      return { pin: grant, error: null };
    });

    const pins = results.flatMap((result) => result.pin ? [result.pin] : []);
    const pinErrors = results.flatMap((result) => result.error ? [result.error] : []);
    if (pins.length > 0) revalidatePath('/trainers/access');

    return {
      status: pins.length > 0 ? 'success' : 'error',
      message: pins.length > 0
        ? `Generated or replaced ${pins.length} PIN${pins.length === 1 ? '' : 's'}. Previous PINs for these trainers are no longer valid.`
        : 'No PINs were generated. Existing PINs remain valid for trainers whose generation failed.',
      pins,
      pinErrors,
    };
  } catch {
    return { status: 'error', message: 'Bulk PIN generation could not be completed. Please try again.' };
  }
}

async function generateTrainerAccessPin(
  formData: FormData,
  options: {
    hod?: Awaited<ReturnType<typeof requireHodAccess>>;
    replaceExisting?: boolean;
    allowCrossDepartment?: boolean;
  } = {},
): Promise<TrainerAccessActionState> {
  const hod = options.hod ?? await requireHodAccess();
  const parsed = trainerIdSchema.safeParse(formData.get('trainerId'));
  if (!parsed.success) return { status: 'error', message: 'Invalid trainer.' };

  const admin = createAdminClient({ timeoutMs: 15_000 });
  const { data: trainer, error: trainerError } = await admin
    .from('trainers')
    .select('id,full_name,email,profile_id,is_active,department_id')
    .eq('id', parsed.data)
    .maybeSingle();

  if (trainerError || !trainer) return { status: 'error', message: 'Trainer not found.' };
  if (!options.allowCrossDepartment && hod.role !== 'system_admin' && trainer.department_id !== hod.activeDepartmentId) {
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
  const pinValues = {
    trainer_id: trainer.id,
    pin_hash: pinHash,
    issued_by: hod.id,
    updated_at: new Date().toISOString(),
  };
  const { error: pinError } = options.replaceExisting === false
    ? await admin.from('external_trainer_access_pins').insert(pinValues)
    : await admin.from('external_trainer_access_pins').upsert(pinValues, { onConflict: 'trainer_id' });

  if (pinError) return { status: 'error', message: `Unable to save trainer PIN: ${pinError.message}` };

  revalidatePath('/trainers/access');
  return { status: 'success', message: 'Share this PIN with the trainer. It will not be shown again.', pin };
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapItem: (item: T) => Promise<TResult>,
): Promise<TResult[]> {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        const item = items[index];
        if (item !== undefined) results[index] = await mapItem(item);
      }
    }),
  );

  return results;
}
