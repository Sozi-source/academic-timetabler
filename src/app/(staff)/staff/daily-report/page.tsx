import Link from 'next/link';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  RotateCcw,
} from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';
import {
  formatDailyReportDate,
  nairobiToday,
  normalizeDailyReportDate,
  shiftDailyReportDate,
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
  const isToday = reportDate === today;
  const prevDate = shiftDailyReportDate(reportDate, -1);
  const nextDate = shiftDailyReportDate(reportDate, 1);
  const canGoNext = reportDate < today;

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4">
      <PageHeader
        eyebrow="Faculty Operations"
        title="Daily Report"
        description="Daily lesson attendance register, student absences, and activity reporting."
        icon={ClipboardCheck}
      />

      {/* Date Navigation & Context Bar */}
      <section className="rounded-xl border border-border bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-text-primary">
                {formatDailyReportDate(reportDate)}
              </h2>
              {isToday ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  Today
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  Historical
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-text-muted">
              {workspace.trainerName}
              {workspace.trainerNumber ? ` (${workspace.trainerNumber})` : ''} · {workspace.homeDepartmentName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Step Controls */}
            <div className="inline-flex items-center rounded-lg border border-border bg-slate-50/50 p-0.5 shadow-2xs">
              <Link
                href={`/staff/daily-report?date=${prevDate}`}
                aria-label="Previous day"
                className="inline-flex size-7.5 items-center justify-center rounded-md text-text-secondary transition hover:bg-white hover:text-text-primary hover:shadow-xs"
              >
                <ChevronLeft className="size-4" />
              </Link>

              {canGoNext ? (
                <Link
                  href={`/staff/daily-report?date=${nextDate}`}
                  aria-label="Next day"
                  className="inline-flex size-7.5 items-center justify-center rounded-md text-text-secondary transition hover:bg-white hover:text-text-primary hover:shadow-xs"
                >
                  <ChevronRight className="size-4" />
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="inline-flex size-7.5 items-center justify-center rounded-md text-text-muted/40 cursor-not-allowed"
                >
                  <ChevronRight className="size-4" />
                </span>
              )}
            </div>

            {/* Direct Date Picker Form */}
            <form method="get" className="flex items-center gap-1.5">
              <div className="relative">
                <input
                  type="date"
                  name="date"
                  defaultValue={reportDate}
                  max={today}
                  aria-label="Select report date"
                  className="h-8 rounded-lg border border-border bg-slate-50/50 px-2.5 text-xs text-text-primary outline-none focus:border-primary focus:bg-white"
                />
              </div>

              <button
                type="submit"
                className="h-8 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle shadow-2xs"
              >
                Go
              </button>
            </form>

            {!isToday ? (
              <Link
                href={`/staff/daily-report?date=${today}`}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
              >
                <RotateCcw className="size-3" />
                Today
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <TrainerDailyReportForm workspace={workspace} />
    </div>
  );
}
