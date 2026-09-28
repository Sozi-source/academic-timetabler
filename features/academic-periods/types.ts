export type AcademicPeriodStatus =
  | 'planned'
  | 'active'
  | 'closed'
  | 'archived';

export interface AcademicPeriodYearSummary {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status:
    | 'planned'
    | 'active'
    | 'closed'
    | 'archived';
}

export interface AcademicPeriod {
  id: string;
  academicYearId: string;
  academicYear: AcademicPeriodYearSummary;
  name: string;
  code: string;
  sequenceNumber: number;
  startsOn: string;
  endsOn: string;
  teachingStartsOn: string;
  teachingEndsOn: string;
  status: AcademicPeriodStatus;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicPeriodRow {
  id: string;
  academic_year_id: string;
  name: string;
  code: string;
  sequence_number: number;
  starts_on: string;
  ends_on: string;
  teaching_starts_on: string;
  teaching_ends_on: string;
  status: AcademicPeriodStatus;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  academic_years:
    | {
        id: string;
        name: string;
        starts_on: string;
        ends_on: string;
        status:
          | 'planned'
          | 'active'
          | 'closed'
          | 'archived';
      }
    | {
        id: string;
        name: string;
        starts_on: string;
        ends_on: string;
        status:
          | 'planned'
          | 'active'
          | 'closed'
          | 'archived';
      }[]
    | null;
}

export interface AcademicPeriodActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  fieldErrors?: {
    academicYearId?: string[];
    name?: string[];
    code?: string[];
    sequenceNumber?: string[];
    startsOn?: string[];
    endsOn?: string[];
    teachingStartsOn?: string[];
    teachingEndsOn?: string[];
    notes?: string[];
  };
}

export const initialAcademicPeriodActionState:
AcademicPeriodActionState = {
  status: 'idle',
  message: null,
};