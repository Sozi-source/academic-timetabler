export type TeachingDeliveryMode =
  | 'theory'
  | 'practical'
  | 'clinical'
  | 'blended'
  | 'project'
  | 'other';

export type TeachingAllocationStatus =
  | 'draft'
  | 'active'
  | 'suspended'
  | 'completed'
  | 'archived';

export interface AllocationAcademicPeriodSummary {
  id: string;
  code: string;
  name: string;
  status: string;
  startsOn: string;
  endsOn: string;
}

export interface AllocationCohortSummary {
  id: string;
  programmeId: string;
  code: string;
  name: string;
  actualSize: number;
  currentAcademicPeriodNumber: number;
  status: string;
  isTimetableAvailable: boolean;
}

export interface AllocationUnitSummary {
  id: string;
  programmeId: string;
  code: string;
  name: string;
  academicPeriodNumber: number;
  theoryHours: number;
  practicalHours: number;
  weeklySessions: number;
  preferredRoomType: string | null;
  isActive: boolean;
  isTimetableAvailable: boolean;
}

export interface AllocationTrainerSummary {
  id: string;
  staffNumber: string;
  fullName: string;
  maximumWeeklyHours: number;
  maximumDailyHours: number;
  isActive: boolean;
  isTimetableAvailable: boolean;
}

export interface AllocationRoomSummary {
  id: string;
  code: string;
  name: string;
  roomType: string;
  capacity: number;
  isActive: boolean;
  isTimetableAvailable: boolean;
}

export interface TeachingAllocation {
  id: string;
  academicPeriodId: string;
  cohortId: string;
  unitId: string;
  trainerId: string;
  preferredRoomId: string | null;
  deliveryMode: TeachingDeliveryMode;
  weeklySessions: number;
  sessionDurationMinutes: number;
  status: TeachingAllocationStatus;
  isTimetableEnabled: boolean;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  academicPeriod:
    | AllocationAcademicPeriodSummary
    | null;
  cohort: AllocationCohortSummary | null;
  unit: AllocationUnitSummary | null;
  trainer: AllocationTrainerSummary | null;
  preferredRoom: AllocationRoomSummary | null;
}

interface AcademicPeriodRelationRow {
  id: string;
  code: string;
  name: string;
  status: string;
  starts_on: string;
  ends_on: string;
}

interface CohortRelationRow {
  id: string;
  programme_id: string;
  code: string;
  name: string;
  actual_size: number;
  current_academic_period_number: number;
  status: string;
  is_timetable_available: boolean;
}

interface UnitRelationRow {
  id: string;
  programme_id: string;
  code: string;
  name: string;
  academic_period_number: number;
  theory_hours: number | string;
  practical_hours: number | string;
  weekly_sessions: number;
  preferred_room_type: string | null;
  is_active: boolean;
  is_timetable_available: boolean;
}

interface TrainerRelationRow {
  id: string;
  staff_number: string;
  full_name: string;
  maximum_weekly_hours: number | string;
  maximum_daily_hours: number | string;
  is_active: boolean;
  is_timetable_available: boolean;
}

interface RoomRelationRow {
  id: string;
  code: string;
  name: string;
  room_type: string;
  capacity: number;
  is_active: boolean;
  is_timetable_available: boolean;
}

export interface TeachingAllocationRow {
  id: string;
  academic_period_id: string;
  cohort_id: string;
  unit_id: string;
  trainer_id: string;
  preferred_room_id: string | null;
  delivery_mode: TeachingDeliveryMode;
  weekly_sessions: number;
  session_duration_minutes: number;
  status: TeachingAllocationStatus;
  is_timetable_enabled: boolean;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;

  academic_periods:
    | AcademicPeriodRelationRow
    | AcademicPeriodRelationRow[]
    | null;

  cohorts:
    | CohortRelationRow
    | CohortRelationRow[]
    | null;

  units:
    | UnitRelationRow
    | UnitRelationRow[]
    | null;

  trainers:
    | TrainerRelationRow
    | TrainerRelationRow[]
    | null;

  rooms:
    | RoomRelationRow
    | RoomRelationRow[]
    | null;
}

export interface TeachingAllocationActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  fieldErrors?: {
    academicPeriodId?: string[];
    cohortId?: string[];
    unitId?: string[];
    trainerId?: string[];
    preferredRoomId?: string[];
    deliveryMode?: string[];
    weeklySessions?: string[];
    sessionDurationMinutes?: string[];
    status?: string[];
    notes?: string[];
  };
}

export interface TrainerWorkloadSummary {
  trainerId: string;
  maximumWeeklyHours: number;
  allocatedWeeklyHours: number;
  remainingWeeklyHours: number;
  utilizationPercentage: number;
}

export const initialTeachingAllocationActionState:
TeachingAllocationActionState = {
  status: 'idle',
  message: null,
};

export const teachingDeliveryModeOptions: Array<{
  value: TeachingDeliveryMode;
  label: string;
}> = [
  {
    value: 'theory',
    label: 'Theory',
  },
  {
    value: 'practical',
    label: 'Practical',
  },
  {
    value: 'clinical',
    label: 'Clinical',
  },
  {
    value: 'blended',
    label: 'Blended',
  },
  {
    value: 'project',
    label: 'Project',
  },
  {
    value: 'other',
    label: 'Other',
  },
];

export const teachingAllocationStatusOptions: Array<{
  value: TeachingAllocationStatus;
  label: string;
  description: string;
}> = [
  {
    value: 'draft',
    label: 'Draft',
    description:
      'Prepared allocation awaiting final confirmation.',
  },
  {
    value: 'active',
    label: 'Active',
    description:
      'Confirmed allocation ready for timetable generation.',
  },
  {
    value: 'suspended',
    label: 'Suspended',
    description:
      'Temporarily excluded from timetable generation.',
  },
  {
    value: 'completed',
    label: 'Completed',
    description:
      'Teaching requirements have been completed.',
  },
  {
    value: 'archived',
    label: 'Archived',
    description:
      'Retained for historical workload and timetable records.',
  },
];