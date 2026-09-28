import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  canTransitionAssessment,
  isAssessmentPopulationEditable,
  isAssessmentResultPublished,
} from '@/features/assessment/domain';

describe('assessment domain', () => {
  it('supports the intended forward lifecycle', () => {
    expect(
      canTransitionAssessment(
        'draft',
        'generated',
      ),
    ).toBe(true);

    expect(
      canTransitionAssessment(
        'generated',
        'open',
      ),
    ).toBe(true);

    expect(
      canTransitionAssessment(
        'open',
        'submitted',
      ),
    ).toBe(true);

    expect(
      canTransitionAssessment(
        'submitted',
        'finalised',
      ),
    ).toBe(true);

    expect(
      canTransitionAssessment(
        'finalised',
        'archived',
      ),
    ).toBe(true);
  });

  it('allows deliberate reopening after submission', () => {
    expect(
      canTransitionAssessment(
        'submitted',
        'open',
      ),
    ).toBe(true);
  });

  it('locks population after submission', () => {
    expect(
      isAssessmentPopulationEditable(
        'open',
      ),
    ).toBe(true);

    expect(
      isAssessmentPopulationEditable(
        'submitted',
      ),
    ).toBe(false);

    expect(
      isAssessmentPopulationEditable(
        'finalised',
      ),
    ).toBe(false);
  });

  it('publishes only finalised results with a release timestamp', () => {
    expect(
      isAssessmentResultPublished(
        'finalised',
        '2026-08-21T12:00:00Z',
      ),
    ).toBe(true);

    expect(
      isAssessmentResultPublished(
        'finalised',
        null,
      ),
    ).toBe(false);

    expect(
      isAssessmentResultPublished(
        'submitted',
        '2026-08-21T12:00:00Z',
      ),
    ).toBe(false);
  });
});
