import type {
  AcademicPeriodStatus,
} from '@/features/academic-periods/types';

import type {
  AutomaticPlannerResult,
} from './planner';
import type {
  PlanningConflictSeverity,
  PlanningConflictType,
  PlanningSession,
  ScheduledSessionConflictState,
  ScheduledSessionSource,
  ScheduledSessionStatus,
} from './types';

export type GeneratorActionStatus =
  | 'idle'
  | 'success'
  | 'error';

export interface GeneratorActionState {
  status: GeneratorActionStatus;
  message: string | null;
  fieldErrors?: {
    academicPeriodId?: string[];
    overwriteExisting?: string[];
  };
  preview?: GeneratorPreview;
}

export interface GeneratorRequest {
  academicPeriodId: string;
  overwriteExisting: boolean;
}

export interface GeneratorAcademicPeriodSummary {
  id: string;
  code: string;
  name: string;
  status: AcademicPeriodStatus;
  startsOn: string;
  endsOn: string;
  teachingStartsOn: string;
  teachingEndsOn: string;
}

export interface GeneratorPreviewSession {
  id: string;

  academicPeriodId: string;

  teachingAllocationId: string;

  sessionNumber: number;

  cohortId: string;
  cohortCode: string;
  cohortName: string;

  unitId: string;
  unitCode: string;
  unitName: string;

  trainerId: string;
  trainerStaffNumber: string;
  trainerName: string;

  roomId: string;
  roomCode: string;
  roomName: string;

  workingDayId: string;
  workingDayName: string;

  startTimeSlotId: string;
  startTimeSlotCode: string;
  startsAt: string;

  endTimeSlotId: string;
  endTimeSlotCode: string;
  endsAt: string;

  durationMinutes: number;

  deliveryMode:
    PlanningSession['deliveryMode'];

  status: ScheduledSessionStatus;
  source: ScheduledSessionSource;
  conflictState:
    ScheduledSessionConflictState;

  isLocked: boolean;
}

export interface GeneratorConflictSummary {
  id: string;
  type: PlanningConflictType;
  severity: PlanningConflictSeverity;
  title: string;
  description: string;
  sessionIds: string[];
  resourceId?: string;
  resourceLabel?: string;
  workingDayId?: string;
  metadata?: Record<
    string,
    string | number | boolean | null
  >;
}

export interface GeneratorUnscheduledSession {
  teachingAllocationId: string;
  sessionNumber: number;

  cohortCode: string | null;
  cohortName: string | null;

  unitCode: string | null;
  unitName: string | null;

  trainerStaffNumber: string | null;
  trainerName: string | null;

  reason:
    | 'allocation_disabled'
    | 'missing_relationship'
    | 'no_working_days'
    | 'no_time_range'
    | 'no_rooms'
    | 'no_valid_placement';

  message: string;

  attemptedCandidateCount: number;

  conflictTypes: string[];
}

export interface GeneratorStatistics {
  allocationCount: number;
  requestedSessionCount: number;
  scheduledSessionCount: number;
  unscheduledSessionCount: number;

  conflictCount: number;
  blockedConflictCount: number;
  warningCount: number;

  trainerUtilizationPercentage: number;
  roomUtilizationPercentage: number;

  generationDurationMilliseconds: number;
}

export interface GeneratorReadinessSummary {
  allocationCount: number;
  workingDayCount: number;
  teachingSlotCount: number;
  trainerCount: number;
  cohortCount: number;
  roomCount: number;
  unitCount: number;
  existingSessionCount: number;

  isReady: boolean;

  issues: string[];
}

export interface GeneratorPreview {
  academicPeriod:
    GeneratorAcademicPeriodSummary;

  readiness:
    GeneratorReadinessSummary;

  sessions: GeneratorPreviewSession[];

  unscheduled:
    GeneratorUnscheduledSession[];

  conflicts:
    GeneratorConflictSummary[];

  statistics: GeneratorStatistics;

  generatedAt: string;
}

export interface GeneratorResponse {
  preview: GeneratorPreview;
}

export interface ExistingScheduledSessionRow {
  id: string;
  academic_period_id: string;
  teaching_allocation_id: string;
  cohort_id: string;
  unit_id: string;
  trainer_id: string;
  working_day_id: string;
  start_time_slot_id: string;
  end_time_slot_id: string;
  room_id: string;
  session_number: number;
  delivery_mode:
    PlanningSession['deliveryMode'];
  status: ScheduledSessionStatus;
  source: ScheduledSessionSource;
  conflict_state:
    ScheduledSessionConflictState;
  is_locked: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GeneratorPlanningData {
  academicPeriod:
    GeneratorAcademicPeriodSummary;

  plannerResult:
    AutomaticPlannerResult;

  readiness:
    GeneratorReadinessSummary;
}

export const initialGeneratorActionState:
GeneratorActionState = {
  status: 'idle',
  message: null,
};