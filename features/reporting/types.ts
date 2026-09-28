export type ReportingPillar =
  | 'overview'
  | 'workload'
  | 'allocations'
  | 'assessments'
  | 'registration'
  | 'attendance'
  | 'documents';

export interface TrainerWorkloadReportItem {
  trainerId: string;
  trainerName: string;
  role: string;
  normalTargetHours: number;
  allocatedHours: number;
  scheduledHours: number;
  allocatedUnitsCount: number;
  workloadStatus: 'optimal' | 'underload' | 'overload';
  allocatedUnitCodes: string[];
}

export interface TeachingAllocationsReportItem {
  id: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  cohortId: string;
  cohortName: string;
  trainerId: string | null;
  trainerName: string | null;
  weeklyHours: number;
  status: 'allocated' | 'unallocated' | 'co_taught';
  isCrossDepartment: boolean;
  participantCohortNames: string[];
}

export interface AssessmentCompletionReportItem {
  id: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  populationCount: number;
  isPopulationLocked: boolean;
  isCatFinalized: boolean;
  isExamFinalized: boolean;
  isPublished: boolean;
  marksSource: 'excel' | 'online' | 'mixed' | 'pending';
  missingMarksCount: number;
  satCount: number;
  absentCount: number;
  completionRate: number; // percentage
}

export interface RegistrationCompletionReportItem {
  cohortId: string;
  cohortCode: string;
  cohortName: string;
  programmeName: string;
  stageName: string;
  eligibleStudentCount: number;
  preRegisteredCount: number;
  confirmedCount: number;
  totalRegisteredCount: number;
  registrationRate: number; // percentage
  expectedUnitsCount: number;
}

export interface AttendanceReportItem {
  unitId: string;
  unitCode: string;
  unitName: string;
  cohortName: string;
  trainerName: string;
  totalSessionsScheduled: number;
  completedSessions: number;
  openSessions: number;
  completionRate: number; // percentage
  totalPresentCount: number;
  totalAbsentCount: number;
  averageAttendanceRate: number; // percentage
}

export interface TeachingDocumentComplianceReportItem {
  allocationId: string;
  unitCode: string;
  unitName: string;
  cohortName: string;
  trainerName: string;
  attendanceSheetStatus: 'draft' | 'submitted' | 'approved' | 'not_started';
  courseOutlineStatus: 'draft' | 'submitted' | 'approved' | 'not_started';
  schemeOfWorkStatus: 'draft' | 'submitted' | 'approved' | 'not_started';
  recordOfWorkStatus: 'draft' | 'submitted' | 'approved' | 'not_started';
  approvedCount: number;
  totalRequired: number;
  complianceRate: number; // percentage
}

export interface ExecutiveReportSummary {
  trainerWorkload: {
    totalTrainers: number;
    optimalCount: number;
    underloadCount: number;
    overloadCount: number;
    totalWeeklyHours: number;
    averageWeeklyHours: number;
  };
  teachingAllocations: {
    totalOfferings: number;
    allocatedCount: number;
    unallocatedCount: number;
    allocationRate: number; // percentage
  };
  assessments: {
    totalMarkbooks: number;
    rosterLockedCount: number;
    finalisedCount: number;
    publishedCount: number;
    totalMissingMarks: number;
    completionRate: number; // percentage
  };
  registration: {
    totalCohorts: number;
    eligibleStudents: number;
    registeredStudents: number;
    registrationRate: number; // percentage
  };
  attendance: {
    totalSessions: number;
    completedSessions: number;
    sessionCompletionRate: number; // percentage
    averageStudentAttendanceRate: number; // percentage
  };
  documents: {
    totalRequired: number;
    approvedCount: number;
    submittedCount: number;
    draftCount: number;
    complianceRate: number; // percentage
  };
}

export interface DepartmentExecutiveReportData {
  periods: Array<{ id: string; code: string; name: string; status: string }>;
  selectedPeriodId: string;
  selectedPeriodName: string;
  departmentName: string;
  generatedAt: string;
  summary: ExecutiveReportSummary;
  workload: TrainerWorkloadReportItem[];
  allocations: TeachingAllocationsReportItem[];
  assessments: AssessmentCompletionReportItem[];
  registration: RegistrationCompletionReportItem[];
  attendance: AttendanceReportItem[];
  documents: TeachingDocumentComplianceReportItem[];
}
