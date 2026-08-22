import { notFound } from 'next/navigation';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { getDocumentHeaderContext } from '@/features/teaching-documents/record-of-work-actions';
import { getApprovedCurriculumForUnitCode } from '@/features/teaching-documents/curriculum-content/queries';
import { generateTVETSchemeOfWork } from '@/features/teaching-documents/tvet-standards';
import { TVETDocumentViewer } from '@/features/teaching-documents/tvet-document-viewer';

interface PageProps { params: Promise<{ allocationId: string }>; }

export default async function TVETSchemeOfWorkPage({ params }: PageProps) {
  await requireTrainerAccess();
  const { allocationId } = await params;
  const header = await getDocumentHeaderContext(allocationId);
  if (!header) notFound();

  const curriculum = await getApprovedCurriculumForUnitCode(header.unitCode,header.unitName);
  if (!curriculum) {
    return <div className="rounded-xl border border-border bg-surface p-6 text-sm text-text-muted">Curriculum content is not configured for this unit.</div>;
  }
  const schemeOfWork = generateTVETSchemeOfWork(header,curriculum);
  return <TVETDocumentViewer type="scheme_of_work" allocationId={allocationId} schemeOfWork={schemeOfWork} />;
}
