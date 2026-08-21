export interface StaffAssessmentSummary {
  assessmentId: string;
  type:
    | 'cat'
    | 'exam';
  workflowStatus: string;
  registered: number;
  absent: number;
  expected: number;
  maximumMark: number | null;
  passMark: number | null;
  rosterLocked: boolean;
  published: boolean;
}

export interface StaffUnitAllocation {
  allocationId: string;
  academicPeriodId: string;
  academicPeriodName: string;
  cohortId: string;
  cohortName: string;
  unitId: string;
  unitName: string;
  allocationStatus: string;
  cat: StaffAssessmentSummary | null;
  exam: StaffAssessmentSummary | null;
}

export interface StaffWorkspace {
  trainerId: string;
  trainerName: string;
  trainerEmail: string | null;
  allocations: StaffUnitAllocation[];
}
