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
          'Student session is required.',
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
        'id, department_id, current_cohort_id',
      )
      .eq(
        'id',
        session.studentId,
      )
      .maybeSingle();

  if (
    studentError ||
    !student ||
    !student.current_cohort_id
  ) {
    return NextResponse.json(
      {
        message:
          'Student access is unavailable.',
      },
      {
        status:
          404,
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
        'id, academic_period_id, cohort_id, unit_id, status, student_visible, approved_revision_number',
      )
      .eq(
        'id',
        documentId,
      )
      .maybeSingle();

  if (
    documentError ||
    !document ||
    document.status !==
      'approved' ||
    document.student_visible !==
      true ||
    !document.approved_revision_number ||
    document.cohort_id !==
      student.current_cohort_id
  ) {
    return NextResponse.json(
      {
        message:
          'Approved student document was not found.',
      },
      {
        status:
          404,
      },
    );
  }

  const {
    data:
      registration,
    error:
      registrationError,
  } =
    await admin
      .from(
        'student_unit_registrations',
      )
      .select(
        'id',
      )
      .eq(
        'student_id',
        session.studentId,
      )
      .eq(
        'academic_period_id',
        document.academic_period_id,
      )
      .eq(
        'cohort_id',
        document.cohort_id,
      )
      .eq(
        'unit_id',
        document.unit_id,
      )
      .eq(
        'registration_status',
        'registered',
      )
      .limit(
        1,
      )
      .maybeSingle();

  if (
    registrationError ||
    !registration
  ) {
    return NextResponse.json(
      {
        message:
          'This document is outside your registered units.',
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
        'revision_number, storage_bucket, storage_path, original_filename, mime_type, sha256',
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

    const {
      error:
        auditError,
    } =
      await admin
        .from(
          'student_document_download_events',
        )
        .insert({
          student_id:
            session.studentId,
          department_id:
            student.department_id,
          cohort_id:
            document.cohort_id,
          unit_id:
            document.unit_id,
          document_id:
            document.id,
          revision_number:
            revision.revision_number,
        });

    if (auditError) {
      return NextResponse.json(
        {
          message:
            'Document download could not be audited.',
        },
        {
          status:
            500,
        },
      );
    }

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
