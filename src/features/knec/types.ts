export type KnecModuleStatus = 'completed' | 'booked' | 'resit' | 'pending' | 'exempt';

export type KnecExamSeriesStatus =
  | 'planned'
  | 'booking_open'
  | 'booking_closed'
  | 'in_progress'
  | 'results_released'
  | 'archived';

export type KnecBookingStatus =
  | 'draft'
  | 'submitted'
  | 'hod_cleared'
  | 'registered_knec'
  | 'sat'
  | 'results_recorded'
  | 'cancelled';

export type KnecPaperResultStatus =
  | 'booked'
  | 'sat'
  | 'passed'
  | 'referred'
  | 'absent'
  | 'cancelled';

export type KnecOverallCompletionStatus =
  | 'completed'
  | 'resit_pending'
  | 'booked'
  | 'in_progress'
  | 'not_started';

export interface KnecPaperItem {
  id: string;
  moduleId: string;
  moduleCode: string;
  paperCode: string;
  paperNumber: string;
  paperName: string;
  paperType: 'theory' | 'practice' | 'trade_project' | 'coursework';
  sortOrder: number;
}

export interface KnecModuleItem {
  id: string;
  courseFamily: string;
  moduleCode: string;
  moduleNumber: number;
  title: string;
  sequenceOrder: number;
  requirementRole: 'core' | 'prerequisite_cert' | 'transition_core';
  papers: KnecPaperItem[];
}

export interface KnecExamSeriesItem {
  id: string;
  seriesCode: string;
  seriesName: string;
  seriesMonth: string;
  seriesYear: number;
  status: KnecExamSeriesStatus;
  bookingOpensOn: string | null;
  bookingClosesOn: string | null;
  notes: string | null;
}

export interface KnecBookingPaperRecord {
  id: string;
  bookingId: string;
  moduleId: string;
  moduleCode: string;
  paperId: string | null;
  paperCode: string;
  paperName: string;
  isResit: boolean;
  paperStatus: KnecPaperResultStatus;
  grade: string | null;
  remarks: string | null;
}

export interface KnecBookingRecord {
  id: string;
  studentId: string;
  seriesId: string;
  seriesName: string;
  seriesCode: string;
  seriesYear: number;
  seriesMonth: string;
  seriesStatus: KnecExamSeriesStatus;
  knecIndexNumber: string | null;
  bookingType: 'normal' | 'resit' | 'mixed' | 'historical';
  bookingStatus: KnecBookingStatus;
  clearanceRef: string | null;
  submittedAt: string | null;
  hodClearedAt: string | null;
  notes: string | null;
  papers: KnecBookingPaperRecord[];
}

export interface StudentKnecModuleProgressItem {
  module: KnecModuleItem;
  status: KnecModuleStatus;
  completionSource: 'historical_import' | 'booking_results' | 'manual_override' | 'derived';
  completedSeriesName: string | null;
  activeSeriesName: string | null;
  resitPaperCodes: string[];
  notes: string | null;
}

export interface StudentKnecSummary {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  programmeId: string | null;
  programmeCode: string;
  programmeName: string;
  equivalentTrackLabel: string;
  departmentName: string;
  cohortName: string | null;
  lifecycleStatus: string;
  academicPhase: string;
  knecIndexNumber: string | null;
  missingProfileFields?: string[];
  modules: StudentKnecModuleProgressItem[];
  bookings: KnecBookingRecord[];
  requiredCount: number;
  completedCount: number;
  resitCount: number;
  bookedCount: number;
  pendingCount: number;
  completionPercent: number;
  overallStatus: KnecOverallCompletionStatus;
}

export interface KnecBookingFormContext {
  student: {
    id: string;
    fullName: string;
    admissionNumber: string;
    programmeCode: string;
    programmeName: string;
    equivalentTrackLabel: string;
    departmentName: string;
    cohortName: string | null;
    knecIndexNumber: string | null;
  };
  booking: KnecBookingRecord;
  modulesSummary: Array<{
    moduleCode: string;
    moduleTitle: string;
    papers: Array<{
      paperCode: string;
      paperName: string;
      isResit: boolean;
      paperStatus: KnecPaperResultStatus;
    }>;
  }>;
}
