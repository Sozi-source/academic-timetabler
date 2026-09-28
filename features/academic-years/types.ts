export type AcademicYearStatus =
  | 'planned'
  | 'active'
  | 'closed'
  | 'archived';

export interface AcademicYear {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: AcademicYearStatus;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicYearRow {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  status: AcademicYearStatus;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AcademicYearActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  fieldErrors?: {
    name?: string[];
    startsOn?: string[];
    endsOn?: string[];
    notes?: string[];
  };
}

export const initialAcademicYearActionState:
AcademicYearActionState = {
  status: 'idle',
  message: null,
};