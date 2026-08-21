import 'server-only';

import {
  createClient,
} from '@/lib/supabase/server';

import type {
  TrainerAccessRecord,
  TrainerAccessState,
} from './types';

interface TrainerAccessRow {
  trainer_id: string;
  full_name: string;
  email: string | null;
  trainer_active: boolean;
  linked_profile_id: string | null;
  matched_profile_id: string | null;
  profile_role: string | null;
  profile_active: boolean | null;
  access_state: string;
}

const validStates =
  new Set<TrainerAccessState>([
    'linked',
    'ready_to_link',
    'account_required',
    'administrative_profile',
    'email_required',
    'inactive',
    'review',
  ]);

function accessState(
  value: string,
): TrainerAccessState {
  return validStates.has(
    value as
      TrainerAccessState,
  )
    ? value as
        TrainerAccessState
    : 'review';
}

export async function getTrainerAccessRegister():
Promise<TrainerAccessRecord[]> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_trainer_access_register',
    );

  if (error) {
    throw new Error(
      `Unable to load trainer access: ${error.message}`,
    );
  }

  return (
    (
      data ??
      []
    ) as TrainerAccessRow[]
  ).map(
    (
      row,
    ) => ({
      trainerId:
        row.trainer_id,
      fullName:
        row.full_name,
      email:
        row.email,
      trainerActive:
        row.trainer_active,
      linkedProfileId:
        row.linked_profile_id,
      matchedProfileId:
        row.matched_profile_id,
      profileRole:
        row.profile_role,
      profileActive:
        row.profile_active,
      accessState:
        accessState(
          row.access_state,
        ),
    }),
  );
}
