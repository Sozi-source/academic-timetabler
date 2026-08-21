import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  calculateAssessmentAnalysis,
  deriveAssessmentBundleStatus,
  formatAssessmentMetric,
} from '@/features/assessment/analysis-engine';

describe('assessment analysis engine', () => {
  it('separates numeric marks, absence and unresolved marks', () => {
    const analysis =
      calculateAssessmentAnalysis({
        registeredPopulation:
          5,
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
              10,
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
              20,
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
              'missing_mark',
            mark:
              null,
          },
        ],
      });

    expect(
      analysis.registered,
    ).toBe(
      5,
    );

    expect(
      analysis.sat,
    ).toBe(
      2,
    );

    expect(
      analysis.absent,
    ).toBe(
      1,
    );

    expect(
      analysis.missing,
    ).toBe(
      2,
    );

    expect(
      analysis.mean,
    ).toBe(
      15,
    );

    expect(
      analysis.median,
    ).toBe(
      15,
    );

    expect(
      analysis.minimum,
    ).toBe(
      10,
    );

    expect(
      analysis.maximum,
    ).toBe(
      20,
    );
  });

  it('excludes absence from performance calculations', () => {
    const analysis =
      calculateAssessmentAnalysis({
        registeredPopulation:
          2,
        rows: [
          {
            assessmentId:
              'a',
            studentId:
              's1',
            cohortId:
              null,
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
              null,
            status:
              'absent',
            mark:
              null,
          },
        ],
      });

    expect(
      analysis.mean,
    ).toBe(
      18,
    );

    expect(
      analysis.numericMarks,
    ).toEqual([
      18,
    ]);
  });

  it('derives the safest bundle workflow state', () => {
    expect(
      deriveAssessmentBundleStatus([
        'submitted',
        'finalised',
      ]),
    ).toBe(
      'submitted',
    );

    expect(
      deriveAssessmentBundleStatus([
        'finalised',
        'archived',
      ]),
    ).toBe(
      'finalised',
    );
  });

  it('formats analysis metrics without inventing values', () => {
    expect(
      formatAssessmentMetric(
        null,
      ),
    ).toBe(
      'â€”',
    );

    expect(
      formatAssessmentMetric(
        12.5,
      ),
    ).toBe(
      '12.50',
    );
  });
});
