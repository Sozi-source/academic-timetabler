export type ProgrammeAwardLevel =
  | 'certificate'
  | 'craft_certificate'
  | 'artisan_certificate'
  | 'diploma'
  | 'higher_diploma'
  | 'degree'
  | 'short_course'
  | 'other';

export type ProgrammeDurationUnit =
  | 'months'
  | 'years';

export interface Programme {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  awardLevel: ProgrammeAwardLevel;
  awardingBody: string | null;
  durationValue: number;
  durationUnit: ProgrammeDurationUnit;
  totalAcademicPeriods: number;
  maximumCohortSize: number | null;
  isActive: boolean;
  isTimetableAvailable: boolean;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProgrammeRow {
  id: string;
  code: string;
  name: string;
  short_name: string | null;
  award_level: ProgrammeAwardLevel;
  awarding_body: string | null;
  duration_value: number | string;
  duration_unit: ProgrammeDurationUnit;
  total_academic_periods: number;
  maximum_cohort_size: number | null;
  is_active: boolean;
  is_timetable_available: boolean;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgrammeActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  fieldErrors?: {
    code?: string[];
    name?: string[];
    shortName?: string[];
    awardLevel?: string[];
    awardingBody?: string[];
    durationValue?: string[];
    durationUnit?: string[];
    totalAcademicPeriods?: string[];
    maximumCohortSize?: string[];
    notes?: string[];
  };
}

export const initialProgrammeActionState:
ProgrammeActionState = {
  status: 'idle',
  message: null,
};

export const programmeAwardLevelOptions: Array<{
  value: ProgrammeAwardLevel;
  label: string;
}> = [
  {
    value: 'certificate',
    label: 'Certificate',
  },
  {
    value: 'craft_certificate',
    label: 'Craft certificate',
  },
  {
    value: 'artisan_certificate',
    label: 'Artisan certificate',
  },
  {
    value: 'diploma',
    label: 'Diploma',
  },
  {
    value: 'higher_diploma',
    label: 'Higher diploma',
  },
  {
    value: 'degree',
    label: 'Degree',
  },
  {
    value: 'short_course',
    label: 'Short course',
  },
  {
    value: 'other',
    label: 'Other',
  },
];

export const programmeDurationUnitOptions: Array<{
  value: ProgrammeDurationUnit;
  label: string;
}> = [
  {
    value: 'months',
    label: 'Months',
  },
  {
    value: 'years',
    label: 'Years',
  },
];