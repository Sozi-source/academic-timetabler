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
  teachingDocumentKinds,
  type TeachingDocumentType,
} from '@/features/teaching-documents/domain';
import {
  readVerifiedTeachingDocumentStorageObject,
  removeTeachingDocumentStorageObject,
  uploadTeachingDocumentRevision,
} from '@/features/teaching-documents/storage';
import {
  createAdminClient,
} from '@/lib/supabase/admin';
import {
  createClient,
} from '@/lib/supabase/server';

interface RequestPayload {
  allocationId?: unknown;
  documentType?: unknown;
}

function isDocumentType(
  value: unknown,
): value is TeachingDocumentType {
  return (
    typeof value ===
      'string' &&
    teachingDocumentKinds.some(
      (item) =>
        item.value ===
        value,
    )
  );
}

export async function POST(
  request:
    Request,
) {
  await requireTrainerAccess();

  const payload =
    await request
      .json()
      .catch(
        () => null,
      ) as
        | RequestPayload
        | null;

  if (
    !payload ||
    typeof payload.allocationId !==
      'string' ||
    !isDocumentType(
      payload.documentType,
    )
  ) {
    return NextResponse.json(
      {
        message:
          'A valid Teaching Allocation and document type are required.',
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
      createResult,
    error:
      createError,
  } =
    await supabase.rpc(
      'create_teaching_document_record',
      {
        target_allocation_id:
          payload.allocationId,
        target_document_type:
          payload.documentType,
      },
    );

  if (
    createError
  ) {
    return NextResponse.json(
      {
        message:
          createError.message,
      },
      {
        status:
          createError.code ===
          '42501'
            ? 403
            : 409,
      },
    );
  }

  const documentId =
    typeof createResult ===
      'object' &&
    createResult &&
    'id' in
      createResult &&
    typeof createResult.id ===
      'string'
      ? createResult.id
      : null;

  if (!documentId) {
    return NextResponse.json(
      {
        message:
          'Teaching-document record could not be resolved.',
      },
      {
        status:
          409,
      },
    );
  }

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
        'id, status, template_id, storage_path',
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
          'Teaching-document record is outside your access.',
      },
      {
        status:
          404,
      },
    );
  }

  if (
    document.status !==
      'draft' ||
    document.storage_path
  ) {
    return NextResponse.json({
      success:
        true,
      document:
        createResult,
    });
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
    !template.original_filename ||
    !template.mime_type ||
    !template.sha256
  ) {
    return NextResponse.json(
      {
        message:
          'The exact institutional template file is unavailable.',
      },
      {
        status:
          409,
      },
    );
  }

  let stored:
    Awaited<
      ReturnType<
        typeof uploadTeachingDocumentRevision
      >
    > |
    null =
      null;

  try {
    const templateBuffer =
      await readVerifiedTeachingDocumentStorageObject({
        storageBucket:
          template.storage_bucket,
        storagePath:
          template.storage_path,
        expectedSha256:
          template.sha256,
      });

    const templateBytes =
      new Uint8Array(
        templateBuffer,
      );

    stored =
      await uploadTeachingDocumentRevision({
        documentId,
        fileName:
          template.original_filename,
        mimeType:
          template.mime_type,
        bytes:
          templateBytes,
      });

    const {
      data:
        revisionResult,
      error:
        revisionError,
    } =
      await supabase.rpc(
        'record_teaching_document_revision',
        {
          target_document_id:
            documentId,
          target_source:
            'template_copy',
          target_storage_bucket:
            stored.storageBucket,
          target_storage_path:
            stored.storagePath,
          target_original_filename:
            template.original_filename,
          target_mime_type:
            stored.mimeType,
          target_file_size_bytes:
            stored.fileSizeBytes,
          target_sha256:
            stored.sha256,
        },
      );

    if (
      revisionError
    ) {
      await removeTeachingDocumentStorageObject({
        storageBucket:
          stored.storageBucket,
        storagePath:
          stored.storagePath,
      });

      return NextResponse.json(
        {
          message:
            revisionError.message,
        },
        {
          status:
            revisionError.code ===
            '42501'
              ? 403
              : 409,
        },
      );
    }

    return NextResponse.json({
      success:
        true,
      document:
        createResult,
      revision:
        revisionResult,
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
            : 'Teaching-document working copy could not be prepared.',
      },
      {
        status:
          500,
      },
    );
  }
}
