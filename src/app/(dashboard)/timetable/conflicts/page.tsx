import type { Metadata } from 'next';
import { ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { getAcademicPeriods } from '@/features/academic-periods/queries';
import { requireHodAccess } from '@/features/auth/authorization';
import { TimetableConflictCenter } from '@/features/timetable-conflicts/conflict-center';
import { getTimetableConflictCenterData } from '@/features/timetable-conflicts/queries';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Timetable Conflict Centre',
  description: 'Detect, review and resolve timetable conflicts.',
};

export default async function TimetableConflictsPage({
  searchParams,
}: {
  searchParams: Promise<{ academicPeriodId?: string }>;
}) {
  await requireHodAccess();

  const periods = (await getAcademicPeriods()).filter(
    (period) => period.status === 'active' || period.status === 'planned',
  );
  const params = await searchParams;
  const selectedId =
    params.academicPeriodId ??
    periods.find((period) => period.status === 'active')?.id ??
    periods[0]?.id ??
    null;
  const data = selectedId
    ? await getTimetableConflictCenterData(selectedId)
    : null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Enterprise scheduling"
        title="Conflict resolution centre"
        description="Detect trainer, cohort and room clashes before approval or publication."
        actions={<Badge variant="danger"><ShieldAlert className="size-3.5" /> Live validation</Badge>}
      />

      <Card className="p-4">
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium text-text-primary">Academic Period</span>
            <Select id="academicPeriodId" name="academicPeriodId" defaultValue={selectedId ?? ''}>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.code} — {period.name}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit">Load</Button>
        </form>
      </Card>

      {selectedId && data ? (
        <TimetableConflictCenter academicPeriodId={selectedId} data={data} />
      ) : (
        <EmptyState icon={ShieldAlert} title="No conflicts to review" description="No active or planned Academic Period is available." />
      )}
    </div>
  );
}
