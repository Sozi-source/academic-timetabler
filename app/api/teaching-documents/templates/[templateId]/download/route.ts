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
        templateId:
          string;
      }>;
  },
) {
  await requireHodAccess();

  const {
    templateId,
  } =
    await params;

  const admin =
    createAdminClient();

  const {
    data:
      template,
    error,
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
        templateId,
      )
      .maybeSingle();

  if (
    error ||
    !template
  ) {
    return NextResponse.json(
      {
        message:
          'Template version was not found.',
      },
      {
        status:
          404,
      },
    );
  }

  if (
    !template.storage_path ||
    !template.original_filename
  ) {
    return NextResponse.json(
      {
        message:
          'Template file is not stored.',
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
    downloadError
  ) {
    return NextResponse.json(
      {
        message:
          downloadError instanceof
          Error
            ? downloadError.message
            : 'Template could not be downloaded.',
      },
      {
        status:
          409,
      },
    );
  }
}
