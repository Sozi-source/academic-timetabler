export type TimetableVersionStatus =
  | 'draft'
  | 'under_review'
  | 'approved'
  | 'published'
  | 'archived';

export interface PublishedSessionSnapshot {
  id: string;
  cohortName: string;
  unitCode: string;
  unitName: string;
  trainerName: string;
  roomCode: string;
  roomName: string;
  day: string;
  daySequence: number;
  startTime: string;
  endTime: string;
  sessionNumber: number;
  deliveryMode: string;
  isLocked: boolean;
  notes: string | null;
}

export interface TimetablePublicationEvent {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  performedAt: string;
}

export interface TimetableVersion {
  id: string;
  academicPeriodId: string;
  versionNumber: number;
  status: TimetableVersionStatus;
  title: string;
  changeSummary: string | null;
  sessionCount: number;
  conflictCount: number;
  snapshot: PublishedSessionSnapshot[];
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  events: TimetablePublicationEvent[];
}
