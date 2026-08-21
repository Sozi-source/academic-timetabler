export const teachingDocumentKinds = [
  {
    value:
      'attendance_sheet',
    label:
      'Attendance sheet',
    description:
      'Class attendance record.',
  },
  {
    value:
      'course_outline',
    label:
      'Course outline',
    description:
      'Unit delivery outline.',
  },
  {
    value:
      'scheme_of_work',
    label:
      'Scheme of work',
    description:
      'Planned teaching sequence.',
  },
  {
    value:
      'record_of_work',
    label:
      'Record of work',
    description:
      'Completed teaching record.',
  },
] as const;

export type TeachingDocumentType =
  typeof teachingDocumentKinds[number]['value'];

export type TeachingDocumentStatus =
  | 'draft'
  | 'generated'
  | 'submitted'
  | 'returned'
  | 'approved'
  | 'archived';

export type TeachingDocumentTemplateStatus =
  | 'draft'
  | 'active'
  | 'retired';

export type TeachingDocumentReviewDecision =
  | 'approved'
  | 'returned';

export const teachingDocumentStorageBucket =
  'teaching-documents-private';

export const teachingTemplateMaximumBytes =
  15 *
  1024 *
  1024;

const templateFileTypes = [
  {
    extension:
      '.docx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  {
    extension:
      '.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  {
    extension:
      '.pdf',
    mimeType:
      'application/pdf',
  },
] as const;

export function teachingDocumentLabel(
  type: TeachingDocumentType,
): string {
  return (
    teachingDocumentKinds.find(
      (item) =>
        item.value ===
        type,
    )?.label ??
    type
  );
}

export function teachingDocumentStatusLabel(
  status: TeachingDocumentStatus,
): string {
  if (
    status ===
    'generated'
  ) {
    return 'In progress';
  }

  return status
    .replaceAll(
      '_',
      ' ',
    )
    .replace(
      /^\w/,
      (value) =>
        value.toUpperCase(),
    );
}

export function teachingTemplateStatusLabel(
  status:
    TeachingDocumentTemplateStatus,
): string {
  return status
    .replace(
      /^\w/,
      (value) =>
        value.toUpperCase(),
    );
}

export function teachingDocumentStatusVariant(
  status:
    TeachingDocumentStatus,
):
  | 'neutral'
  | 'success'
  | 'warning'
  | 'info'
  | 'institutional' {
  if (
    status ===
    'approved'
  ) {
    return 'success';
  }

  if (
    status ===
    'returned'
  ) {
    return 'warning';
  }

  if (
    status ===
    'submitted'
  ) {
    return 'info';
  }

  if (
    status ===
    'generated'
  ) {
    return 'institutional';
  }

  return 'neutral';
}

export function isTeachingDocumentReady(
  templateStatus:
    | TeachingDocumentTemplateStatus
    | null,
  storagePath:
    | string
    | null,
): boolean {
  return (
    templateStatus ===
      'active' &&
    Boolean(
      storagePath?.trim(),
    )
  );
}

export function teachingTemplateMimeType(
  fileName:
    string,
  suppliedMimeType:
    string | null,
): string | null {
  const normalizedName =
    fileName
      .trim()
      .toLowerCase();

  const match =
    templateFileTypes.find(
      (item) =>
        normalizedName.endsWith(
          item.extension,
        ),
    );

  if (!match) {
    return null;
  }

  const normalizedMime =
    suppliedMimeType
      ?.trim()
      .toLowerCase() ??
    '';

  if (
    normalizedMime &&
    normalizedMime !==
      match.mimeType &&
    normalizedMime !==
      'application/octet-stream'
  ) {
    return null;
  }

  return match.mimeType;
}

export function validateTeachingTemplateFile({
  fileName,
  mimeType,
  sizeBytes,
}: {
  fileName:
    string;
  mimeType:
    string | null;
  sizeBytes:
    number;
}): string | null {
  if (
    !fileName.trim()
  ) {
    return 'Choose an official template file.';
  }

  if (
    !Number.isFinite(
      sizeBytes,
    ) ||
    sizeBytes <=
      0
  ) {
    return 'The template file is empty.';
  }

  if (
    sizeBytes >
    teachingTemplateMaximumBytes
  ) {
    return 'The template file must be 15 MB or smaller.';
  }

  if (
    !teachingTemplateMimeType(
      fileName,
      mimeType,
    )
  ) {
    return 'Use a DOCX, XLSX or PDF institutional template.';
  }

  return null;
}

export function validateTeachingDocumentWorkingFile({
  fileName,
  mimeType,
  sizeBytes,
  templateMimeType,
}: {
  fileName:
    string;
  mimeType:
    string | null;
  sizeBytes:
    number;
  templateMimeType:
    string | null;
}): string | null {
  const basicError =
    validateTeachingTemplateFile({
      fileName,
      mimeType,
      sizeBytes,
    });

  if (
    basicError
  ) {
    return basicError;
  }

  const canonicalMime =
    teachingTemplateMimeType(
      fileName,
      mimeType,
    );

  if (
    !templateMimeType ||
    canonicalMime !==
      templateMimeType
  ) {
    return 'Upload the same file type as the official template.';
  }

  return null;
}

export function canEditTeachingDocument(
  status:
    TeachingDocumentStatus,
): boolean {
  return (
    status ===
      'generated' ||
    status ===
      'returned'
  );
}

export function canSubmitTeachingDocument(
  status:
    TeachingDocumentStatus,
  storagePath:
    string | null,
): boolean {
  return (
    canEditTeachingDocument(
      status,
    ) &&
    Boolean(
      storagePath?.trim(),
    )
  );
}

export function formatTeachingDocumentFileSize(
  sizeBytes:
    number | null,
): string {
  if (
    !sizeBytes ||
    sizeBytes <=
      0
  ) {
    return '—';
  }

  if (
    sizeBytes <
    1024
  ) {
    return `${sizeBytes} B`;
  }

  const kilobytes =
    sizeBytes /
    1024;

  if (
    kilobytes <
    1024
  ) {
    return `${kilobytes.toFixed(
      kilobytes >=
        100
        ? 0
        : 1,
    )} KB`;
  }

  const megabytes =
    kilobytes /
    1024;

  return `${megabytes.toFixed(
    megabytes >=
      10
      ? 1
      : 2,
  )} MB`;
}

export function shortTeachingDocumentHash(
  sha256:
    string | null,
): string {
  if (!sha256) {
    return '—';
  }

  return sha256.slice(
    0,
    12,
  );
}
