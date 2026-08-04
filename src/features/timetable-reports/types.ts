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
  unitCode: string;
  unitName: string;
  trainer: string;
  roomCode: string;
  roomName: string;
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
