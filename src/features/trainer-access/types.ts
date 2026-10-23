export type TrainerAccessState =
  | 'linked'
  | 'ready_to_link'
  | 'account_required'
  | 'administrative_profile'
  | 'email_required'
  | 'inactive'
  | 'review';

export interface TrainerAccessRecord {
  trainerId: string;
  fullName: string;
  email: string | null;
  trainerActive: boolean;
  linkedProfileId: string | null;
  matchedProfileId: string | null;
  profileRole: string | null;
  profileActive: boolean | null;
  accessState: TrainerAccessState;
}

export interface TrainerAccessActionState {
  status:
    | 'idle'
    | 'success'
    | 'error';
  message: string | null;
  pin?: string | null;
  pins?: TrainerAccessPinGrant[];
  skippedCount?: number;
  pinErrors?: Array<{ trainerName: string; message: string }>;
}

export interface TrainerAccessPinGrant {
  trainerId: string;
  fullName: string;
  email: string;
  pin: string;
}

export const initialTrainerAccessActionState:
TrainerAccessActionState = {
  status: 'idle',
  message: null,
  pin: null,
};
