import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  TeachingAllocationImportRpcResult,
} from '@/features/imports/teaching-allocations/types';

describe(
  'Teaching Allocation import RPC result',
  () => {
    it(
      'represents a completed transactional import',
      () => {
        const result:
        TeachingAllocationImportRpcResult = {
          batch_id:
            '550e8400-e29b-41d4-a716-446655440000',
          imported_count: 24,
          skipped_count: 3,
          failed_count: 0,
        };

        expect(
          result.imported_count,
        ).toBe(24);

        expect(
          result.skipped_count,
        ).toBe(3);

        expect(
          result.failed_count,
        ).toBe(0);
      },
    );
  },
);