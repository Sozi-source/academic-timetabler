export const IMPORT_MAXIMUM_FILE_SIZE_BYTES =
  50 * 1024 * 1024;

export const IMPORT_DEFAULT_MAXIMUM_ROWS =
  10_000;

export const IMPORT_ALLOWED_FILE_EXTENSIONS =
  ['.xlsx'] as const;

export const IMPORT_ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
] as const;

export const IMPORT_METADATA_KEYS = {
  templateKey: 'template_key',
  templateVersion: 'template_version',
  entityType: 'entity_type',
} as const;

export const IMPORT_WORKSHEET_NAMES = {
  instructions: 'Instructions',
  data: 'Data',
  metadata: '_meta',
} as const;