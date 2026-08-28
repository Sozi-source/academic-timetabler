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

export interface TimetableGenerationRunSummary {
  id: string;
  academicPeriodId: string;
  status: 'draft' | 'completed' | 'completed_with_issues' | 'failed';
  requestedSessionCount: number;
  scheduledSessionCount: number;
  unscheduledSessionCount: number;
  conflictCount: number;
  lockedSessionCount: number;
  createdAt: string;
}

export interface GeneratorPersistActionState {
  status: GeneratorActionStatus;
  message: string | null;
  generationRunId?: string;
  savedSessionCount?: number;
  lockedSessionCount?: number;
  unscheduledSessionCount?: number;
}

export interface GeneratorExchangeActionState {
  status: GeneratorActionStatus;
  message: string | null;
  preview?: GeneratorPreview;
  academicPeriodId?: string;
  targetTeachingAllocationId?: string;
  targetSessionNumber?: number;
  partnerTeachingAllocationId?: string;
  requiresTimetableReopen?: boolean;
}

export interface GeneratorDraftLifecycleActionState {
  status: GeneratorActionStatus;
  message: string | null;
  academicPeriodId?: string;
  reopenedVersionCount?: number;
  archivedPublishedVersionCount?: number;
}

export interface GeneratorResetActionState {
  status: GeneratorActionStatus;
  message: string | null;
  academicPeriodId?: string;
}

export interface GeneratorProtectedTimetableSummary {
  id: string;
  versionNumber: number;
  status: 'under_review' | 'approved' | 'published';
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

  trainerId: string | null;
  trainerStaffNumber: string | null;
  trainerName: string;

  roomId: string | null;
  roomCode: string | null;
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

  blockers: Array<{
    type: string;
    cause: string;
    suggestion: string;
    rejectedCandidateCount: number;
    candidateWindows: string[];
  }>;

  exchangeSuggestions:
    GeneratorExchangeSuggestion[];
}

export interface GeneratorExchangeSuggestion {
  id: string;
  targetTeachingAllocationId: string;
  targetSessionNumber: number;
  partnerTeachingAllocationId: string;
  targetTrainerId: string;
  targetTrainerName: string;
  partnerTrainerId: string;
  partnerTrainerName: string;
  partnerUnitCode: string;
  partnerUnitName: string;
  partnerCohortCode: string;
  durationMinutes: number;
  resolvedSessionCount: number;
  remainingUnscheduledCount: number;
  warningCount: number;
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

  workingDays: Array<{
    id: string;
    name: string;
    sequenceNumber: number;
  }>;

  teachingSlots: Array<{
    id: string;
    code: string;
    name: string;
    startsAt: string;
    endsAt: string;
    sequenceNumber: number;
  }>;

  unscheduled:
    GeneratorUnscheduledSession[];

  conflicts:
    GeneratorConflictSummary[];

  statistics: GeneratorStatistics;

  exchangeSuggestionsEvaluated?: boolean;

  protectedTimetable?:
    GeneratorProtectedTimetableSummary | null;

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
  trainer_id: string | null;
  working_day_id: string;
  start_time_slot_id: string;
  end_time_slot_id: string;
  room_id: string | null;
  session_number: number;
  delivery_mode:
    PlanningSession['deliveryMode'];
  status: ScheduledSessionStatus;
  source: ScheduledSessionSource;
  conflict_state:
    ScheduledSessionConflictState;
  is_locked: boolean;
  is_external?: boolean;
  participant_cohort_ids: string[];
  combined_cohort_size: number;
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
export const initialGeneratorPersistActionState: GeneratorPersistActionState = {
  status: 'idle',
  message: null,
};

export const initialGeneratorExchangeActionState: GeneratorExchangeActionState = {
  status: 'idle',
  message: null,
};

export const initialGeneratorDraftLifecycleActionState:
GeneratorDraftLifecycleActionState = {
  status: 'idle',
  message: null,
};

export const initialGeneratorResetActionState: GeneratorResetActionState = {
  status: 'idle',
  message: null,
};
