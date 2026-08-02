export type TrainerEmploymentType =
  | 'full_time'
  | 'part_time'
  | 'visiting'
  | 'contract'
  | 'other';

export interface Trainer {
  id: string;
  profileId: string | null;
  staffNumber: string;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  employmentType: TrainerEmploymentType;
  specialization: string | null;
  qualifications: string | null;
  maximumWeeklyHours: number;
  maximumDailyHours: number;
  isActive: boolean;
  isTimetableAvailable: boolean;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrainerRow {
  id: string;
  profile_id: string | null;
  staff_number: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  employment_type: TrainerEmploymentType;
  specialization: string | null;
  qualifications: string | null;
  maximum_weekly_hours: number | string;
  maximum_daily_hours: number | string;
  is_active: boolean;
  is_timetable_available: boolean;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainerActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  fieldErrors?: {
    staffNumber?: string[];
    fullName?: string[];
    email?: string[];
    phoneNumber?: string[];
    employmentType?: string[];
    specialization?: string[];
    qualifications?: string[];
    maximumWeeklyHours?: string[];
    maximumDailyHours?: string[];
    notes?: string[];
  };
}

export const initialTrainerActionState:
TrainerActionState = {
  status: 'idle',
  message: null,
};

export const trainerEmploymentTypeOptions: Array<{
  value: TrainerEmploymentType;
  label: string;
}> = [
  {
    value: 'full_time',
    label: 'Full-time',
  },
  {
    value: 'part_time',
    label: 'Part-time',
  },
  {
    value: 'visiting',
    label: 'Visiting trainer',
  },
  {
    value: 'contract',
    label: 'Contract',
  },
  {
    value: 'other',
    label: 'Other',
  },
];