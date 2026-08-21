import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { getAcademicPeriods } from '@/features/academic-periods/queries';
import { requireHodAccess } from '@/features/auth/authorization';
import { ConstraintWorkspace } from '@/features/scheduling-constraints/constraint-workspace';
import { getSchedulingConstraintData } from '@/features/scheduling-constraints/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Scheduling Constraints',
  description: 'Manage exceptional room, cohort and institution scheduling restrictions.',
};

export default async function ConstraintsPage({
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

  const selectedPeriod = periods.find((period) => period.id === selectedId);
  const data = selectedId
    ? await getSchedulingConstraintData(selectedId)
    : null;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Scheduling"
        title="Scheduling constraints"
        description="Exceptional restrictions for rooms, classes and institution-wide periods."
        context={
          selectedPeriod ? (
            <span className="text-xs font-medium text-text-muted xl:text-sm">
              {selectedPeriod.name}
            </span>
          ) : undefined
        }
      />

      <Card className="p-3 xl:p-4">
        <form
          method="get"
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <label className="min-w-0 flex-1 text-xs font-semibold text-text-primary xl:text-sm">
            Academic Period
            <Select
              id="academicPeriodId"
              name="academicPeriodId"
              defaultValue={selectedId ?? ''}
              className="mt-1.5"
            >
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.code} - {period.name}
                  {period.status === 'active' ? ' (active)' : ''}
                </option>
              ))}
            </Select>
          </label>

          <Button type="submit" variant="outline">
            Load
          </Button>
        </form>
      </Card>

      {selectedId && data ? (
        <ConstraintWorkspace academicPeriodId={selectedId} data={data} />
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title="No constraints to show"
          description="No active or planned Academic Period is available."
        />
      )}
    </div>
  );
}
