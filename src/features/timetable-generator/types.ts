import type {
  TeachingDeliveryMode,
} from '@/features/teaching-allocations/types';
import type {
  TimeSlotType,
  WeekdayCode,
} from '@/features/timetable-calendar/types';
import type {
  TrainerAvailabilityMode,
} from '@/features/trainers/types';

export type ScheduledSessionStatus =
  | 'draft'
  | 'confirmed'
  | 'locked'
  | 'cancelled'
  | 'archived';

export type ScheduledSessionSource =
  | 'manual'
  | 'generator'
  | 'import'
  | 'reschedule';

export type ScheduledSessionConflictState =
  | 'unchecked'
  | 'clear'
  | 'warning'
  | 'blocked';

export type PlanningConflictSeverity =
  | 'warning'
  | 'error'
  | 'blocked';

export type PlanningConflictType =
  | 'trainer_overlap'
  | 'cohort_overlap'
  | 'room_overlap'
  | 'duplicate_session'
  | 'disabled_working_day'
  | 'disabled_time_slot'
  | 'non_teaching_time_slot'
  | 'academic_period_mismatch'
  | 'invalid_time_range'
  | 'insufficient_room_capacity'
  | 'incompatible_room_type'
  | 'trainer_daily_workload'
  | 'trainer_weekly_workload'
  | 'trainer_unavailable'
  | 'trainer_pending'
  | 'cohort_unavailable'
  | 'room_unavailable'
  | 'unit_unavailable';

export interface PlanningWorkingDay {
  id: string;
  academicPeriodId: string;
  dayOfWeek: WeekdayCode;
  sequenceNumber: number;
  isEnabled: boolean;
}

export interface PlanningTimeSlot {
  id: string;
  academicPeriodId: string;
  code: string;
  name: string;
  slotType: TimeSlotType;
  startsAt: string;
  endsAt: string;
  sequenceNumber: number;
  isEnabled: boolean;
}

export interface PlanningTrainer {
  id: string;
  staffNumber: string;
  fullName: string;
  normalWeeklyHours: number;
  maximumWeeklyHours: number;
  maximumDailyHours: number;
  isActive: boolean;
  isTimetableAvailable: boolean;
  availabilityMode?: TrainerAvailabilityMode;
  availableSlots?: Array<{
    workingDayId: string;
    timeSlotId: string;
  }>;
}

export interface PlanningRoom {
  id: string;
  code: string;
  name: string;
  roomType: string;
  capacity: number;
  isActive: boolean;
  isTimetableAvailable: boolean;
}

export interface PlanningCohort {
  id: string;
  code: string;
  name: string;
  actualSize: number;
  isTimetableAvailable: boolean;
}

export interface PlanningUnit {
  id: string;
  code: string;
  name: string;
  preferredRoomType: string | null;
  isActive: boolean;
  isTimetableAvailable: boolean;
}

export interface PlanningAllocation {
  id: string;
  academicPeriodId: string;
  cohortId: string;
  unitId: string;
  trainerId: string | null;
  preferredRoomId: string | null;
  deliveryMode: TeachingDeliveryMode;
  weeklySessions: number;
  sessionDurationMinutes: number;
  isTimetableEnabled: boolean;
  fixedWorkingDayId?: string | null;
  fixedWorkingDayIds?: string[];
  fixedTimeSlotIds?: string[];
  isFullDaySession?: boolean;
  fixedEndTimeSlotId?: string | null;
  participantCohortIds?: string[];
  combinedCohortSize?: number;
}

export interface PlanningSession {
  id: string;
  academicPeriodId: string;
  teachingAllocationId: string;
  cohortId: string;
  unitId: string;
  trainerId: string | null;
  workingDayId: string;
  startTimeSlotId: string;
  endTimeSlotId: string;
  roomId: string | null;
  sessionNumber: number;
  deliveryMode: TeachingDeliveryMode;
  status: ScheduledSessionStatus;
  source: ScheduledSessionSource;
  conflictState: ScheduledSessionConflictState;
  isLocked: boolean;
  participantCohortIds?: string[];
  combinedCohortSize?: number;
}

export interface ResolvedPlanningSession
  extends PlanningSession {
  workingDay: PlanningWorkingDay;
  startTimeSlot: PlanningTimeSlot;
  endTimeSlot: PlanningTimeSlot;
  trainer: PlanningTrainer;
  cohort: PlanningCohort;
  room: PlanningRoom | null;
  unit: PlanningUnit;
}

export interface PlanningConflict {
  id: string;
  type: PlanningConflictType;
  severity: PlanningConflictSeverity;
  message: string;
  sessionIds: string[];
  resourceId?: string;
  resourceLabel?: string;
  workingDayId?: string;
  metadata?: Record<
    string,
    string | number | boolean | null
  >;
}

export interface PlanningSuggestion {
  id: string;
  conflictId: string;
  type:
    | 'move_session'
    | 'change_room'
    | 'change_trainer'
    | 'change_day'
    | 'change_time'
    | 'split_session';
  message: string;
  score: number;
  proposedWorkingDayId?: string;
  proposedStartTimeSlotId?: string;
  proposedEndTimeSlotId?: string;
  proposedRoomId?: string;
  proposedTrainerId?: string;
}

export interface PlanningStatistics {
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

export interface PlanningResult {
  sessions: PlanningSession[];
  conflicts: PlanningConflict[];
  suggestions: PlanningSuggestion[];
  statistics: PlanningStatistics;
}

export interface TimeInterval {
  startsAt: string;
  endsAt: string;
}

export interface MinuteInterval {
  startMinutes: number;
  endMinutes: number;
}
