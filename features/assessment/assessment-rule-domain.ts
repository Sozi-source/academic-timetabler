export interface AssessmentRuleValues {
  maximumMark: number | null;
  passMark: number | null;
}

export function validateAssessmentRule({
  maximumMark,
  passMark,
}: AssessmentRuleValues): string | null {
  if (
    maximumMark === null ||
    !Number.isFinite(
      maximumMark,
    ) ||
    maximumMark <=
      0
  ) {
    return 'Maximum mark must be greater than zero.';
  }

  if (
    passMark === null ||
    !Number.isFinite(
      passMark,
    ) ||
    passMark <
      0
  ) {
    return 'Pass mark must be zero or greater.';
  }

  if (
    passMark >
    maximumMark
  ) {
    return 'Pass mark cannot exceed the maximum mark.';
  }

  return null;
}

export function canFinaliseAssessment({
  workflowStatus,
  published,
  ruleConfigured,
}: {
  workflowStatus: string;
  published: boolean;
  ruleConfigured: boolean;
}): boolean {
  return (
    workflowStatus ===
      'submitted' &&
    !published &&
    ruleConfigured
  );
}

export function canPublishAssessment({
  workflowStatus,
  published,
}: {
  workflowStatus: string;
  published: boolean;
}): boolean {
  return (
    workflowStatus ===
      'finalised' &&
    !published
  );
}
