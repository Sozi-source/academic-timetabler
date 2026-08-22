import { notFound } from 'next/navigation';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { getDocumentHeaderContext } from '@/features/teaching-documents/record-of-work-actions';
import { generateTVETSchemeOfWork } from '@/features/teaching-documents/tvet-standards';
import { TVETDocumentViewer } from '@/features/teaching-documents/tvet-document-viewer';

interface PageProps {
  params: Promise<{ allocationId: string }>;
}

export default async function TVETSchemeOfWorkPage({ params }: PageProps) {
  await requireTrainerAccess();
  const { allocationId } = await params;

  const header = await getDocumentHeaderContext(allocationId);

  if (!header) {
    notFound();
  }

  const schemeOfWork = generateTVETSchemeOfWork(header);

  return (
    <TVETDocumentViewer
      type="scheme_of_work"
      allocationId={allocationId}
      schemeOfWork={schemeOfWork}
    />
  );
}
