import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  isTeachingDocumentReady,
  teachingDocumentKinds,
  teachingDocumentLabel,
  teachingDocumentStatusLabel,
} from '@/features/teaching-documents/domain';

describe('teaching documents domain', () => {
  it('defines the four controlled teaching document types', () => {
    expect(
      teachingDocumentKinds.map(
        (item) =>
          item.value,
      ),
    ).toEqual([
      'attendance_sheet',
      'course_outline',
      'scheme_of_work',
      'record_of_work',
    ]);
  });

  it('requires an active template with a storage path', () => {
    expect(
      isTeachingDocumentReady(
        'active',
        'teaching-templates/course-outline-v1.docx',
      ),
    ).toBe(
      true,
    );

    expect(
      isTeachingDocumentReady(
        'active',
        null,
      ),
    ).toBe(
      false,
    );

    expect(
      isTeachingDocumentReady(
        'draft',
        'file.docx',
      ),
    ).toBe(
      false,
    );
  });

  it('returns concise document labels', () => {
    expect(
      teachingDocumentLabel(
        'scheme_of_work',
      ),
    ).toBe(
      'Scheme of work',
    );
  });

  it('formats document workflow statuses without mixing them with document types', () => {
    expect(
      teachingDocumentStatusLabel(
        'generated',
      ),
    ).toBe(
      'In progress',
    );

    expect(
      teachingDocumentStatusLabel(
        'submitted',
      ),
    ).toBe(
      'Submitted',
    );
  });
});
