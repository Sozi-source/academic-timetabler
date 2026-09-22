import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  formatOperationsEventType,
  readinessSeverityVariant,
} from '@/features/operations/domain';

describe('operations domain', () => {
  it('formats immutable operational event names for display', () => {
    expect(
      formatOperationsEventType(
        'session_completed',
      ),
    ).toBe(
      'Session completed',
    );

    expect(
      formatOperationsEventType(
        'document_returned',
      ),
    ).toBe(
      'Document returned',
    );

    expect(
      formatOperationsEventType(
        'markbook_committed',
      ),
    ).toBe(
      'Markbook committed',
    );
  });

  it('maps readiness severity to supported badge variants', () => {
    expect(
      readinessSeverityVariant(
        'critical',
      ),
    ).toBe(
      'danger',
    );

    expect(
      readinessSeverityVariant(
        'warning',
      ),
    ).toBe(
      'warning',
    );

    expect(
      readinessSeverityVariant(
        'info',
      ),
    ).toBe(
      'info',
    );
  });
});
