export type TrainerEmploymentType =
  | 'full_time'
  | 'part_time'
  | 'visiting'
  | 'contract'
  | 'other';
export type TrainerWorkloadRole = 'hod' | 'course_coordinator' | 'full_time_trainer' | 'part_time' | 'external';
export type TrainerAvailabilityMode = 'generally_available' | 'selected_slots_only';

export interface Trainer {
  id: string;
  profileId: string | null;
  staffNumber: string;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  employmentType: TrainerEmploymentType;
  departmentId: string;
  specialization: string | null;
  qualifications: string | null;
  maximumWeeklyHours: number;
  maximumDailyHours: number;
  workloadRole: TrainerWorkloadRole;
  homeDepartment: string | null;
  normalWeeklyHours: number;
  availabilityMode: TrainerAvailabilityMode;
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
  department_id: string;
  specialization: string | null;
  qualifications: string | null;
  maximum_weekly_hours: number | string;
  maximum_daily_hours: number | string;
  workload_role: TrainerWorkloadRole;
  home_department: string | null;
  normal_weekly_hours: number | string;
  availability_mode: TrainerAvailabilityMode;
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
    departmentId?: string[];
    specialization?: string[];
    qualifications?: string[];
    maximumWeeklyHours?: string[];
    maximumDailyHours?: string[];
    workloadRole?: string[];
    homeDepartment?: string[];
    normalWeeklyHours?: string[];
    availabilityMode?: string[];
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
