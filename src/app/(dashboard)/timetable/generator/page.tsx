import type {
  Metadata,
} from 'next';
import {
  CalendarCheck2,
  Sparkles,
} from 'lucide-react';

import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  getAcademicPeriods,
} from '@/features/academic-periods/queries';
import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  GeneratorWorkspace,
} from '@/features/timetable-generator/generator-workspace';
import {
  getLatestTimetableGenerationRun,
} from '@/features/timetable-generator/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Timetable Generator',
  description:
    'Automatically generate and review an institutional timetable before publication.',
};

export default async function TimetableGeneratorPage() {
  await requireHodAccess();

  const academicPeriods =
    await getAcademicPeriods();

  const selectablePeriods =
    academicPeriods.filter(
      (period) =>
        period.status === 'planned' ||
        period.status === 'active',
    );

  const activePeriod =
    selectablePeriods.find(
      (period) =>
        period.status === 'active',
    );

  const defaultPeriodId =
    activePeriod?.id ??
    selectablePeriods[0]?.id ??
    null;

  const latestRun = defaultPeriodId
    ? await getLatestTimetableGenerationRun(defaultPeriodId)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intelligent scheduling"
        title="Timetable generator"
        description="Generate a conflict-aware timetable preview using teaching allocations, trainer workload limits, rooms, working days and configured teaching slots."
        context={
          <div className="inline-flex items-center gap-2 text-sm text-text-muted">
            <CalendarCheck2
              className="size-4"
              aria-hidden="true"
            />

            {selectablePeriods.length}{' '}
            available Academic Period
            {selectablePeriods.length === 1
              ? ''
              : 's'}
          </div>
        }
        actions={
          <div className="inline-flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">
            <Sparkles
              className="size-4"
              aria-hidden="true"
            />
            Automatic planning
          </div>
        }
      />

      <GeneratorWorkspace
        academicPeriods={selectablePeriods.map(
          (period) => ({
            id: period.id,
            code: period.code,
            name: period.name,
            status: period.status,
          }),
        )}
        defaultAcademicPeriodId={defaultPeriodId}
        latestRun={latestRun}
      />
    </div>
  );
}