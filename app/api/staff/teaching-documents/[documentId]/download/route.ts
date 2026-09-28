import {
  NextResponse,
} from 'next/server';
import type {
  SupabaseClient,
} from '@supabase/supabase-js';

import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  readVerifiedTeachingDocumentStorageObject,
  teachingDocumentContentDisposition,
} from '@/features/teaching-documents/storage';
import {
  createClient,
} from '@/lib/supabase/server';

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
  await requireTrainerAccess();

  const {
    documentId,
  } =
    await params;

  const supabase =
    (
      await createClient()
    ) as unknown as
      SupabaseClient;

  const {
    data:
      document,
    error,
  } =
    await supabase
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
    !document
  ) {
    return NextResponse.json(
      {
        message:
          'Teaching document is outside your access.',
      },
      {
        status:
          404,
      },
    );
  }

  if (
    !document.storage_path ||
    !document.original_filename
  ) {
    return NextResponse.json(
      {
        message:
          'This document has no stored working file yet.',
      },
      {
        status:
          409,
      },
    );
  }

  try {
    const bytes =
      await readVerifiedTeachingDocumentStorageObject({
        storageBucket:
          document.storage_bucket,
        storagePath:
          document.storage_path,
        expectedSha256:
          document.sha256,
      });

    return new NextResponse(
      bytes,
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
            : 'Document could not be downloaded.',
      },
      {
        status:
          409,
      },
    );
  }
}
