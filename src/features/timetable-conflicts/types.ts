export type ConflictSeverity = 'blocked' | 'error' | 'warning';
export type ConflictKind =
  | 'trainer_overlap'
  | 'trainer_availability'
  | 'trainer_pending'
  | 'trainer_daily_workload'
  | 'trainer_weekly_workload'
  | 'cohort_overlap'
  | 'room_overlap'
  | 'room_pending'
  | 'room_capacity'
  | 'hard_constraint'
  | 'soft_constraint'
  | 'session_state';

export interface ConflictSession {
  id: string;
  teachingAllocationId: string;
  cohortId: string;
  cohortName: string;
  cohortSize: number;
  participantCohortIds: string[];
  combinedCohortSize: number;
  unitId: string;
  unitCode: string;
  unitName: string;
  trainerId: string | null;
  trainerName: string;
  trainerAvailabilityMode: 'generally_available' | 'selected_slots_only';
  trainerNormalWeeklyHours: number;
  trainerMaximumWeeklyHours: number;
  trainerMaximumDailyHours: number;
  roomId: string | null;
  roomCode: string | null;
  roomName: string;
  roomCapacity: number;
  workingDayId: string;
  workingDayLabel: string;
  startTimeSlotId: string;
  startTime: string;
  endTimeSlotId: string;
  endTime: string;
  status: string;
  conflictState: string;
  isLocked: boolean;
  isFullDaySession: boolean;
}

export interface ConflictConstraint {
  id: string;
  subjectType: 'trainer' | 'room' | 'cohort' | 'institution';
  subjectId: string | null;
  constraintType: 'unavailable' | 'preferred' | 'required' | 'protected_day';
  workingDayId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  priority: 'hard' | 'soft';
  reason: string;
}

export interface ConflictReview {
  conflictKey: string;
  status: 'acknowledged' | 'resolved' | 'reopened';
  resolutionNote: string | null;
  updatedAt: string;
}

export interface ConflictTrainerAvailability {
  trainerId: string;
  workingDayId: string;
  timeSlotId: string;
}

export interface ConflictTimeSlot {
  id: string;
  sequenceNumber: number;
  slotType: string;
  isEnabled: boolean;
}

export interface ConflictAvailabilityContext {
  availableSlots: ConflictTrainerAvailability[];
  timeSlots: ConflictTimeSlot[];
}

export interface TimetableConflict {
  key: string;
  kind: ConflictKind;
  severity: ConflictSeverity;
  title: string;
  message: string;
  sessionIds: string[];
  resourceLabel: string;
  workingDayLabel: string;
  timeLabel: string;
  isLocked: boolean;
  review: ConflictReview | null;
}

export interface ConflictCenterData {
  conflicts: TimetableConflict[];
  sessions: ConflictSession[];
  summary: {
    total: number;
    blocked: number;
    errors: number;
    warnings: number;
    acknowledged: number;
    resolved: number;
  };
}
