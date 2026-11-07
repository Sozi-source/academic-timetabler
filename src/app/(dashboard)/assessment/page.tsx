import { requireHodAccess } from '@/features/auth/authorization';
import { getAssessmentControlCenterData } from '@/features/assessment/control-center-queries';
import { AssessmentControlCenter } from '@/features/assessment/assessment-control-center';
import { PendingMarkSubmissionsPanel } from '@/features/assessment/marks/pending-mark-submissions-panel';
import { getPendingMarkSubmissions } from '@/features/assessment/marks/pending-submissions';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AssessmentModulePage({ searchParams }: PageProps) {
  await requireHodAccess();
  const params = await searchParams;
  const periodId = typeof params.periodId === 'string' ? params.periodId : undefined;

  const [data, pendingSubmissions] = await Promise.all([
    getAssessmentControlCenterData(periodId),
    getPendingMarkSubmissions(),
  ]);

  return (
    <div className="space-y-5">
      <PendingMarkSubmissionsPanel items={pendingSubmissions} />
      <AssessmentControlCenter data={data} />
    </div>
  );
}
