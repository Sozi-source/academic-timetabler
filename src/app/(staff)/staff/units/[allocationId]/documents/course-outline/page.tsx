import { notFound } from 'next/navigation';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { getDocumentHeaderContext } from '@/features/teaching-documents/record-of-work-actions';
import { generateTVETCourseOutline } from '@/features/teaching-documents/tvet-standards';
import { TVETDocumentViewer } from '@/features/teaching-documents/tvet-document-viewer';

interface PageProps {
  params: Promise<{ allocationId: string }>;
}

export default async function TVETCourseOutlinePage({ params }: PageProps) {
  await requireTrainerAccess();
  const { allocationId } = await params;

  const header = await getDocumentHeaderContext(allocationId);

  if (!header) {
    notFound();
  }

  const courseOutline = generateTVETCourseOutline(header);

  return (
    <TVETDocumentViewer
      type="course_outline"
      allocationId={allocationId}
      courseOutline={courseOutline}
    />
  );
}
