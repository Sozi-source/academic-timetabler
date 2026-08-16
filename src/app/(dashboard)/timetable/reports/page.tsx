import type { Metadata } from 'next';
import { BarChart3 } from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';
import { getAcademicPeriods } from '@/features/academic-periods/queries';
import { requireHodAccess } from '@/features/auth/authorization';
import {
  getInstitutionTrainerTimetableReportsData,
  getTimetableReportsData,
} from '@/features/timetable-reports/queries';
import { TimetableReportsWorkspace } from '@/features/timetable-reports/report-workspace';
import type { TimetableReportKind } from '@/features/timetable-reports/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Timetable Reports',
  description: 'Operational timetable, workload and room-utilization reports.',
};

const reportOptions: Array<{ value: TimetableReportKind; label: string }> = [
  { value: 'master', label: 'Master timetable' },
  { value: 'cohort', label: 'Cohort timetables' },
  { value: 'trainer', label: 'Trainer timetables' },
  { value: 'room', label: 'Room timetables' },
  { value: 'workload', label: 'Trainer workload' },
];

function isReportKind(value: string | undefined): value is TimetableReportKind {
  return reportOptions.some((option) => option.value === value);
}

export default async function TimetableReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ academicPeriodId?: string; report?: string }>;
}) {
  await requireHodAccess();
  const periods = (await getAcademicPeriods()).filter((period) =>
    ['active', 'planned', 'archived'].includes(period.status),
  );
  const params = await searchParams;
  const selectedId = params.academicPeriodId
    ?? periods.find((period) => period.status === 'active')?.id
    ?? periods[0]?.id
    ?? null;
  const report: TimetableReportKind = isReportKind(params.report)
    ? params.report
    : 'master';
  const data = selectedId
    ? report === 'trainer' || report === 'workload'
      ? await getInstitutionTrainerTimetableReportsData(selectedId)
      : await getTimetableReportsData(selectedId)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Enterprise reporting"
        title="Timetable reports"
        description="Review the master timetable, cohort schedules, workloads and room usage."
        actions={(
          <div className="inline-flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">
            <BarChart3 className="size-4" aria-hidden="true" />
            Operational intelligence
          </div>
        )}
      />

      <form method="get" className="grid gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="text-sm font-semibold text-text-primary" htmlFor="academicPeriodId">
          Academic Period
          <select id="academicPeriodId" name="academicPeriodId" defaultValue={selectedId ?? ''} className="mt-2 h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm font-normal">
            {periods.map((period) => (
              <option key={period.id} value={period.id}>{period.code} — {period.name}</option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-text-primary" htmlFor="report">
          Report
          <select id="report" name="report" defaultValue={report} className="mt-2 h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm font-normal">
            {reportOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <button className="h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-white" type="submit">
          Load report
        </button>
      </form>

      {selectedId && data ? (
        <TimetableReportsWorkspace academicPeriodId={selectedId} data={data} report={report} />
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-text-muted">
          No Academic Period is available for reporting.
        </div>
      )}
    </div>
  );
}
