import {
  NextResponse,
} from 'next/server';

import {
  getStudentPortalRegistrationContext,
} from '@/features/student-portal/queries';
import {
  getStudentPortalSession,
} from '@/features/student-portal/session';

export const runtime =
  'nodejs';

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

  return NextResponse.json(
    {
      message:
        'The official college unit-registration template has not been configured yet.',
    },
    {
      status:
        503,
      headers: {
        'Cache-Control':
          'no-store',
      },
    },
  );
}
