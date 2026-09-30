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
  prioritizeActiveAcademicPeriods,
} from '@/features/academic-periods/selection';
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
    prioritizeActiveAcademicPeriods(
      academicPeriods.filter(
        (period) =>
          period.academicYear.status === 'active' &&
          (period.status === 'planned' ||
            period.status === 'active'),
      ),
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
    <div className="admin-screen space-y-6">
      <PageHeader
        eyebrow="Step 2 of 4"
        title="Generate timetable"
        backHref="/timetable"
        backLabel="Timetabling"
        context={
          <span className="text-sm text-text-muted">
            {selectablePeriods.length} period{selectablePeriods.length === 1 ? '' : 's'} available
          </span>
        }
        actions={
          <div className="inline-flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">
            <Sparkles
              className="size-4"
              aria-hidden="true"
            />
            Automatic
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
