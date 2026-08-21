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
}

export const initialTrainerAccessActionState:
TrainerAccessActionState = {
  status: 'idle',
  message: null,
};
