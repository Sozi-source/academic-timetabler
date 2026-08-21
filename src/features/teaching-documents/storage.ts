import 'server-only';

import {
  createHash,
  randomUUID,
} from 'node:crypto';

import {
  createAdminClient,
} from '@/lib/supabase/admin';

import {
  teachingDocumentStorageBucket,
  teachingTemplateMimeType,
  type TeachingDocumentType,
} from './domain';

function extensionFor(
  fileName:
    string,
): string {
  const normalized =
    fileName
      .trim()
      .toLowerCase();

  if (
    normalized.endsWith(
      '.docx',
    )
  ) {
    return '.docx';
  }

  if (
    normalized.endsWith(
      '.xlsx',
    )
  ) {
    return '.xlsx';
  }

  if (
    normalized.endsWith(
      '.pdf',
    )
  ) {
    return '.pdf';
  }

  return '';
}

export function teachingTemplateStoragePath(
  documentType:
    TeachingDocumentType,
  fileName:
    string,
): string {
  const extension =
    extensionFor(
      fileName,
    );

  if (!extension) {
    throw new Error(
      'Unsupported institutional template file type.',
    );
  }

  return `templates/${documentType}/${randomUUID()}${extension}`;
}

export function teachingFileSha256(
  bytes:
    Uint8Array,
): string {
  return createHash(
    'sha256',
  )
    .update(
      bytes,
    )
    .digest(
      'hex',
    );
}

export function safeTeachingDocumentFilename(
  fileName:
    string,
): string {
  const cleaned =
    fileName
      .replace(
        /[\r\n]/g,
        '',
      )
      .replace(
        /[\\/]/g,
        '-',
      )
      .replace(
        /"/g,
        "'",
      )
      .trim();

  return (
    cleaned ||
    'document'
  );
}

export function teachingDocumentContentDisposition(
  fileName:
    string,
): string {
  const safeName =
    safeTeachingDocumentFilename(
      fileName,
    );

  const asciiName =
    safeName
      .replace(
        /[^\x20-\x7E]/g,
        '_',
      );

  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(
    safeName,
  )}`;
}

export async function uploadOfficialTeachingTemplate({
  documentType,
  fileName,
  mimeType,
  bytes,
}: {
  documentType:
    TeachingDocumentType;
  fileName:
    string;
  mimeType:
    string | null;
  bytes:
    Uint8Array;
}) {
  const canonicalMime =
    teachingTemplateMimeType(
      fileName,
      mimeType,
    );

  if (!canonicalMime) {
    throw new Error(
      'Unsupported institutional template file type.',
    );
  }

  const storagePath =
    teachingTemplateStoragePath(
      documentType,
      fileName,
    );

  const admin =
    createAdminClient();

  const {
    error,
  } =
    await admin.storage
      .from(
        teachingDocumentStorageBucket,
      )
      .upload(
        storagePath,
        bytes,
        {
          contentType:
            canonicalMime,
          upsert:
            false,
          cacheControl:
            '3600',
        },
      );

  if (error) {
    throw new Error(
      `Unable to store institutional template: ${error.message}`,
    );
  }

  return {
    storageBucket:
      teachingDocumentStorageBucket,
    storagePath,
    mimeType:
      canonicalMime,
    sha256:
      teachingFileSha256(
        bytes,
      ),
    fileSizeBytes:
      bytes.byteLength,
  };
}

export async function removeTeachingDocumentStorageObject({
  storageBucket,
  storagePath,
}: {
  storageBucket:
    string;
  storagePath:
    string;
}) {
  const admin =
    createAdminClient();

  await admin.storage
    .from(
      storageBucket,
    )
    .remove([
      storagePath,
    ]);
}

export async function readVerifiedTeachingDocumentStorageObject({
  storageBucket,
  storagePath,
  expectedSha256,
}: {
  storageBucket:
    string;
  storagePath:
    string;
  expectedSha256:
    string | null;
}): Promise<ArrayBuffer> {
  const admin =
    createAdminClient();

  const {
    data,
    error,
  } =
    await admin.storage
      .from(
        storageBucket,
      )
      .download(
        storagePath,
      );

  if (
    error ||
    !data
  ) {
    throw new Error(
      error
        ? `Stored document could not be downloaded: ${error.message}`
        : 'Stored document could not be downloaded.',
    );
  }

  const buffer =
    await data.arrayBuffer();

  const bytes =
    new Uint8Array(
      buffer,
    );

  if (
    expectedSha256 &&
    teachingFileSha256(
      bytes,
    ) !==
      expectedSha256
  ) {
    throw new Error(
      'Stored document integrity check failed.',
    );
  }

  return buffer;
}
