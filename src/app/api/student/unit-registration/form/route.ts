import { NextResponse } from 'next/server';

import { buildStudentUnitRegistrationDocx } from '@/features/student-portal/registration-docx';
import { getStudentPortalRegistrationContext } from '@/features/student-portal/queries';
import { getStudentPortalSession } from '@/features/student-portal/session';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getStudentPortalSession();
  if (!session) return NextResponse.json({ message: 'Student sign-in required.' }, { status: 401 });

  const context = await getStudentPortalRegistrationContext(session.studentId);
  if (!context?.submission || !['submitted', 'verified'].includes(context.submission.status)) {
    return NextResponse.json({ message: 'Submit unit registration before downloading the form.' }, { status: 400 });
  }

  const buffer = await buildStudentUnitRegistrationDocx(context);
  const safeAdmission = context.student.admissionNumber.replace(/[^a-zA-Z0-9_-]+/g, '-');

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="unit-registration-${safeAdmission}.docx"`,
      'Cache-Control': 'no-store',
    },
  });
}
