import { notFound } from 'next/navigation';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { getRecordOfWorkContext } from '@/features/teaching-documents/record-of-work-actions';
import { RecordOfWorkManager } from '@/features/teaching-documents/record-of-work-manager';

interface PageProps {
  params: Promise<{ allocationId: string }>;
}

export default async function TVETRecordOfWorkPage({ params }: PageProps) {
  await requireTrainerAccess();
  const { allocationId } = await params;

  const context = await getRecordOfWorkContext(allocationId);
  if (!context) {
    notFound();
  }

  return (
    <RecordOfWorkManager
      allocationId={allocationId}
      header={context.header}
      entries={context.entries}
    />
  );
}
