import { NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { buildStudentKnecBookingPdf } from '@/features/knec/booking-pdf';
import { getKnecBookingFormContext } from '@/features/knec/queries';
import { getStudentPortalSession } from '@/features/student-portal/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const paramStudentId = searchParams.get('studentId')?.trim() || null;
  const bookingId = searchParams.get('bookingId')?.trim() || undefined;

  let targetStudentId: string | null = null;

  if (paramStudentId) {
    try {
      await requireHodAccess();
      targetStudentId = paramStudentId;
    } catch {
      return NextResponse.json({ message: 'Administrative authorization required.' }, { status: 401 });
    }
  } else {
    const session = await getStudentPortalSession();
    if (!session) {
      return NextResponse.json({ message: 'Student session required.' }, { status: 401 });
    }
    targetStudentId = session.studentId;
  }

  const context = await getKnecBookingFormContext({ studentId: targetStudentId, bookingId });
  if (!context) {
    return NextResponse.json(
      { message: 'No KNEC examination booking record found to generate clearance PDF.' },
      { status: 404 },
    );
  }

  const pdf = await buildStudentKnecBookingPdf(context);
  const safeAdm = context.student.admissionNumber.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const safeSeries = context.booking.seriesCode || 'KNEC';
  const filename = `${safeAdm}-KNEC-Booking-${safeSeries}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
    },
  });
}
