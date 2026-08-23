import {
  CalendarDays,
  ClipboardCheck,
} from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';
import {
  formatDailyReportDate,
  nairobiToday,
  normalizeDailyReportDate,
} from '@/features/trainer-daily-report/domain';
import { getTrainerDailyReportWorkspace } from '@/features/trainer-daily-report/queries';
import { TrainerDailyReportForm } from '@/features/trainer-daily-report/trainer-form';

interface PageProps {
  searchParams: Promise<{
    date?: string;
  }>;
}

export default async function TrainerDailyReportPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const reportDate = normalizeDailyReportDate(params?.date);

  const workspace = await getTrainerDailyReportWorkspace(reportDate).catch((err) => {
    console.error('Failed to load trainer daily report workspace:', err);
    return {
      reportDate,
      trainerId: '',
      trainerName: 'Trainer',
      trainerNumber: null,
      homeDepartmentId: '',
      homeDepartmentName: 'Academic Department',
      status: 'draft' as const,
      reportId: null,
      submittedAt: null,
      otherActivity: '',
      concern: '',
      readyToSubmit: true,
      blockingReason: null,
      lessons: [],
    };
  });

  const today = nairobiToday();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Daily teaching record"
        title="Daily Report"
        description="Scheduled lessons, absentees and brief operational notes."
        icon={ClipboardCheck}
      />

      <section className="rounded-xl border border-border bg-white p-4">
        <form
          method="get"
          className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <p className="text-xs font-semibold text-text-primary">
              {formatDailyReportDate(reportDate)}
            </p>
            <p className="mt-1 text-[10px] text-text-muted">
              {workspace.trainerName} · {workspace.homeDepartmentName}
            </p>
          </div>

          <label className="flex items-center gap-2">
            <CalendarDays className="size-4 text-text-muted" />
            <input
              type="date"
              name="date"
              defaultValue={reportDate}
              max={today}
              className="h-9 rounded-lg border border-border bg-white px-3 text-xs text-text-primary"
            />
            <button
              type="submit"
              className="h-9 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              View
            </button>
          </label>
        </form>
      </section>

      <TrainerDailyReportForm workspace={workspace} />
    </div>
  );
}
