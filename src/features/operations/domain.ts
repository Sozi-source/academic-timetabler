import type {
  OperationsReadiness,
  OperationsReadinessIssue,
  OperationsReadinessSeverity,
  OperationsSnapshot,
} from './types';

export function operationsReadinessIssues(
  snapshot:
    OperationsSnapshot,
): OperationsReadinessIssue[] {
  const issues:
    OperationsReadinessIssue[] =
      [];

  if (
    !snapshot.activePeriodId
  ) {
    issues.push({
      id:
        'active-period',
      severity:
        'critical',
      area:
        'Calendar',
      title:
        'No active academic period',
      detail:
        'Activate an academic period before operational workflows continue.',
      href:
        '/timetable/academic-periods',
    });

    return issues;
  }

  if (
    snapshot.students.eligible >
      0 &&
    snapshot.students.portalActive <
      snapshot.students.eligible
  ) {
    const gap =
      snapshot.students.eligible -
      snapshot.students.portalActive;

    issues.push({
      id:
        'student-access',
      severity:
        'warning',
      area:
        'Students',
      title:
        `${gap} student portal access gap${gap === 1 ? '' : 's'}`,
      detail:
        'Issue or enable portal access for eligible students.',
      href:
        '/students/access',
    });
  }

  if (
    snapshot.students.unregistered >
    0
  ) {
    issues.push({
      id:
        'unit-registration',
      severity:
        'warning',
      area:
        'Students',
      title:
        `${snapshot.students.unregistered} student${snapshot.students.unregistered === 1 ? '' : 's'} without current registration`,
      detail:
        'Resolve current academic-period unit registration before assessment population is locked.',
      href:
        '/students/unit-registration',
    });
  }

  if (
    snapshot.timetable.activeAllocations ===
    0
  ) {
    issues.push({
      id:
        'allocations',
      severity:
        'critical',
      area:
        'Timetable',
      title:
        'No active teaching allocations',
      detail:
        'Teaching allocation is required before timetable, staff and attendance workflows can operate.',
      href:
        '/timetable/teaching-allocations',
    });
  }

  if (
    snapshot.timetable.activeAllocations >
      0 &&
    snapshot.timetable.publishedSessions ===
      0
  ) {
    issues.push({
      id:
        'published-timetable',
      severity:
        'warning',
      area:
        'Timetable',
      title:
        'No published timetable sessions',
      detail:
        'Publish the approved timetable before trainer and class-attendance operations begin.',
      href:
        '/timetable/published',
    });
  }

  if (
    snapshot.documents.activeTemplates <
    4
  ) {
    issues.push({
      id:
        'teaching-templates',
      severity:
        'warning',
      area:
        'Documents',
      title:
        `${4 - snapshot.documents.activeTemplates} teaching template${4 - snapshot.documents.activeTemplates === 1 ? '' : 's'} not active`,
      detail:
        'Attendance Sheet, Course Outline, Scheme of Work and Record of Work require active official templates.',
      href:
        '/teaching-documents',
    });
  }

  if (
    snapshot.documents.returned >
    0
  ) {
    issues.push({
      id:
        'returned-documents',
      severity:
        'warning',
      area:
        'Documents',
      title:
        `${snapshot.documents.returned} returned teaching document${snapshot.documents.returned === 1 ? '' : 's'}`,
      detail:
        'Returned documents are awaiting trainer correction.',
      href:
        '/teaching-documents/review',
    });
  }

  if (
    snapshot.documents.submitted >
    0
  ) {
    issues.push({
      id:
        'document-review',
      severity:
        'info',
      area:
        'Documents',
      title:
        `${snapshot.documents.submitted} document${snapshot.documents.submitted === 1 ? '' : 's'} awaiting review`,
      detail:
        'Review submitted teaching documents.',
      href:
        '/teaching-documents/review',
    });
  }

  const pendingAssessments =
    Math.max(
      0,
      snapshot.assessment.total -
      snapshot.assessment.finalised,
    );

  if (
    pendingAssessments >
    0
  ) {
    issues.push({
      id:
        'assessment-progress',
      severity:
        'info',
      area:
        'Assessment',
      title:
        `${pendingAssessments} assessment${pendingAssessments === 1 ? '' : 's'} not finalised`,
      detail:
        'Continue marks entry, validation and finalisation.',
      href:
        '/assessment/assessments',
    });
  }

  if (
    snapshot.attendance.open >
    0
  ) {
    issues.push({
      id:
        'open-attendance',
      severity:
        'info',
      area:
        'Attendance',
      title:
        `${snapshot.attendance.open} class attendance session${snapshot.attendance.open === 1 ? '' : 's'} still open`,
      detail:
        'Open sessions remain editable until every student is marked and the session is completed.',
      href:
        '/attendance-clinical/class-attendance',
    });
  }

  return issues;
}

export function operationsReadinessScore(
  snapshot:
    OperationsSnapshot,
): number {
  const issues =
    operationsReadinessIssues(
      snapshot,
    );

  const deduction =
    issues.reduce(
      (
        total,
        issue,
      ) => {
        if (
          issue.severity ===
          'critical'
        ) {
          return total +
            25;
        }

        if (
          issue.severity ===
          'warning'
        ) {
          return total +
            10;
        }

        return total +
          3;
      },
      0,
    );

  return Math.max(
    0,
    100 -
      deduction,
  );
}

export function readinessSeverityVariant(
  severity:
    OperationsReadinessSeverity,
):
  | 'danger'
  | 'warning'
  | 'info' {
  switch (
    severity
  ) {
    case 'critical':
      return 'danger';

    case 'warning':
      return 'warning';

    default:
      return 'info';
  }
}

export function formatOperationsEventType(
  value:
    string,
): string {
  return value
    .replaceAll(
      '_',
      ' ',
    )
    .replace(
      /^\w/,
      (
        letter,
      ) =>
        letter.toUpperCase(),
    );
}

export type ReadinessState =
  | 'ready'
  | 'attention';

export function operationsReadinessState(
  data:
    OperationsReadiness,
): ReadinessState {
  const blockers =
    data.students
      .accessMissing +
    data.attendance
      .incomplete +
    data.documents
      .awaitingReview +
    data.documents
      .returned +
    data.assessments
      .finalisedUnpublished;

  return blockers ===
    0
    ? 'ready'
    : 'attention';
}

export function operationsAttentionCount(
  data:
    OperationsReadiness,
): number {
  return (
    data.students
      .accessMissing +
    data.attendance
      .incomplete +
    data.documents
      .awaitingReview +
    data.documents
      .returned +
    data.assessments
      .finalisedUnpublished
  );
}

export function shortOperationalTime(
  value:
    string,
): string {
  return value
    .slice(
      0,
      5,
    );
}
