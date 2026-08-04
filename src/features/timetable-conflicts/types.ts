export type ConflictSeverity = 'blocked' | 'error' | 'warning';
export type ConflictKind =
  | 'trainer_overlap'
  | 'cohort_overlap'
  | 'room_overlap'
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
  unitId: string;
  unitCode: string;
  unitName: string;
  trainerId: string;
  trainerName: string;
  roomId: string;
  roomCode: string;
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
