import { Award } from 'lucide-react';
import { redirect } from 'next/navigation';

import { StudentPortalShell } from '@/components/student/student-portal-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { StudentKnecBookingClient } from '@/features/knec/student-knec-booking-client';
import { getKnecBookingFormContext, getStudentKnecPortalData } from '@/features/knec/queries';
import { getStudentPortalIdentity } from '@/features/student-portal/queries';
import { getStudentPortalSession } from '@/features/student-portal/session';

export const dynamic = 'force-dynamic';

export default async function StudentKnecPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>;
}) {
  const session = await getStudentPortalSession();
  if (!session) {
    redirect('/student/login');
  }

  const params = await searchParams;
  const [identity, knecData, formContext] = await Promise.all([
    getStudentPortalIdentity(session.studentId),
    getStudentKnecPortalData(session.studentId),
    getKnecBookingFormContext({ studentId: session.studentId, bookingId: params.bookingId }),
  ]);

  if (!identity) {
    redirect('/student/login');
  }

  return (
    <StudentPortalShell student={identity}>
      {!knecData ? (
        <EmptyState
          icon={Award}
          title="KNEC profile unavailable"
          description="Your student KNEC profile could not be initialized. Contact your HOD."
        />
      ) : (
        <StudentKnecBookingClient
          summary={knecData.summary}
          openSeries={knecData.openSeries}
          latestFormContext={formContext}
        />
      )}
    </StudentPortalShell>
  );
}
