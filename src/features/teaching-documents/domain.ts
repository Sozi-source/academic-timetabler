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
  | 'approved'
  | 'archived';

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

export function isTeachingDocumentReady(
  templateStatus:
    | 'active'
    | 'draft'
    | 'retired'
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
