export interface TrainerDailyReportAbsentee {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  note: string | null;
}

export interface TrainerDailyReportLesson {
  id: string | null;
  departmentId: string;
  departmentName: string;
  timetableVersionId: string;
  timetableVersionNumber: number;
  timetableTitle: string;
  scheduledSessionId: string;
  teachingAllocationId: string;
  academicPeriodId: string;
  cohortId: string;
  unitId: string;
  sessionNumber: number;
  startsAt: string;
  endsAt: string;
  unitCode: string;
  unitName: string;
  cohortName: string;
  roomName: string | null;
  deliveryMode: string;
  attendanceSessionId: string | null;
  attendanceStatus: 'not_started' | 'open' | 'completed';
  rosterCount: number;
  presentCount: number;
  absentCount: number;
  absentees: TrainerDailyReportAbsentee[];
}

export interface TrainerDailyReportWorkspace {
  reportDate: string;
  trainerId: string;
  trainerName: string;
  trainerNumber: string | null;
  homeDepartmentId: string;
  homeDepartmentName: string;
  status: 'draft' | 'submitted';
  reportId: string | null;
  submittedAt: string | null;
  otherActivity: string;
  concern: string;
  readyToSubmit: boolean;
  blockingReason: string | null;
  lessons: TrainerDailyReportLesson[];
}

export interface DepartmentDailyReportTrainer {
  trainerId: string;
  trainerName: string;
}

export interface DepartmentDailyReportItem {
  reportId: string;
  trainerId: string;
  trainerName: string;
  trainerNumber: string | null;
  homeDepartmentId: string;
  homeDepartmentName: string;
  submittedAt: string;
  otherActivity: string;
  concern: string;
  lessons: TrainerDailyReportLesson[];
}

export interface DepartmentDailyReportWorkspace {
  reportDate: string;
  departmentId: string;
  departmentName: string;
  generatedAt: string;
  summary: {
    expectedTrainers: number;
    submittedReports: number;
    pendingReports: number;
    scheduledLessons: number;
    recordedAbsences: number;
    concerns: number;
  };
  pendingTrainers: DepartmentDailyReportTrainer[];
  reports: DepartmentDailyReportItem[];
}

export interface TrainerDailyReportActionState {
  status: 'idle' | 'success' | 'error';
  message: string;
}

export const initialTrainerDailyReportActionState: TrainerDailyReportActionState = {
  status: 'idle',
  message: '',
};
