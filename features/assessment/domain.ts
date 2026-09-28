export const assessmentTypes = [
  'cat',
  'exam',
] as const;

export type AssessmentType =
  (typeof assessmentTypes)[number];

export const assessmentTypeLabels:
Record<AssessmentType, string> = {
  cat: 'CAT',
  exam: 'Exam',
};

export const assessmentWorkflowStatuses = [
  'draft',
  'generated',
  'open',
  'submitted',
  'finalised',
  'archived',
] as const;

export type AssessmentWorkflowStatus =
  (typeof assessmentWorkflowStatuses)[number];

export const assessmentWorkflowStatusLabels:
Record<AssessmentWorkflowStatus, string> = {
  draft: 'Draft',
  generated: 'Generated',
  open: 'Open',
  submitted: 'Submitted',
  finalised: 'Finalised',
  archived: 'Archived',
};

export const assessmentAttendanceStatuses = [
  'expected',
  'absent',
] as const;

export type AssessmentAttendanceStatus =
  (typeof assessmentAttendanceStatuses)[number];

export const assessmentAttendanceStatusLabels:
Record<AssessmentAttendanceStatus, string> = {
  expected: 'Expected',
  absent: 'Absent',
};

export const assessmentResultStatuses = [
  'pending',
  'sat',
  'absent',
  'missing_mark',
] as const;

export type AssessmentResultStatus =
  (typeof assessmentResultStatuses)[number];

export const assessmentResultStatusLabels:
Record<AssessmentResultStatus, string> = {
  pending: 'Pending',
  sat: 'Sat',
  absent: 'Absent',
  missing_mark: 'Missing mark',
};

const transitions:
Record<
  AssessmentWorkflowStatus,
  readonly AssessmentWorkflowStatus[]
> = {
  draft: ['generated', 'archived'],
  generated: ['open', 'archived'],
  open: ['submitted', 'archived'],
  submitted: ['open', 'finalised'],
  finalised: ['archived'],
  archived: [],
};

export function canTransitionAssessment(
  current: AssessmentWorkflowStatus,
  next: AssessmentWorkflowStatus,
): boolean {
  return transitions[current].includes(next);
}

export function isAssessmentPopulationEditable(
  status: AssessmentWorkflowStatus | null | undefined,
): boolean {
  return (
    status === null ||
    status === undefined ||
    status === 'draft' ||
    status === 'generated' ||
    status === 'open'
  );
}

export function isAssessmentResultPublished(
  workflowStatus:
    | AssessmentWorkflowStatus
    | null
    | undefined,
  publishedAt:
    | string
    | null
    | undefined,
): boolean {
  return (
    workflowStatus === 'finalised' &&
    Boolean(publishedAt)
  );
}
