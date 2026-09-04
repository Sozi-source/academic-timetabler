import { NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { buildStudentUnitRegistrationDocx } from '@/features/student-portal/registration-docx';
import { getStudentPortalRegistrationContext } from '@/features/student-portal/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const docxMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface RouteProps {
  params: Promise<{ studentId: string }>;
}

export async function GET(_request: Request, { params }: RouteProps) {
  await requireHodAccess();
  const { studentId } = await params;
  const context = await getStudentPortalRegistrationContext(studentId);

  if (!context || !context.period || !context.units.some((unit) => unit.registrationStatus === 'registered')) {
    return NextResponse.json({ message: 'No active unit registration is available.' }, { status: 404 });
  }

  const document = await buildStudentUnitRegistrationDocx(context);
  const filename = `${context.student.admissionNumber.replace(/[^a-zA-Z0-9_-]+/g, '-')} Unit Registration.docx`;

  return new NextResponse(new Uint8Array(document), {
    headers: {
      'Content-Type': docxMimeType,
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
