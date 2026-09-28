import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  formatTeachingDocumentFileSize,
  teachingTemplateMaximumBytes,
  teachingTemplateMimeType,
  validateTeachingTemplateFile,
} from '@/features/teaching-documents/domain';

describe('teaching document template policy', () => {
  it('accepts official editable DOCX and XLSX templates', () => {
    expect(
      teachingTemplateMimeType(
        'COURSE OUTLINE.DOCX',
        '',
      ),
    ).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    expect(
      teachingTemplateMimeType(
        'Attendance.xlsx',
        'application/octet-stream',
      ),
    ).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });

  it('accepts PDF reference templates but rejects executable files', () => {
    expect(
      validateTeachingTemplateFile({
        fileName:
          'official.pdf',
        mimeType:
          'application/pdf',
        sizeBytes:
          1024,
      }),
    ).toBeNull();

    expect(
      validateTeachingTemplateFile({
        fileName:
          'template.exe',
        mimeType:
          'application/octet-stream',
        sizeBytes:
          1024,
      }),
    ).toMatch(
      /DOCX, XLSX or PDF/,
    );
  });

  it('enforces the 15 MB controlled upload limit', () => {
    expect(
      validateTeachingTemplateFile({
        fileName:
          'scheme.docx',
        mimeType:
          null,
        sizeBytes:
          teachingTemplateMaximumBytes +
          1,
      }),
    ).toMatch(
      /15 MB/,
    );
  });

  it('formats stored file sizes compactly', () => {
    expect(
      formatTeachingDocumentFileSize(
        2048,
      ),
    ).toBe(
      '2.0 KB',
    );
  });
});
