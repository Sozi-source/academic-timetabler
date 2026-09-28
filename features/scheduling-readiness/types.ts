export type ReadinessSeverity = 'blocker' | 'warning' | 'info';

export interface ReadinessIssue {
  id: string;
  severity: ReadinessSeverity;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}

export interface ReadinessParticipant {
  id: string;
  cohortId: string;
  cohortCode: string;
  cohortName: string;
  cohortSize: number;
  cohortStatus: string;
  cohortTimetableAvailable: boolean;
  unitId: string;
  unitCode: string;
  unitName: string;
  unitActive: boolean;
  unitTimetableAvailable: boolean;
}

export interface ReadinessOffering {
  id: string;
  academicPeriodId: string;
  title: string;
  sharedClassKey: string | null;
  trainerId: string | null;
  trainerName: string | null;
  trainerStaffNumber: string | null;
  trainerActive: boolean | null;
  trainerTimetableAvailable: boolean | null;
  trainerMaximumWeeklyHours: number | null;
  preferredRoomId: string | null;
  preferredRoomName: string | null;
  preferredRoomCode: string | null;
  preferredRoomType: string | null;
  preferredRoomCapacity: number | null;
  preferredRoomActive: boolean | null;
  preferredRoomTimetableAvailable: boolean | null;
  deliveryMode: string;
  weeklySessions: number;
  sessionDurationMinutes: number;
  status: string;
  isTimetableEnabled: boolean;
  isProvisionalReservation: boolean;
  participants: ReadinessParticipant[];
}

export interface ReadinessTrainerOption {
  id: string;
  label: string;
  maximumWeeklyHours: number;
}

export interface ReadinessRoomOption {
  id: string;
  label: string;
  roomType: string;
  capacity: number;
}

export interface TrainerReadinessWorkload {
  trainerId: string;
  trainerName: string;
  staffNumber: string;
  maximumWeeklyHours: number;
  allocatedWeeklyHours: number;
  remainingWeeklyHours: number;
  extraWeeklyHours: number;
  utilizationPercentage: number;
  overloaded: boolean;
}

export interface SchedulingReadiness {
  academicPeriodId: string;
  academicPeriodName: string;
  academicPeriodCode: string;
  academicPeriodStatus: string;
  score: number;
  isReady: boolean;
  blockerCount: number;
  warningCount: number;
  offeringCount: number;
  enabledOfferingCount: number;
  sharedOfferingCount: number;
  participantCount: number;
  assignedTrainerCount: number;
  preferredRoomCount: number;
  workingDayCount: number;
  teachingSlotCount: number;
  availableTrainerCount: number;
  availableRoomCount: number;
  requestedWeeklySessions: number;
  requestedWeeklyHours: number;
  issues: ReadinessIssue[];
  offerings: ReadinessOffering[];
  trainerWorkloads: TrainerReadinessWorkload[];
  trainerOptions: ReadinessTrainerOption[];
  roomOptions: ReadinessRoomOption[];
}
