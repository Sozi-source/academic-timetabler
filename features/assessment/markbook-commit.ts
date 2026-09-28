export interface AssessmentMarkbookCommitInput {
  status: string;
  missingMarks: number;
  totalRows: number;
}

export interface AssessmentMarkbookCommitState {
  canCommit: boolean;
  label: string;
  message: string | null;
}

export function getAssessmentMarkbookCommitState({
  status,
  missingMarks,
  totalRows,
}: AssessmentMarkbookCommitInput): AssessmentMarkbookCommitState {
  if (status === 'committed') {
    return {
      canCommit: false,
      label: 'Committed',
      message:
        'Results have already been committed.',
    };
  }

  if (status !== 'ready') {
    return {
      canCommit: false,
      label: 'Unavailable',
      message:
        'Only a ready staged workbook can be committed.',
    };
  }

  if (totalRows < 1) {
    return {
      canCommit: false,
      label: 'Unavailable',
      message:
        'No staged results are available.',
    };
  }

  if (missingMarks > 0) {
    return {
      canCommit: false,
      label: 'Resolve missing marks',
      message:
        `${missingMarks} missing mark${missingMarks === 1 ? '' : 's'} must be corrected before commit.`,
    };
  }

  return {
    canCommit: true,
    label: 'Commit results',
    message: null,
  };
}
