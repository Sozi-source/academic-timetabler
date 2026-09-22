import {
  NextResponse,
} from 'next/server';
import type {
  SupabaseClient,
} from '@supabase/supabase-js';

import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  teachingDocumentKinds,
  teachingDocumentLabel,
  teachingDocumentStorageBucket,
  teachingTemplateMimeType,
  validateTeachingTemplateFile,
  type TeachingDocumentType,
} from '@/features/teaching-documents/domain';
import {
  removeTeachingDocumentStorageObject,
  uploadOfficialTeachingTemplate,
} from '@/features/teaching-documents/storage';
import {
  createClient,
} from '@/lib/supabase/server';

export const runtime =
  'nodejs';

function isDocumentType(
  value:
    unknown,
): value is
  TeachingDocumentType {
  return (
    typeof value ===
      'string' &&
    teachingDocumentKinds.some(
      (kind) =>
        kind.value ===
        value,
    )
  );
}

function stringValue(
  value:
    FormDataEntryValue | null,
): string {
  return typeof value ===
    'string'
    ? value.trim()
    : '';
}

export async function POST(
  request:
    Request,
) {
  await requireHodAccess();

  const formData =
    await request.formData();

  const documentType =
    formData.get(
      'documentType',
    );

  const file =
    formData.get(
      'file',
    );

  const suppliedName =
    stringValue(
      formData.get(
        'name',
      ),
    );

  const notes =
    stringValue(
      formData.get(
        'notes',
      ),
    );

  if (
    !isDocumentType(
      documentType,
    ) ||
    !(
      file instanceof
      File
    )
  ) {
    return NextResponse.json(
      {
        message:
          'Choose a document type and official template file.',
      },
      {
        status:
          400,
      },
    );
  }

  const lowerFileName =
    file.name.toLowerCase();

  if (
    (documentType === 'course_outline' || documentType === 'scheme_of_work') &&
    lowerFileName.endsWith('.xlsx')
  ) {
    return NextResponse.json(
      {
        message:
          'Excel curriculum files must be uploaded from Teaching Documents → Curriculum Content → Import Excel.',
      },
      {
        status:
          400,
      },
    );
  }

  const validationError =
    validateTeachingTemplateFile({
      fileName:
        file.name,
      mimeType:
        file.type ||
        null,
      sizeBytes:
        file.size,
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
          'Use a DOCX, XLSX or PDF institutional template.',
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
        typeof uploadOfficialTeachingTemplate
      >
    > |
    null =
      null;

  try {
    stored =
      await uploadOfficialTeachingTemplate({
        documentType,
        fileName:
          file.name,
        mimeType:
          canonicalMime,
        bytes,
      });

    const supabase =
      (
        await createClient()
      ) as unknown as
        SupabaseClient;

    const {
      data,
      error,
    } =
      await supabase.rpc(
        'create_teaching_document_template_version',
        {
          target_document_type:
            documentType,
          target_name:
            suppliedName ||
            `${teachingDocumentLabel(
              documentType,
            )} template`,
          target_storage_bucket:
            teachingDocumentStorageBucket,
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
          target_notes:
            notes ||
            null,
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
      template:
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
            : 'Template could not be uploaded.',
      },
      {
        status:
          500,
      },
    );
  }
}
