import { notFound } from 'next/navigation';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { getRecordOfWorkContext } from '@/features/teaching-documents/record-of-work-actions';
import { computeRecordOfWorkSummary } from '@/features/teaching-documents/tvet-standards';
import { TVETDocumentViewer } from '@/features/teaching-documents/tvet-document-viewer';

interface PageProps {
  params: Promise<{ allocationId: string }>;
}

export default async function TVETRecordOfWorkPrintPage({ params }: PageProps) {
  await requireTrainerAccess();
  const { allocationId } = await params;

  const context = await getRecordOfWorkContext(allocationId);

  if (!context) {
    notFound();
  }

  const recordOfWorkData = computeRecordOfWorkSummary(
    context.header,
    context.entries
  );

  return (
    <TVETDocumentViewer
      type="record_of_work"
      allocationId={allocationId}
      recordOfWork={recordOfWorkData}
    />
  );
}
