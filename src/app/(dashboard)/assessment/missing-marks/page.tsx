import type { Metadata } from 'next';
import { UserX } from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';
import { getMissingMarksAndAbsencesData } from '@/features/assessment/missing-marks';
import { MissingMarksWorkspace } from '@/features/assessment/missing-marks-workspace';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Missing Marks & Absences | Exam Control',
  description: 'Review students with missing CAT/Exam marks or marked absent across department units.',
};

export default async function MissingMarksPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const data = await getMissingMarksAndAbsencesData(period);

  return (
    <div className="admin-screen space-y-5">
      <div className="print:hidden">
        <PageHeader
          title="Missing Marks & Absences"
          icon={UserX}
        />
      </div>

      <MissingMarksWorkspace
        departmentName={data.departmentName}
        periods={data.periods}
        selectedPeriodId={data.selectedPeriodId}
        selectedPeriodName={data.selectedPeriodName}
        records={data.records}
      />
    </div>
  );
}
