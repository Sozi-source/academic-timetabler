import { notFound } from 'next/navigation';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { getDocumentHeaderContext } from '@/features/teaching-documents/record-of-work-actions';
import { getApprovedCurriculumForUnitCode } from '@/features/teaching-documents/curriculum-content/queries';
import { getAssessmentMilestones } from '@/features/teaching-documents/assessment-milestones';
import { generateTVETCourseOutline } from '@/features/teaching-documents/tvet-standards';
import { TVETDocumentViewer } from '@/features/teaching-documents/tvet-document-viewer';

interface PageProps { params: Promise<{ allocationId: string }>; }

export default async function TVETCourseOutlinePage({ params }: PageProps) {
  await requireTrainerAccess();
  const { allocationId } = await params;
  const header = await getDocumentHeaderContext(allocationId);
  if (!header) notFound();

  const [curriculum, milestones] = await Promise.all([
    getApprovedCurriculumForUnitCode(header.unitCode, header.unitName, 'course_outline'),
    getAssessmentMilestones(header.academicPeriodId ?? undefined),
  ]);

  if (!curriculum) {
    return <div className="rounded-xl border border-border bg-surface p-6 text-sm text-text-muted">Curriculum content is not configured for this unit.</div>;
  }
  const courseOutline = generateTVETCourseOutline(header, curriculum, milestones);
  return <TVETDocumentViewer type="course_outline" allocationId={allocationId} courseOutline={courseOutline} />;
}
