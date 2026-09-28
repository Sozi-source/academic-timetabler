export type UnitOfferingType =
  | 'classroom'
  | 'practical'
  | 'clinical_rotation'
  | 'attachment'
  | 'project'
  | 'examination'
  | 'other';

export type UnitOfferingStatus =
  | 'draft'
  | 'active'
  | 'completed'
  | 'cancelled';

export type UnitOfferingOrigin =
  | 'curriculum'
  | 'special'
  | 'import'
  | 'legacy';

export type UnitOfferingSelectionState =
  | 'included'
  | 'excluded';

export type UnitOfferingApprovalStatus =
  | 'review_required'
  | 'approved'
  | 'withdrawn';

export interface UnitOfferingProgrammeSummary {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  awardLevel: string;
  totalAcademicPeriods: number;
}

export interface UnitOfferingAcademicPeriodSummary {
  id: string;
  code: string;
  name: string;
  status: string;
  startsOn: string;
  endsOn: string;
}

export interface UnitOfferingCohortSummary {
  id: string;
  programmeId: string;
  code: string;
  name: string;
  intakeDate: string;
  expectedCompletionDate: string;
  currentAcademicPeriodNumber: number;
  plannedSize: number;
  actualSize: number;
  status: string;
  isTimetableAvailable: boolean;
  programme:
    UnitOfferingProgrammeSummary | null;
}

export interface UnitOfferingUnitSummary {
  id: string;
  programmeId: string;
  code: string;
  name: string;
  shortName: string | null;
  category: string;
  academicPeriodNumber: number;
  theoryHours: number;
  practicalHours: number;
  weeklySessions: number;
  preferredRoomType: string | null;
  isActive: boolean;
  isTimetableAvailable: boolean;
  programme:
    UnitOfferingProgrammeSummary | null;
}

export interface UnitOffering {
  id: string;

  academicPeriodId: string;
  cohortId: string;
  unitId: string;

  offeringType: UnitOfferingType;
  status: UnitOfferingStatus;
  isTimetableEnabled: boolean;

  weeklySessions: number | null;
  sessionDurationMinutes: number | null;

  deliveryNotes: string | null;
  source: string;

  origin: UnitOfferingOrigin;
  selectionState:
    UnitOfferingSelectionState;
  approvalStatus: UnitOfferingApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  withdrawnBy: string | null;
  withdrawnAt: string | null;
  withdrawalReason: string | null;

  recommendedStageNumber: number | null;
  exceptionReason: string | null;

  manuallyReviewed: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;

  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;

  academicPeriod:
    UnitOfferingAcademicPeriodSummary | null;

  cohort:
    UnitOfferingCohortSummary | null;

  unit:
    UnitOfferingUnitSummary | null;
}

export interface UnitOfferingRow {
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
}

export interface CurriculumOfferingRefreshResult {
  recommendedCount: number;
  insertedCount: number;
  existingCount: number;
}

export interface UnitOfferingActionState {
  status:
    | 'idle'
    | 'success'
    | 'error';

  message: string | null;

  fieldErrors?: {
    academicPeriodId?: string[];
    cohortId?: string[];
    unitId?: string[];
    unitOfferingId?: string[];
    selectionState?: string[];
    reason?: string[];
  };
}

export const initialUnitOfferingActionState:
UnitOfferingActionState = {
  status: 'idle',
  message: null,
};

export const unitOfferingTypeOptions: Array<{
  value: UnitOfferingType;
  label: string;
}> = [
  {
    value: 'classroom',
    label: 'Classroom',
  },
  {
    value: 'practical',
    label: 'Practical',
  },
  {
    value: 'clinical_rotation',
    label: 'Clinical rotation',
  },
  {
    value: 'attachment',
    label: 'Attachment',
  },
  {
    value: 'project',
    label: 'Project',
  },
  {
    value: 'examination',
    label: 'Examination',
  },
  {
    value: 'other',
    label: 'Other',
  },
];
