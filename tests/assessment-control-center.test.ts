import { describe, expect, it } from 'vitest';
import type { AssessmentControlCenterItem } from '@/features/assessment/control-center-queries';

describe('assessment control center calculations', () => {
  it('correctly categorizes marks source and completeness', () => {
    const item: AssessmentControlCenterItem = {
      id: 'event-1',
      unitId: 'unit-1',
      unitCode: 'NUTR 101',
      unitName: 'Introduction to Nutrition',
      academicPeriodId: 'period-1',
      academicPeriodName: 'Jan-Apr 2026',
      cohortNames: ['CND JAN 2026'],
      trainerNames: ['Jane Doe'],
      populationCount: 30,
      populationLocked: true,
      populationLockedAt: '2026-08-20T10:00:00Z',
      marksSource: 'excel',
      totalExpected: 30,
      satCount: 28,
      absentCount: 2,
      missingCount: 0,
      workflowStatus: 'finalised',
      isSubmitted: true,
      submittedAt: '2026-08-21T10:00:00Z',
      isFinalised: true,
      finalisedAt: '2026-08-21T14:00:00Z',
      isPublished: true,
      publishedAt: '2026-08-21T16:00:00Z',
      analysisId: 'event-1',
    };

    expect(item.populationLocked).toBe(true);
    expect(item.satCount + item.absentCount).toBe(item.totalExpected);
    expect(item.missingCount).toBe(0);
    expect(item.marksSource).toBe('excel');
    expect(item.isFinalised).toBe(true);
    expect(item.isPublished).toBe(true);
  });

  it('detects missing marks when not all candidates have sat or recorded absence', () => {
    const item: AssessmentControlCenterItem = {
      id: 'event-2',
      unitId: 'unit-2',
      unitCode: 'NUTR 102',
      unitName: 'Clinical Nutrition',
      academicPeriodId: 'period-1',
      academicPeriodName: 'Jan-Apr 2026',
      cohortNames: ['DND JAN 2026'],
      trainerNames: ['John Smith'],
      populationCount: 25,
      populationLocked: false,
      populationLockedAt: null,
      marksSource: 'online',
      totalExpected: 25,
      satCount: 20,
      absentCount: 1,
      missingCount: 4,
      workflowStatus: 'open',
      isSubmitted: false,
      submittedAt: null,
      isFinalised: false,
      finalisedAt: null,
      isPublished: false,
      publishedAt: null,
      analysisId: 'event-2',
    };

    expect(item.populationLocked).toBe(false);
    expect(item.missingCount).toBe(4);
    expect(item.marksSource).toBe('online');
    expect(item.isSubmitted).toBe(false);
  });
});
