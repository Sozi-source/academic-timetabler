export type TimetableReportKind =
  | 'master'
  | 'cohort'
  | 'trainer'
  | 'room'
  | 'workload';

export interface TimetableReportRow {
  sessionId: string;
  day: string;
  daySequence: number;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  cohort: string;
  cohortSize: number;
  participantCohorts: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  unitCode: string;
  unitName: string;
  trainerId: string | null;
  trainer: string;
  trainerTargetHours: number;
  roomCode: string | null;
  roomName: string;
  departmentCode?: string;
  departmentName?: string;
  status: string;
  isLocked: boolean;
}

export interface TimetableReportSummary {
  totalSessions: number;
  totalContactHours: number;
  distinctCohorts: number;
  distinctTrainers: number;
  distinctRooms: number;
  lockedSessions: number;
}

export interface TimetableReportGroup {
  key: string;
  label: string;
  secondaryLabel?: string;
  sessionCount: number;
  contactHours: number;
  targetHours?: number;
  extraHours?: number;
  rows: TimetableReportRow[];
}

export interface TimetableReportsData {
  rows: TimetableReportRow[];
  summary: TimetableReportSummary;
  byCohort: TimetableReportGroup[];
  byTrainer: TimetableReportGroup[];
  byRoom: TimetableReportGroup[];
  workload: TimetableReportGroup[];
}
