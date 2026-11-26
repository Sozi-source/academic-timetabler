import type { Metadata } from 'next';
import { ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { getAcademicPeriods } from '@/features/academic-periods/queries';
import {
  isTimetableConfigurablePeriod,
  prioritizeActiveAcademicPeriods,
  resolveAcademicPeriodId,
} from '@/features/academic-periods/selection';
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

  const periods = prioritizeActiveAcademicPeriods(
    (await getAcademicPeriods()).filter((period) =>
      isTimetableConfigurablePeriod(period),
    ),
  );
  const params = await searchParams;
  const selectedId = resolveAcademicPeriodId(periods, params.academicPeriodId) || null;
  const data = selectedId
    ? await getTimetableConflictCenterData(selectedId)
    : null;

  return (
    <div className="admin-screen space-y-5">
      <PageHeader
        eyebrow="Enterprise scheduling"
        title="Conflict resolution centre"
        backHref="/timetable"
        backLabel="Timetabling"
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
