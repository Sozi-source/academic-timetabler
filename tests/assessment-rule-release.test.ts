import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  calculateAssessmentAnalysis,
} from '@/features/assessment/analysis-engine';
import {
  canFinaliseAssessment,
  canPublishAssessment,
  validateAssessmentRule,
} from '@/features/assessment/assessment-rule-domain';

describe('assessment rule and release domain', () => {
  it('validates maximum and pass marks', () => {
    expect(
      validateAssessmentRule({
        maximumMark:
          30,
        passMark:
          15,
      }),
    ).toBeNull();

    expect(
      validateAssessmentRule({
        maximumMark:
          20,
        passMark:
          25,
      }),
    ).toBe(
      'Pass mark cannot exceed the maximum mark.',
    );
  });

  it('calculates pass metrics only when a rule exists', () => {
    const analysis =
      calculateAssessmentAnalysis({
        registeredPopulation:
          4,
        maximumMark:
          30,
        passMark:
          15,
        rows: [
          {
            assessmentId:
              'a',
            studentId:
              's1',
            cohortId:
              'c1',
            status:
              'sat',
            mark:
              18,
          },
          {
            assessmentId:
              'a',
            studentId:
              's2',
            cohortId:
              'c1',
            status:
              'sat',
            mark:
              12,
          },
          {
            assessmentId:
              'a',
            studentId:
              's3',
            cohortId:
              'c1',
            status:
              'absent',
            mark:
              null,
          },
          {
            assessmentId:
              'a',
            studentId:
              's4',
            cohortId:
              'c1',
            status:
              'sat',
            mark:
              30,
          },
        ],
      });

    expect(
      analysis.passed,
    ).toBe(
      2,
    );

    expect(
      analysis.failed,
    ).toBe(
      1,
    );

    expect(
      analysis.passRate,
    ).toBe(
      66.67,
    );

    expect(
      analysis.meanPercentage,
    ).toBe(
      66.67,
    );
  });

  it('keeps finalisation and publication separate', () => {
    expect(
      canFinaliseAssessment({
        workflowStatus:
          'submitted',
        published:
          false,
        ruleConfigured:
          true,
      }),
    ).toBe(
      true,
    );

    expect(
      canPublishAssessment({
        workflowStatus:
          'submitted',
        published:
          false,
      }),
    ).toBe(
      false,
    );

    expect(
      canPublishAssessment({
        workflowStatus:
          'finalised',
        published:
          false,
      }),
    ).toBe(
      true,
    );
  });
});
