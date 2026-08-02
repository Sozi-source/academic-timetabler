import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  TrainerImportRpcResult,
} from '@/features/imports/trainers/types';

describe('Trainer import RPC result', () => {
  it('represents a successful bulk import result', () => {
    const result:
    TrainerImportRpcResult = {
      batch_id:
        '550e8400-e29b-41d4-a716-446655440000',
      imported_count: 42,
      skipped_count: 3,
      failed_count: 0,
    };

    expect(result.imported_count).toBe(42);
    expect(result.skipped_count).toBe(3);
    expect(result.failed_count).toBe(0);
  });
});