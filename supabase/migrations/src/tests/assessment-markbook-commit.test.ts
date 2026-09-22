import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  getAssessmentMarkbookCommitState,
} from '@/features/assessment/markbook-commit';

describe('assessment markbook commit state', () => {
  it('allows a ready workbook with no missing marks', () => {
    expect(
      getAssessmentMarkbookCommitState({
        status:
          'ready',
        missingMarks:
          0,
        totalRows:
          42,
      }),
    ).toEqual({
      canCommit:
        true,
      label:
        'Commit results',
      message:
        null,
    });
  });

  it('blocks commit while missing marks remain', () => {
    const state =
      getAssessmentMarkbookCommitState({
        status:
          'ready',
        missingMarks:
          2,
        totalRows:
          42,
      });

    expect(
      state.canCommit,
    ).toBe(
      false,
    );

    expect(
      state.label,
    ).toBe(
      'Resolve missing marks',
    );
  });

  it('keeps a committed batch immutable', () => {
    const state =
      getAssessmentMarkbookCommitState({
        status:
          'committed',
        missingMarks:
          0,
        totalRows:
          42,
      });

    expect(
      state.canCommit,
    ).toBe(
      false,
    );

    expect(
      state.label,
    ).toBe(
      'Committed',
    );
  });
});
