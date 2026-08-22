import type { Metadata } from 'next';
import { requireHodAccess } from '@/features/auth/authorization';
import { getDepartmentExecutiveReport } from '@/features/reporting/queries';
import { ReportingDashboard } from '@/features/reporting/reporting-dashboard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Executive Reports | Academic Planner',
  description: 'Comprehensive departmental academic operations reports and compliance intelligence.',
};

interface PageProps {
  searchParams: Promise<{ periodId?: string }>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  await requireHodAccess();
  const params = await searchParams;
  const data = await getDepartmentExecutiveReport(params.periodId);

  return <ReportingDashboard data={data} />;
}
