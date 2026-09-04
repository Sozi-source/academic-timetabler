import {
  NextResponse,
} from 'next/server';

import {
  getStudentPortalRegistrationContext,
} from '@/features/student-portal/queries';
import {
  getStudentPortalSession,
} from '@/features/student-portal/session';
import {
  buildStudentUnitRegistrationDocx,
} from '@/features/student-portal/registration-docx';

export const runtime =
  'nodejs';
export const dynamic =
  'force-dynamic';

const docxMimeType =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function GET() {
  const session =
    await getStudentPortalSession();

  if (!session) {
    return NextResponse.json(
      {
        message:
          'Student sign-in required.',
      },
      {
        status:
          401,
      },
    );
  }

  const context =
    await getStudentPortalRegistrationContext(
      session.studentId,
    );

  if (
    !context ||
    context.units.filter(
      (unit) =>
        unit.registrationStatus ===
        'registered',
    ).length ===
      0
  ) {
    return NextResponse.json(
      {
        message:
          'No active unit registration is available.',
      },
      {
        status:
          404,
      },
    );
  }

  const document = await buildStudentUnitRegistrationDocx(context);
  const filename = `${context.student.admissionNumber.replace(/[^a-zA-Z0-9_-]+/g, '-')} Unit Registration.docx`;

  return new NextResponse(new Uint8Array(document), {
    status: 200,
    headers: {
      'Content-Type': docxMimeType,
      'Content-Disposition':
        `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
