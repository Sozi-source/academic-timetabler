import { requireHodAccess } from '@/features/auth/authorization';
import { getAssessmentControlCenterData } from '@/features/assessment/control-center-queries';
import { AssessmentControlCenter } from '@/features/assessment/assessment-control-center';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AssessmentModulePage({ searchParams }: PageProps) {
  await requireHodAccess();
  const params = await searchParams;
  const periodId = typeof params.periodId === 'string' ? params.periodId : undefined;

  const data = await getAssessmentControlCenterData(periodId);

  return <AssessmentControlCenter data={data} />;
}
