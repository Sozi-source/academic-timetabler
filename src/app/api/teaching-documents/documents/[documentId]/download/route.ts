import {
  NextResponse,
} from 'next/server';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  readVerifiedTeachingDocumentStorageObject,
  teachingDocumentContentDisposition,
} from '@/features/teaching-documents/storage';
import {
  createAdminClient,
} from '@/lib/supabase/admin';

export const runtime =
  'nodejs';

export async function GET(
  _request:
    Request,
  {
    params,
  }: {
    params:
      Promise<{
        documentId:
          string;
      }>;
  },
) {
  await requireHodAccess();

  const {
    documentId,
  } =
    await params;

  const admin =
    createAdminClient();

  const {
    data:
      document,
    error,
  } =
    await admin
      .from(
        'teaching_documents',
      )
      .select(
        'storage_bucket, storage_path, original_filename, mime_type, sha256',
      )
      .eq(
        'id',
        documentId,
      )
      .maybeSingle();

  if (
    error ||
    !document ||
    !document.storage_path ||
    !document.original_filename
  ) {
    return NextResponse.json(
      {
        message:
          'Teaching-document working file was not found.',
      },
      {
        status:
          404,
      },
    );
  }

  try {
    const buffer =
      await readVerifiedTeachingDocumentStorageObject({
        storageBucket:
          document.storage_bucket,
        storagePath:
          document.storage_path,
        expectedSha256:
          document.sha256,
      });

    return new NextResponse(
      buffer,
      {
        status:
          200,
        headers: {
          'Content-Type':
            document.mime_type ||
            'application/octet-stream',
          'Content-Disposition':
            teachingDocumentContentDisposition(
              document.original_filename,
            ),
          'Cache-Control':
            'private, no-store',
          'X-Content-Type-Options':
            'nosniff',
        },
      },
    );
  } catch (
    downloadError
  ) {
    return NextResponse.json(
      {
        message:
          downloadError instanceof
          Error
            ? downloadError.message
            : 'Teaching document could not be downloaded.',
      },
      {
        status:
          409,
      },
    );
  }
}
