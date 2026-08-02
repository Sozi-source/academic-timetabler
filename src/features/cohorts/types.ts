export type CohortStatus =
  | 'planned'
  | 'active'
  | 'completed'
  | 'suspended'
  | 'archived';

export interface CohortProgrammeSummary {
  id: string;
  code: string;
  name: string;
  totalAcademicPeriods: number;
  maximumCohortSize: number | null;
  isActive: boolean;
  isTimetableAvailable: boolean;
}

export interface Cohort {
  id: string;
  programmeId: string;
  code: string;
  name: string;
  intakeDate: string;
  expectedCompletionDate: string;
  currentAcademicPeriodNumber: number;
  plannedSize: number | null;
  actualSize: number;
  status: CohortStatus;
  isTimetableAvailable: boolean;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  programme: CohortProgrammeSummary | null;
}

export interface CohortRow {
  id: string;
  programme_id: string;
  code: string;
  name: string;
  intake_date: string;
  expected_completion_date: string;
  current_academic_period_number: number;
  planned_size: number | null;
  actual_size: number;
  status: CohortStatus;
  is_timetable_available: boolean;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  programmes:
    | {
        id: string;
        code: string;
        name: string;
        total_academic_periods: number;
        maximum_cohort_size: number | null;
        is_active: boolean;
        is_timetable_available: boolean;
      }
    | {
        id: string;
        code: string;
        name: string;
        total_academic_periods: number;
        maximum_cohort_size: number | null;
        is_active: boolean;
        is_timetable_available: boolean;
      }[]
    | null;
}

export interface CohortActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  fieldErrors?: {
    programmeId?: string[];
    code?: string[];
    name?: string[];
    intakeDate?: string[];
    expectedCompletionDate?: string[];
    currentAcademicPeriodNumber?: string[];
    plannedSize?: string[];
    actualSize?: string[];
    status?: string[];
    notes?: string[];
  };
}

export const initialCohortActionState:
CohortActionState = {
  status: 'idle',
  message: null,
};

export const cohortStatusOptions: Array<{
  value: CohortStatus;
  label: string;
  description: string;
}> = [
  {
    value: 'planned',
    label: 'Planned',
    description:
      'The cohort has been prepared but teaching has not started.',
  },
  {
    value: 'active',
    label: 'Active',
    description:
      'The cohort is currently receiving teaching and timetable allocations.',
  },
  {
    value: 'completed',
    label: 'Completed',
    description:
      'The cohort has completed its academic programme.',
  },
  {
    value: 'suspended',
    label: 'Suspended',
    description:
      'Teaching and timetable allocation are temporarily stopped.',
  },
  {
    value: 'archived',
    label: 'Archived',
    description:
      'The cohort is retained only for historical records.',
  },
];