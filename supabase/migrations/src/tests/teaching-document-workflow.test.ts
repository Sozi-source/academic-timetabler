import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  canEditTeachingDocument,
  canSubmitTeachingDocument,
  teachingDocumentStatusLabel,
  teachingDocumentStatusVariant,
  validateTeachingDocumentWorkingFile,
} from '@/features/teaching-documents/domain';

const docxMime =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('teaching document workflow', () => {
  it('keeps submitted and approved documents read-only for trainers', () => {
    expect(
      canEditTeachingDocument(
        'generated',
      ),
    ).toBe(
      true,
    );

    expect(
      canEditTeachingDocument(
        'returned',
      ),
    ).toBe(
      true,
    );

    expect(
      canEditTeachingDocument(
        'submitted',
      ),
    ).toBe(
      false,
    );

    expect(
      canEditTeachingDocument(
        'approved',
      ),
    ).toBe(
      false,
    );
  });

  it('only allows submission when an editable document has a stored file', () => {
    expect(
      canSubmitTeachingDocument(
        'generated',
        'documents/document-1/revision.docx',
      ),
    ).toBe(
      true,
    );

    expect(
      canSubmitTeachingDocument(
        'returned',
        null,
      ),
    ).toBe(
      false,
    );

    expect(
      canSubmitTeachingDocument(
        'submitted',
        'documents/document-1/revision.docx',
      ),
    ).toBe(
      false,
    );
  });

  it('requires trainer revisions to keep the official template file type', () => {
    expect(
      validateTeachingDocumentWorkingFile({
        fileName:
          'course-outline.docx',
        mimeType:
          docxMime,
        sizeBytes:
          4096,
        templateMimeType:
          docxMime,
      }),
    ).toBeNull();

    expect(
      validateTeachingDocumentWorkingFile({
        fileName:
          'course-outline.pdf',
        mimeType:
          'application/pdf',
        sizeBytes:
          4096,
        templateMimeType:
          docxMime,
      }),
    ).toMatch(
      /same file type/i,
    );
  });

  it('presents the operational workflow compactly', () => {
    expect(
      teachingDocumentStatusLabel(
        'generated',
      ),
    ).toBe(
      'In progress',
    );

    expect(
      teachingDocumentStatusVariant(
        'returned',
      ),
    ).toBe(
      'warning',
    );

    expect(
      teachingDocumentStatusVariant(
        'approved',
      ),
    ).toBe(
      'success',
    );
  });
});
