import type { Metadata } from 'next';
import { FileChartColumn } from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';
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

  return <div className="space-y-6">
    <PageHeader
      eyebrow="Step 4 of 4"
      title="Timetable publication"
      description="Run the final checks and publish the current timetable in one step. Every replacement remains available in version history."
      actions={<div className="inline-flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-sm font-semibold text-primary"><FileChartColumn className="size-4"/> Direct publishing</div>}
    />

    <form method="get" className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <label className="text-sm font-semibold text-text-primary" htmlFor="academicPeriodId">Academic Period</label>
      <div className="mt-2 flex gap-2">
        <select id="academicPeriodId" name="academicPeriodId" defaultValue={selectedId ?? ''} className="h-11 flex-1 rounded-xl border border-border-strong bg-surface px-3 text-sm">
          {periods.map((period) => <option key={period.id} value={period.id}>{period.code} — {period.name}</option>)}
        </select>
        <button className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white" type="submit">Load versions</button>
      </div>
    </form>

    {selectedId && selectedPeriod ? <TimetablePublicationWorkspace academicPeriodId={selectedId} academicPeriodName={selectedPeriod.name} canPublish={selectedPeriod.status === 'active' || selectedPeriod.status === 'planned'} versions={versions}/> : <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-text-muted">No Academic Period is available.</div>}
  </div>;
}
