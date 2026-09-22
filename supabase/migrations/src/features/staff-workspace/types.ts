export interface StaffTimetableSession {
  id: string;
  /** The teaching_allocation ID for this session, if available. Used to link
   *  directly from the timetable to the unit's teaching documents. */
  allocationId: string | null;
  academicPeriodId: string;
  academicPeriodName: string;
  academicPeriodCode: string | null;
  dayName: string;
  daySequence: number;
  startSequence: number;
  startsAt: string;
  endsAt: string;
  unitId: string;
  unitName: string;
  cohortNames: string[];
  roomLabel: string;
  deliveryMode: string;
  sessionNumbers: number[];
}

export interface StaffPublishedTimetable {
  trainerId: string;
  trainerName: string;
  sessions: StaffTimetableSession[];
}

export type StaffHistoryKind =
  | 'markbook'
  | 'marks_import'
  | 'teaching_document'
  | 'attendance';

export interface StaffHistoryItem {
  id: string;
  kind: StaffHistoryKind;
  title: string;
  detail: string;
  status: string;
  occurredAt: string | null;
}
