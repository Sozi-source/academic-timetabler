export interface OnlineRecordOfWorkHeader {
  institutionName: string;
  departmentName: string;
  programmeName: string;
  programmeCode: string;
  academicPeriodName: string;
  unitCode: string;
  unitName: string;
  trainerName: string;
  trainerNumber: string;
  cohortName: string;
  cohortCode: string;
  categoryLevel: string;
  reviewPeriod: string;
}

export interface OnlineRecordOfWorkEntry {
  id: string;
  allocationId: string;
  timetableVersionId: string;
  timetableVersionNumber: number;
  timetableTitle: string;
  timetableSessionId: string;
  schemeDocumentVersionId: string | null;
  weekNumber: number;
  sessionNumber: number;
  sessionDate: string;
  startTime: string;
  endTime: string;
  timeLabel: string;
  workCovered: string;
  outcomesAchieved: string;
  deliveryMode: string;
  remarks: string;
  classRepresentativeName: string | null;
  classRepresentativeConfirmedAt: string | null;
  trainerSignature: string;
  signedAt: string;
  hodStatus: 'pending' | 'approved' | 'returned';
}

export interface OnlineRecordOfWorkOccurrence {
  occurrenceKey: string;
  timetableVersionId: string;
  timetableVersionNumber: number;
  timetableTitle: string;
  timetableSessionId: string;
  schemeDocumentVersionId: string | null;
  weekNumber: number;
  sessionNumber: number;
  sessionDate: string;
  startTime: string;
  endTime: string;
  timeLabel: string;
  topicSuggestion: string;
  objectivesSuggestion: string;
  deliveryMode: string;
  canSubmit: boolean;
  timingStatus: 'due' | 'today' | 'scheduled';
}

export interface OnlineRecordOfWorkContext {
  allocationId: string;
  academicPeriodId: string;
  unitId: string;
  cohortId: string;
  trainerId: string;
  departmentId: string | null;
  periodStatus: string;
  header: OnlineRecordOfWorkHeader;
  timetable: {
    available: boolean;
    id: string | null;
    versionNumber: number | null;
    title: string | null;
    publishedAt: string | null;
  };
  scheme: {
    available: boolean;
    id: string | null;
    versionNumber: number | null;
  };
  entries: OnlineRecordOfWorkEntry[];
  occurrences: OnlineRecordOfWorkOccurrence[];
}

export interface RecordOfWorkActionState {
  status: 'idle' | 'success' | 'error';
  message: string;
}

export const initialRecordOfWorkActionState: RecordOfWorkActionState = {
  status: 'idle',
  message: '',
};

