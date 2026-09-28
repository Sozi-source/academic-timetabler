import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  teachingDocumentKinds,
} from '@/features/teaching-documents/domain';

describe('teaching document student publication policy', () => {
  it('keeps publication independent from document type', () => {
    expect(
      teachingDocumentKinds.length,
    ).toBeGreaterThan(
      0,
    );

    expect(
      teachingDocumentKinds.map(
        (kind) =>
          kind.value,
      ),
    ).toContain(
      'course_outline',
    );
  });

  it('does not invent a student-visible document type', () => {
    expect(
      teachingDocumentKinds.some(
        (kind) =>
          kind.value ===
          (
            'student_document' as
              typeof kind.value
          ),
      ),
    ).toBe(
      false,
    );
  });
});
