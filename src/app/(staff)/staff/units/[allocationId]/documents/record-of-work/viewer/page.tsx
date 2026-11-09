import { notFound } from 'next/navigation';
import { requireTrainerAccess } from '@/features/auth/authorization';
import {
  getDocumentHeaderContext,
  getRecordOfWorkContext,
} from '@/features/teaching-documents/record-of-work-actions';
import { computeRecordOfWorkSummary } from '@/features/teaching-documents/tvet-standards';
import { TVETDocumentViewer } from '@/features/teaching-documents/tvet-document-viewer';
import { getTeachingDocumentAllocationStatus } from '@/features/teaching-documents/trainer-submission-actions';

interface PageProps {
  params: Promise<{ allocationId: string }>;
}

export default async function TVETRecordOfWorkViewerPage({ params }: PageProps) {
  await requireTrainerAccess();
  const { allocationId } = await params;
  const header = await getDocumentHeaderContext(allocationId);
  if (!header) notFound();

  const [rowContext, initialStatus] = await Promise.all([
    getRecordOfWorkContext(allocationId),
    getTeachingDocumentAllocationStatus(allocationId, 'record_of_work'),
  ]);

  const recordOfWork = computeRecordOfWorkSummary(
    header,
    rowContext?.entries ?? [],
  );

  return (
    <TVETDocumentViewer
      type="record_of_work"
      allocationId={allocationId}
      recordOfWork={recordOfWork}
      initialStatus={initialStatus}
    />
  );
}
