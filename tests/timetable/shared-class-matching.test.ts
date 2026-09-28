import { describe, expect, it } from 'vitest';

import {
  buildSharedClassMatchKey,
  canonicalizeSharedUnitTitle,
} from '@/features/teaching-allocations/shared-class-matching';

describe('shared class matching', () => {
  it('matches identical unit names without considering their unit codes', () => {
    const dndCommunicationSkills = buildSharedClassMatchKey({
      title: 'Communication Skills',
      sessionDurationMinutes: 120,
    });
    const cndCommunicationSkills = buildSharedClassMatchKey({
      title: 'Communication Skills',
      sessionDurationMinutes: 120,
    });

    expect(dndCommunicationSkills).toBe(
      cndCommunicationSkills,
    );
  });

  it('treats lifespan and lifecycle titles as equivalent', () => {
    expect(
      canonicalizeSharedUnitTitle('Nutrition in the Lifespan'),
    ).toBe(
      canonicalizeSharedUnitTitle('Nutrition in the Lifecycle'),
    );
  });

  it('matches equivalent units with different weekly session counts', () => {
    const first = buildSharedClassMatchKey({
      title: 'Nutrition in the Lifespan',
      sessionDurationMinutes: 120,
    });
    const second = buildSharedClassMatchKey({
      title: 'Nutrition in the Lifecycle',
      sessionDurationMinutes: 120,
    });

    expect(first).toBe(second);
  });

  it('does not match units with different session durations', () => {
    const first = buildSharedClassMatchKey({
      title: 'Introduction to Nutrition Care Process',
      sessionDurationMinutes: 120,
    });
    const second = buildSharedClassMatchKey({
      title: 'Introduction to Nutrition Care Process',
      sessionDurationMinutes: 180,
    });

    expect(first).not.toBe(second);
  });

  it('treats Diet Therapy and Diet Therapy 1 as equivalent', () => {
    expect(
      canonicalizeSharedUnitTitle('Diet Therapy'),
    ).toBe(
      canonicalizeSharedUnitTitle('Diet Therapy 1'),
    );
  });

  it('normalizes the obsolete Diet Therapy III Theory title', () => {
    expect(
      canonicalizeSharedUnitTitle('Diet Therapy III Theory'),
    ).toBe('diet therapy iii');
  });

  it('treats the introductory Nutrition Assessment title as equivalent', () => {
    expect(
      canonicalizeSharedUnitTitle(
        'Introduction to Nutrition Assessment and Surveillance',
      ),
    ).toBe(
      canonicalizeSharedUnitTitle(
        'Nutrition Assessment and Surveillance',
      ),
    );
  });

  it('treats singular and plural Applied Physical Sciences II titles as equivalent', () => {
    expect(
      canonicalizeSharedUnitTitle(
        'Applied Physical Science II (Physics)',
      ),
    ).toBe(
      canonicalizeSharedUnitTitle(
        'Applied Physical Sciences II (Physics)',
      ),
    );
  });

  it('treats singular and plural Non-Communicable Diseases titles as equivalent', () => {
    expect(
      canonicalizeSharedUnitTitle(
        'Non-Communicable Disease',
      ),
    ).toBe(
      canonicalizeSharedUnitTitle(
        'Non-communicable Diseases',
      ),
    );
  });
});
