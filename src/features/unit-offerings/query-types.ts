import type {
  UnitOfferingOrigin,
  UnitOfferingApprovalStatus,
  UnitOfferingSelectionState,
  UnitOfferingStatus,
  UnitOfferingType,
} from './types';

export interface UnitOfferingProgrammeRelation {
  id: string;
  code: string;
  name: string;
  short_name: string | null;
  award_level: string;
  total_academic_periods: number;
}

export interface UnitOfferingAcademicPeriodRelation {
  id: string;
  code: string;
  name: string;
  status: string;
  starts_on: string;
  ends_on: string;
}

export interface UnitOfferingCohortRelation {
  id: string;
  programme_id: string;
  code: string;
  name: string;
  intake_date: string;
  expected_completion_date: string;
  current_academic_period_number: number;
  planned_size: number;
  actual_size: number;
  status: string;
  is_timetable_available: boolean;

  programmes:
    | UnitOfferingProgrammeRelation
    | UnitOfferingProgrammeRelation[]
    | null;
}

export interface UnitOfferingUnitRelation {
  id: string;
  programme_id: string;
  code: string;
  name: string;
  short_name: string | null;
  category: string;
  academic_period_number: number;
  theory_hours: number | string;
  practical_hours: number | string;
  weekly_sessions: number;
  preferred_room_type: string | null;
  is_active: boolean;
  is_timetable_available: boolean;

  programmes:
    | UnitOfferingProgrammeRelation
    | UnitOfferingProgrammeRelation[]
    | null;
}

export interface UnitOfferingQueryRow {
  id: string;

  academic_period_id: string;
  cohort_id: string;
  unit_id: string;

  offering_type: UnitOfferingType;
  status: UnitOfferingStatus;
  is_timetable_enabled: boolean;

  weekly_sessions: number | null;
  session_duration_minutes:
    number | null;

  delivery_notes: string | null;
  source: string;

  origin: UnitOfferingOrigin;
  selection_state:
    UnitOfferingSelectionState;
  approval_status: UnitOfferingApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  withdrawn_by: string | null;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;

  recommended_stage_number:
    number | null;

  exception_reason: string | null;

  manually_reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;

  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;

  academic_periods:
    | UnitOfferingAcademicPeriodRelation
    | UnitOfferingAcademicPeriodRelation[]
    | null;

  cohorts:
    | UnitOfferingCohortRelation
    | UnitOfferingCohortRelation[]
    | null;

  units:
    | UnitOfferingUnitRelation
    | UnitOfferingUnitRelation[]
    | null;
}
