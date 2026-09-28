import {
  IMPORT_ALLOWED_FILE_EXTENSIONS,
  IMPORT_ALLOWED_MIME_TYPES,
  IMPORT_MAXIMUM_FILE_SIZE_BYTES,
} from './constants';
import {
  ImportWorkbookError,
} from './types';

export interface ImportFileDescriptor {
  name: string;
  size: number;
  type?: string;
}

export function getFileExtension(
  fileName: string,
) {
  const lastDotIndex =
    fileName.lastIndexOf('.');

  if (lastDotIndex < 0) {
    return '';
  }

  return fileName
    .slice(lastDotIndex)
    .toLowerCase();
}

export function validateImportFileDescriptor(
  file: ImportFileDescriptor,
) {
  if (!file.name.trim() || file.size <= 0) {
    throw new ImportWorkbookError(
      'The uploaded workbook is empty.',
      'FILE_EMPTY',
    );
  }

  if (
    file.size >
    IMPORT_MAXIMUM_FILE_SIZE_BYTES
  ) {
    throw new ImportWorkbookError(
      'The workbook exceeds the 50 MB upload limit.',
      'FILE_TOO_LARGE',
    );
  }

  const extension =
    getFileExtension(file.name);

  if (
    !IMPORT_ALLOWED_FILE_EXTENSIONS.includes(
      extension as
        (typeof IMPORT_ALLOWED_FILE_EXTENSIONS)[number],
    )
  ) {
    throw new ImportWorkbookError(
      'Upload an Excel workbook in .xlsx format.',
      'INVALID_FILE_TYPE',
    );
  }

  if (
    file.type &&
    !IMPORT_ALLOWED_MIME_TYPES.includes(
      file.type as
        (typeof IMPORT_ALLOWED_MIME_TYPES)[number],
    )
  ) {
    throw new ImportWorkbookError(
      'The uploaded file is not a supported Excel workbook.',
      'INVALID_FILE_TYPE',
    );
  }
}