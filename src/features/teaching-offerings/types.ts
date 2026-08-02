import type {
  AcademicPeriod,
} from '@/features/academic-periods/types';
import type {
  Cohort,
} from '@/features/cohorts/types';
import type {
  Room,
} from '@/features/rooms/types';
import type {
  TeachingAllocationStatus,
  TeachingDeliveryMode,
} from '@/features/teaching-allocations/types';
import type {
  Trainer,
} from '@/features/trainers/types';
import type {
  Unit,
} from '@/features/units/types';

export interface TeachingOffering {
  id: string;
  academicPeriodId: string;

  title: string;
  normalizedTitle: string;

  trainerId: string | null;
  preferredRoomId: string | null;

  deliveryMode: TeachingDeliveryMode;
  weeklySessions: number;
  sessionDurationMinutes: number;

  status: TeachingAllocationStatus;
  isTimetableEnabled: boolean;

  legacyTeachingAllocationId:
    string | null;

  notes: string | null;

  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;

  academicPeriod?:
    AcademicPeriod | null;

  trainer?:
    Trainer | null;

  preferredRoom?:
    Room | null;

  participants?:
    TeachingOfferingParticipant[];
}

export interface TeachingOfferingParticipant {
  id: string;

  teachingOfferingId: string;
  cohortId: string;
  unitId: string;

  isPrimary: boolean;
  notes: string | null;

  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;

  cohort?: Cohort | null;
  unit?: Unit | null;
}

export interface TeachingOfferingRow {
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
}

export interface TeachingOfferingParticipantRow {
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
}

export interface TeachingOfferingParticipantInput {
  cohortId: string;
  unitId: string;
  isPrimary?: boolean;
  notes?: string | null;
}

export interface TeachingOfferingInput {
  academicPeriodId: string;

  title: string;

  trainerId: string | null;
  preferredRoomId: string | null;

  deliveryMode: TeachingDeliveryMode;
  weeklySessions: number;
  sessionDurationMinutes: number;

  status: TeachingAllocationStatus;
  isTimetableEnabled: boolean;

  notes: string | null;

  participants:
    TeachingOfferingParticipantInput[];
}

export interface TeachingOfferingProgrammeSummary {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  awardLevel: string;
}

export interface TeachingOfferingCohortSummary {
  id: string;
  programmeId: string;
  code: string;
  name: string;
  intakeDate: string;
  currentAcademicPeriodNumber: number;
  plannedSize: number;
  actualSize: number;
  programme:
    TeachingOfferingProgrammeSummary | null;
}

export interface TeachingOfferingUnitSummary {
  id: string;
  programmeId: string;
  code: string;
  name: string;
  shortName: string | null;
  academicPeriodNumber: number;
  preferredRoomType: string | null;
  programme:
    TeachingOfferingProgrammeSummary | null;
}

export interface TeachingOfferingParticipantDetail
  extends Omit<
    TeachingOfferingParticipant,
    'cohort' | 'unit'
  > {
  cohort:
    TeachingOfferingCohortSummary | null;
  unit:
    TeachingOfferingUnitSummary | null;
}

export interface TeachingOfferingDetail
  extends Omit<
    TeachingOffering,
    'participants'
  > {
  participants:
    TeachingOfferingParticipantDetail[];

  participantCount: number;
  combinedCohortSize: number;
  isShared: boolean;

  programmeNames: string[];
  cohortNames: string[];
  unitNames: string[];
  unitCodes: string[];

  trainerName: string | null;
  trainerStaffNumber: string | null;

  preferredRoomName: string | null;
  preferredRoomCode: string | null;
}
export interface TeachingOfferingSummary {
  id: string;
  academicPeriodId: string;

  title: string;

  trainerId: string | null;
  trainerName: string | null;

  preferredRoomId: string | null;
  preferredRoomName: string | null;

  deliveryMode: TeachingDeliveryMode;
  weeklySessions: number;
  sessionDurationMinutes: number;

  status: TeachingAllocationStatus;
  isTimetableEnabled: boolean;

  participantCount: number;
  combinedCohortSize: number;

  cohortNames: string[];
  programmeNames: string[];
  unitNames: string[];
  unitCodes: string[];
}

export interface TeachingOfferingActionState {
  status:
    | 'idle'
    | 'success'
    | 'error';

  message: string | null;

  fieldErrors?: {
    academicPeriodId?: string[];
    title?: string[];
    trainerId?: string[];
    preferredRoomId?: string[];
    deliveryMode?: string[];
    weeklySessions?: string[];
    sessionDurationMinutes?: string[];
    status?: string[];
    notes?: string[];
    participants?: string[];
  };
}

export const initialTeachingOfferingActionState:
TeachingOfferingActionState = {
  status: 'idle',
  message: null,
};