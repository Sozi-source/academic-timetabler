import { redirect } from 'next/navigation';
import { requireTrainerAccess } from '@/features/auth/authorization';

interface PageProps {
  params: Promise<{
    allocationId: string;
  }>;
}

export default async function CATAttendancePage({ params }: PageProps) {
  await requireTrainerAccess();
  const { allocationId } = await params;
  redirect(`/api/staff/units/${allocationId}/attendance-sheet/cat?format=pdf`);
}
