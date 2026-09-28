import type {
  TeachingAllocationStatus,
  TeachingDeliveryMode,
} from '@/features/teaching-allocations/types';

export interface OfferingAcademicPeriodRelation {
  id: string;
  code: string;
  name: string;
  status: string;
  starts_on: string;
  ends_on: string;
}

export interface OfferingTrainerRelation {
  id: string;
  staff_number: string;
  full_name: string;
  maximum_weekly_hours: number;
  maximum_daily_hours: number;
  is_active: boolean;
  is_timetable_available: boolean;
}

export interface OfferingRoomRelation {
  id: string;
  code: string;
  name: string;
  room_type: string;
  capacity: number;
  is_active: boolean;
  is_timetable_available: boolean;
}

export interface OfferingProgrammeRelation {
  id: string;
  code: string;
  name: string;
  short_name: string | null;
  award_level: string;
  total_academic_periods: number;
  is_active: boolean;
  is_timetable_available: boolean;
}

export interface OfferingCohortRelation {
  id: string;
  programme_id: string;
  code: string;
  name: string;
  intake_date: string;
  current_academic_period_number: number;
  planned_size: number;
  actual_size: number;
  status: string;
  is_timetable_available: boolean;
  programmes:
    | OfferingProgrammeRelation
    | OfferingProgrammeRelation[]
    | null;
}

export interface OfferingUnitRelation {
  id: string;
  programme_id: string;
  code: string;
  name: string;
  short_name: string | null;
  academic_period_number: number;
  preferred_room_type: string | null;
  is_active: boolean;
  is_timetable_available: boolean;
  programmes:
    | OfferingProgrammeRelation
    | OfferingProgrammeRelation[]
    | null;
}

export interface TeachingOfferingParticipantQueryRow {
  id: string;
  teaching_offering_id: string;
  cohort_id: string;
  unit_id: string;
  is_primary: boolean;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;

  cohorts:
    | OfferingCohortRelation
    | OfferingCohortRelation[]
    | null;

  units:
    | OfferingUnitRelation
    | OfferingUnitRelation[]
    | null;
}

export interface TeachingOfferingQueryRow {
  id: string;
  academic_period_id: string;
  title: string;
  normalized_title: string;
  trainer_id: string | null;
  preferred_room_id: string | null;
  delivery_mode: TeachingDeliveryMode;
  weekly_sessions: number;
  session_duration_minutes: number;
  status: TeachingAllocationStatus;
  is_timetable_enabled: boolean;
  legacy_teaching_allocation_id:
    string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;

  academic_periods:
    | OfferingAcademicPeriodRelation
    | OfferingAcademicPeriodRelation[]
    | null;

  trainers:
    | OfferingTrainerRelation
    | OfferingTrainerRelation[]
    | null;

  rooms:
    | OfferingRoomRelation
    | OfferingRoomRelation[]
    | null;

  teaching_offering_participants:
    TeachingOfferingParticipantQueryRow[];
}