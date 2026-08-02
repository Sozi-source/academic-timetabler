export type RecordStatus =
  | 'active'
  | 'inactive'
  | 'archived';

export type TimetableStatus =
  | 'draft'
  | 'generated'
  | 'approved'
  | 'published'
  | 'archived';

export type SessionType =
  | 'theory'
  | 'practical'
  | 'laboratory'
  | 'clinical'
  | 'workshop';

export type RoomType =
  | 'standard'
  | 'laboratory'
  | 'computer_lab'
  | 'skills_lab'
  | 'kitchen'
  | 'workshop';

export interface AcademicPeriod {
  id: string;
  name: string;
  academicYear: string;
  startsOn: string;
  endsOn: string;
  status: RecordStatus;
}

export interface TimetableConflict {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  sessionId?: string;
}
