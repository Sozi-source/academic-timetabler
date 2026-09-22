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
  teachingTemplateMimeType,
  validateTeachingDocumentWorkingFile,
} from '@/features/teaching-documents/domain';
import {
  removeTeachingDocumentStorageObject,
  uploadTeachingDocumentRevision,
} from '@/features/teaching-documents/storage';
import {
  createAdminClient,
} from '@/lib/supabase/admin';
import {
  createClient,
} from '@/lib/supabase/server';

export const runtime =
  'nodejs';

export async function POST(
  request:
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

  const formData =
    await request.formData();

  const file =
    formData.get(
      'file',
    );

  if (
    !(
      file instanceof
      File
    )
  ) {
    return NextResponse.json(
      {
        message:
          'Choose the completed working file.',
      },
      {
        status:
          400,
      },
    );
  }

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
        'id, status, template_id',
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

  if (
    document.status !==
      'generated' &&
    document.status !==
      'returned'
  ) {
    return NextResponse.json(
      {
        message:
          'This teaching document is not open for editing.',
      },
      {
        status:
          409,
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
        'mime_type',
      )
      .eq(
        'id',
        document.template_id,
      )
      .maybeSingle();

  if (
    templateError ||
    !template?.mime_type
  ) {
    return NextResponse.json(
      {
        message:
          'The source institutional template could not be resolved.',
      },
      {
        status:
          409,
      },
    );
  }

  const validationError =
    validateTeachingDocumentWorkingFile({
      fileName:
        file.name,
      mimeType:
        file.type ||
        null,
      sizeBytes:
        file.size,
      templateMimeType:
        template.mime_type,
    });

  if (
    validationError
  ) {
    return NextResponse.json(
      {
        message:
          validationError,
      },
      {
        status:
          400,
      },
    );
  }

  const canonicalMime =
    teachingTemplateMimeType(
      file.name,
      file.type ||
      null,
    );

  if (!canonicalMime) {
    return NextResponse.json(
      {
        message:
          'Unsupported working file.',
      },
      {
        status:
          400,
      },
    );
  }

  const bytes =
    new Uint8Array(
      await file.arrayBuffer(),
    );

  let stored:
    Awaited<
      ReturnType<
        typeof uploadTeachingDocumentRevision
      >
    > |
    null =
      null;

  try {
    stored =
      await uploadTeachingDocumentRevision({
        documentId,
        fileName:
          file.name,
        mimeType:
          canonicalMime,
        bytes,
      });

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'record_teaching_document_revision',
        {
          target_document_id:
            documentId,
          target_source:
            'trainer_upload',
          target_storage_bucket:
            stored.storageBucket,
          target_storage_path:
            stored.storagePath,
          target_original_filename:
            file.name,
          target_mime_type:
            stored.mimeType,
          target_file_size_bytes:
            stored.fileSizeBytes,
          target_sha256:
            stored.sha256,
        },
      );

    if (error) {
      await removeTeachingDocumentStorageObject({
        storageBucket:
          stored.storageBucket,
        storagePath:
          stored.storagePath,
      });

      return NextResponse.json(
        {
          message:
            error.message,
        },
        {
          status:
            error.code ===
            '42501'
              ? 403
              : 409,
        },
      );
    }

    return NextResponse.json({
      success:
        true,
      revision:
        data,
    });
  } catch (
    error
  ) {
    if (stored) {
      await removeTeachingDocumentStorageObject({
        storageBucket:
          stored.storageBucket,
        storagePath:
          stored.storagePath,
      });
    }

    return NextResponse.json(
      {
        message:
          error instanceof
          Error
            ? error.message
            : 'Working file could not be uploaded.',
      },
      {
        status:
          500,
      },
    );
  }
}
