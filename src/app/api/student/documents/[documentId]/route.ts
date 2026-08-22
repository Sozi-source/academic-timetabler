import {
  NextResponse,
} from 'next/server';

import {
  getStudentPortalSession,
} from '@/features/student-portal/session';
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
  const session =
    await getStudentPortalSession();

  if (!session) {
    return NextResponse.json(
      {
        message:
          'Student sign-in is required.',
      },
      {
        status:
          401,
      },
    );
  }

  const {
    documentId,
  } =
    await params;

  const admin =
    createAdminClient();

  const {
    data:
      student,
    error:
      studentError,
  } =
    await admin
      .from(
        'students',
      )
      .select(
        'id, current_cohort_id, lifecycle_status',
      )
      .eq(
        'id',
        session.studentId,
      )
      .maybeSingle();

  if (
    studentError ||
    !student ||
    !student.current_cohort_id ||
    ![
      'admitted',
      'active',
    ].includes(
      student.lifecycle_status,
    )
  ) {
    return NextResponse.json(
      {
        message:
          'Student access is unavailable.',
      },
      {
        status:
          403,
      },
    );
  }

  const {
    data:
      document,
    error:
      documentError,
  } =
    await admin
      .from(
        'teaching_documents',
      )
      .select(
        'id, cohort_id, status, approved_revision_number, student_published_at',
      )
      .eq(
        'id',
        documentId,
      )
      .eq(
        'cohort_id',
        student.current_cohort_id,
      )
      .eq(
        'status',
        'approved',
      )
      .not(
        'student_published_at',
        'is',
        null,
      )
      .maybeSingle();

  if (
    documentError ||
    !document ||
    !document.approved_revision_number
  ) {
    return NextResponse.json(
      {
        message:
          'Published document was not found.',
      },
      {
        status:
          404,
      },
    );
  }

  const {
    data:
      revision,
    error:
      revisionError,
  } =
    await admin
      .from(
        'teaching_document_revisions',
      )
      .select(
        'storage_bucket, storage_path, original_filename, mime_type, sha256',
      )
      .eq(
        'document_id',
        document.id,
      )
      .eq(
        'revision_number',
        document.approved_revision_number,
      )
      .maybeSingle();

  if (
    revisionError ||
    !revision
  ) {
    return NextResponse.json(
      {
        message:
          'Approved document revision was not found.',
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
          revision.storage_bucket,
        storagePath:
          revision.storage_path,
        expectedSha256:
          revision.sha256,
      });

    return new NextResponse(
      buffer,
      {
        status:
          200,
        headers: {
          'Content-Type':
            revision.mime_type ||
            'application/octet-stream',
          'Content-Disposition':
            teachingDocumentContentDisposition(
              revision.original_filename,
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
            : 'Published document could not be downloaded.',
      },
      {
        status:
          409,
      },
    );
  }
}
