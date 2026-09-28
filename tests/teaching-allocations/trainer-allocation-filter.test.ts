import { describe, expect, it } from 'vitest';

import { filterTrainersWithAllocations } from '@/features/teaching-allocations/trainer-allocation-filter';

describe('filterTrainersWithAllocations', () => {
  const trainers = [
    { id: 'trainer-1', name: 'Allocated trainer' },
    { id: 'trainer-2', name: 'Trainer without allocation' },
    { id: 'trainer-3', name: 'Another allocated trainer' },
  ];

  it('returns only trainers referenced by a current allocation', () => {
    expect(
      filterTrainersWithAllocations(trainers, [
        { trainer_id: 'trainer-1' },
        { trainer_id: null },
        { trainer_id: 'trainer-3' },
      ]),
    ).toEqual([
      trainers[0],
      trainers[2],
    ]);
  });

  it('does not duplicate a trainer with several allocations', () => {
    expect(
      filterTrainersWithAllocations(trainers, [
        { trainer_id: 'trainer-1' },
        { trainer_id: 'trainer-1' },
      ]),
    ).toEqual([trainers[0]]);
  });

  it('returns an empty list when no trainer is allocated', () => {
    expect(
      filterTrainersWithAllocations(trainers, [
        { trainer_id: null },
      ]),
    ).toEqual([]);
  });
});
