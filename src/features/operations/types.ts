export interface OperationsSnapshot {
  activePeriodId:
    string |
    null;
  activePeriodName:
    string |
    null;

  students: {
    eligible:
      number;
    portalIssued:
      number;
    portalActive:
      number;
    registered:
      number;
    unregistered:
      number;
  };

  timetable: {
    activeAllocations:
      number;
    publishedSessions:
      number;
  };

  assessment: {
    total:
      number;
    submitted:
      number;
    finalised:
      number;
    published:
      number;
  };

  documents: {
    activeTemplates:
      number;
    inProgress:
      number;
    submitted:
      number;
    returned:
      number;
    approved:
      number;
  };

  attendance: {
    open:
      number;
    completed:
      number;
  };
}

export type OperationsReadinessSeverity =
  | 'critical'
  | 'warning'
  | 'info';

export interface OperationsReadinessIssue {
  id:
    string;
  severity:
    OperationsReadinessSeverity;
  area:
    string;
  title:
    string;
  detail:
    string;
  href:
    string;
}

export interface DepartmentAttendanceOverview {
  classSessionId:
    string;
  teachingAllocationId:
    string;
  sessionDate:
    string;
  sessionStatus:
    'open' |
    'completed';
  academicPeriodName:
    string;
  unitName:
    string;
  cohortName:
    string;
  trainerName:
    string;
  startsAt:
    string;
  endsAt:
    string;
  rosterCount:
    number;
  presentCount:
    number;
  absentCount:
    number;
  unmarkedCount:
    number;
  openedAt:
    string;
  completedAt:
    string |
    null;
}

export interface OperationsAuditItem {
  occurredAt:
    string;
  area:
    string;
  eventType:
    string;
  subject:
    string;
  actorName:
    string;
  detail:
    string |
    null;
}

export interface OperationsReadiness {
  activePeriodId:
    string |
    null;
  students: {
    eligible:
      number;
    accessIssued:
      number;
    accessActive:
      number;
    accessMissing:
      number;
  };
  attendance: {
    open:
      number;
    completed:
      number;
    incomplete:
      number;
  };
  documents: {
    awaitingReview:
      number;
    returned:
      number;
    approvedUnpublished:
      number;
    studentPublished:
      number;
  };
  assessments: {
    total:
      number;
    submitted:
      number;
    finalised:
      number;
    finalisedUnpublished:
      number;
  };
}

export interface AttendanceOversightItem {
  classSessionId:
    string;
  sessionDate:
    string;
  sessionStatus:
    'open' |
    'completed';
  unitName:
    string;
  cohortName:
    string;
  trainerName:
    string;
  startsAt:
    string;
  endsAt:
    string;
  rosterCount:
    number;
  presentCount:
    number;
  absentCount:
    number;
  unmarkedCount:
    number;
  completedAt:
    string |
    null;
}
