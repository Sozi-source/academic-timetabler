import type { Metadata } from 'next';
import { FileChartColumn } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { getAcademicPeriods } from '@/features/academic-periods/queries';
import { requireHodAccess } from '@/features/auth/authorization';
import { TimetablePublicationWorkspace } from '@/features/timetable-publication/publication-workspace';
import { getTimetableVersions } from '@/features/timetable-publication/queries';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Published Timetables',
  description: 'Validate and publish incrementally versioned institutional timetables.',
};

export default async function PublishedTimetablesPage({
  searchParams,
}: {
  searchParams: Promise<{ academicPeriodId?: string }>;
}) {
  await requireHodAccess();
  const periods = (await getAcademicPeriods()).filter((period) => period.status === 'active' || period.status === 'planned' || period.status === 'archived');
  const params = await searchParams;
  const selectedId = params.academicPeriodId ?? periods.find((period) => period.status === 'active')?.id ?? periods[0]?.id ?? null;
  const selectedPeriod = periods.find((period) => period.id === selectedId) ?? null;
  const versions = selectedId ? await getTimetableVersions(selectedId) : [];

  return <div className="space-y-5">
    <PageHeader
      eyebrow="Step 4 of 4"
      title="Timetable publication"
      description="Run the final checks and publish the current timetable in one step. Every replacement remains available in version history."
      actions={<Badge variant="primary"><FileChartColumn className="size-3.5"/> Direct publishing</Badge>}
    />

    <Card className="p-4">
      <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 space-y-1.5">
          <span className="text-sm font-medium text-text-primary">Academic Period</span>
          <Select id="academicPeriodId" name="academicPeriodId" defaultValue={selectedId ?? ''}>
            {periods.map((period) => <option key={period.id} value={period.id}>{period.code} — {period.name}</option>)}
          </Select>
        </label>
        <Button type="submit">Load versions</Button>
      </form>
    </Card>

    {selectedId && selectedPeriod ? <TimetablePublicationWorkspace academicPeriodId={selectedId} academicPeriodName={selectedPeriod.name} canPublish={selectedPeriod.status === 'active' || selectedPeriod.status === 'planned'} versions={versions}/> : <EmptyState icon={FileChartColumn} title="No timetable to publish" description="No Academic Period is available." />}
  </div>;
}
