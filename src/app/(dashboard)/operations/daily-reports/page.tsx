import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  FileDown,
  Printer,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/ui/page-header';
import {
  formatDailyReportDate,
  nairobiToday,
  normalizeDailyReportDate,
} from '@/features/trainer-daily-report/domain';
import { HodDailyReportList } from '@/features/trainer-daily-report/hod-report-list';
import { getDepartmentDailyReports } from '@/features/trainer-daily-report/queries';

interface PageProps {
  searchParams: Promise<{
    date?: string;
  }>;
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <p className="text-xl font-semibold tracking-tight text-text-primary">
        {value}
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </p>
    </div>
  );
}

export default async function DailyReportsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const reportDate = normalizeDailyReportDate(params.date);
  const workspace = await getDepartmentDailyReports(reportDate);
  const today = nairobiToday();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Academic operations"
        title="Trainer Daily Reports"
        description="Daily teaching attendance, absences and concerns for HOD review."
        icon={ClipboardList}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/operations/daily-reports/export-word?date=${reportDate}`}
              download
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-900 transition hover:bg-blue-100"
            >
              <FileDown className="size-4 text-blue-700" />
              Download Word (.docx)
            </a>
            <Link
              href={`/operations/daily-reports/print?date=${reportDate}`}
              target="_blank"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              <Printer className="size-4" />
              Management copy
            </Link>
          </div>
        }
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
              {workspace.departmentName}
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          label="Expected"
          value={workspace.summary.expectedTrainers}
        />
        <SummaryCard
          label="Submitted"
          value={workspace.summary.submittedReports}
        />
        <SummaryCard
          label="Pending"
          value={workspace.summary.pendingReports}
        />
        <SummaryCard
          label="Reported lessons"
          value={workspace.summary.scheduledLessons}
        />
        <SummaryCard
          label="Absences"
          value={workspace.summary.recordedAbsences}
        />
        <SummaryCard
          label="Concerns"
          value={workspace.summary.concerns}
        />
      </section>

      {workspace.pendingTrainers.length > 0 ? (
        <section className="rounded-xl border border-warning-border bg-warning-surface p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <p className="text-xs font-semibold text-text-primary">
                Pending reports
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {workspace.pendingTrainers.map((trainer) => (
                  <span
                    key={trainer.trainerId}
                    className="inline-flex items-center gap-1 rounded-md border border-warning-border bg-white px-2 py-1 text-[10px] text-text-secondary"
                  >
                    <UsersRound className="size-3" />
                    {trainer.trainerName}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <HodDailyReportList workspace={workspace} />
    </div>
  );
}
