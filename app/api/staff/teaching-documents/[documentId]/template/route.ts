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
  createAdminClient,
} from '@/lib/supabase/admin';
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
    error:
      documentError,
  } =
    await supabase
      .from(
        'teaching_documents',
      )
      .select(
        'id, template_id',
      )
      .eq(
        'id',
        documentId,
      )
      .maybeSingle();

  if (
    documentError ||
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

  const admin =
    createAdminClient();

  const {
    data:
      template,
    error:
      templateError,
  } =
    await admin
      .from(
        'teaching_document_templates',
      )
      .select(
        'storage_bucket, storage_path, original_filename, mime_type, sha256',
      )
      .eq(
        'id',
        document.template_id,
      )
      .maybeSingle();

  if (
    templateError ||
    !template ||
    !template.storage_path ||
    !template.original_filename
  ) {
    return NextResponse.json(
      {
        message:
          'The exact institutional template for this document is unavailable.',
      },
      {
        status:
          404,
      },
    );
  }

  try {
    const bytes =
      await readVerifiedTeachingDocumentStorageObject({
        storageBucket:
          template.storage_bucket,
        storagePath:
          template.storage_path,
        expectedSha256:
          template.sha256,
      });

    return new NextResponse(
      bytes,
      {
        status:
          200,
        headers: {
          'Content-Type':
            template.mime_type ||
            'application/octet-stream',
          'Content-Disposition':
            teachingDocumentContentDisposition(
              template.original_filename,
            ),
          'Cache-Control':
            'private, no-store',
          'X-Content-Type-Options':
            'nosniff',
        },
      },
    );
  } catch (
    error
  ) {
    return NextResponse.json(
      {
        message:
          error instanceof
          Error
            ? error.message
            : 'Template could not be downloaded.',
      },
      {
        status:
          409,
      },
    );
  }
}
