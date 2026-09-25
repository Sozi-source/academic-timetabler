import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  FileDown,
  Printer,
  RotateCcw,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/ui/page-header';
import {
  formatDailyReportDate,
  nairobiToday,
  normalizeDailyReportDate,
  shiftDailyReportDate,
} from '@/features/trainer-daily-report/domain';
import { HodDailyReportList } from '@/features/trainer-daily-report/hod-report-list';
import { getDepartmentDailyReports } from '@/features/trainer-daily-report/queries';

interface PageProps {
  searchParams: Promise<{
    date?: string;
  }>;
}

export default async function DailyReportsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const reportDate = normalizeDailyReportDate(params.date);
  const workspace = await getDepartmentDailyReports(reportDate);
  const today = nairobiToday();
  const yesterday = shiftDailyReportDate(today, -1);
  const prevDate = shiftDailyReportDate(reportDate, -1);
  const nextDate = shiftDailyReportDate(reportDate, 1);
  const isToday = reportDate === today;
  const isYesterday = reportDate === yesterday;
  const canGoNext = reportDate < today;

  const stats = [
    { label: 'Expected', value: workspace.summary.expectedTrainers },
    { label: 'Submitted', value: workspace.summary.submittedReports },
    { label: 'Pending', value: workspace.summary.pendingReports },
    { label: 'Lessons', value: workspace.summary.scheduledLessons },
    { label: 'Absences', value: workspace.summary.recordedAbsences, accent: workspace.summary.recordedAbsences > 0 },
    { label: 'Concerns', value: workspace.summary.concerns, accent: workspace.summary.concerns > 0 },
  ];

  const showRecentBanner =
    workspace.recentSubmissions && workspace.recentSubmissions.length > 0 && isToday && workspace.summary.submittedReports === 0;
  const showPendingBanner = workspace.pendingTrainers.length > 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      <PageHeader
        eyebrow="Academic operations"
        title="Trainer Daily Reports"
        description="Daily teaching attendance, absences and concerns for HOD review."
        icon={ClipboardList}
        backHref="/dashboard"
        backLabel="Dashboard"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/operations/daily-reports/export-word?date=${reportDate}`}
              download
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-900 transition hover:bg-blue-100"
            >
              <FileDown className="size-4 text-blue-700" />
              <span className="hidden sm:inline">Download Word (.docx)</span>
              <span className="sm:hidden">Word</span>
            </a>
            <Link
              href={`/operations/daily-reports/print?date=${reportDate}`}
              target="_blank"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              <Printer className="size-4" />
              <span className="hidden sm:inline">Management copy</span>
              <span className="sm:hidden">Print</span>
            </Link>
          </div>
        }
      />

      {/* ================================================================= */}
      {/* Merged banner: date context + step controls + the metric strip,   */}
      {/* one native-app-style card instead of a date bar plus six tiles.   */}
      {/* ================================================================= */}
      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-xs">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-text-primary">
                {formatDailyReportDate(reportDate)}
              </h2>
              {isToday ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  Today
                </span>
              ) : isYesterday ? (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                  Yesterday
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  Historical
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-text-muted">
              {workspace.departmentName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Step Controls */}
            <div className="inline-flex items-center rounded-lg border border-border bg-slate-50/50 p-0.5 shadow-2xs">
              <Link
                href={`/operations/daily-reports?date=${prevDate}`}
                aria-label="Previous day"
                className="inline-flex size-8 items-center justify-center rounded-md text-text-secondary transition active:bg-white active:shadow-xs sm:size-7.5 sm:hover:bg-white sm:hover:text-text-primary sm:hover:shadow-xs"
              >
                <ChevronLeft className="size-4" />
              </Link>

              {canGoNext ? (
                <Link
                  href={`/operations/daily-reports?date=${nextDate}`}
                  aria-label="Next day"
                  className="inline-flex size-8 items-center justify-center rounded-md text-text-secondary transition active:bg-white active:shadow-xs sm:size-7.5 sm:hover:bg-white sm:hover:text-text-primary sm:hover:shadow-xs"
                >
                  <ChevronRight className="size-4" />
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="inline-flex size-8 items-center justify-center rounded-md text-text-muted/40 cursor-not-allowed sm:size-7.5"
                >
                  <ChevronRight className="size-4" />
                </span>
              )}
            </div>

            {/* Quick jump to Yesterday if not already on yesterday */}
            {!isYesterday ? (
              <Link
                href={`/operations/daily-reports?date=${yesterday}`}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-text-secondary transition active:bg-surface-subtle shadow-2xs"
              >
                Yesterday
              </Link>
            ) : null}

            {/* Quick jump to Today if not on today */}
            {!isToday ? (
              <Link
                href={`/operations/daily-reports?date=${today}`}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2.5 text-xs font-semibold text-primary transition active:bg-primary/10 shadow-2xs"
              >
                <RotateCcw className="size-3" />
                Today
              </Link>
            ) : null}

            {/* Direct Date Picker Form */}
            <form method="get" className="flex items-center gap-1.5">
              <div className="flex items-center gap-1">
                <CalendarDays className="size-4 text-text-muted" />
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
                className="h-8 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text-secondary transition active:bg-surface-subtle shadow-2xs"
              >
                Go
              </button>
            </form>
          </div>
        </div>

        {/* Metric strip — one grouped row, divided like a mobile widget,
            instead of six separately-bordered tiles. */}
        <div className="grid grid-cols-3 divide-x divide-y divide-gray-100 border-t border-gray-100 sm:grid-cols-6 sm:divide-y-0">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-0.5 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                {stat.label}
              </p>
              <p className="text-lg font-bold tracking-tight text-gray-900">
                {stat.value}
              </p>
              <div className={`h-0.5 w-6 rounded-full ${stat.accent ? 'bg-amber-500' : 'bg-[#033B36]'}`} />
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================= */}
      {/* One "Needs attention" card instead of two separately-bordered      */}
      {/* alert boxes — only rendered when there's something to flag.        */}
      {/* ================================================================= */}
      {showRecentBanner || showPendingBanner ? (
        <section className="overflow-hidden rounded-2xl border border-amber-200/70 bg-amber-50/40 shadow-2xs">
          {showRecentBanner ? (
            <div className="p-4">
              <div className="flex items-start gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Clock className="size-4" />
                </span>
                <p className="text-xs font-bold leading-snug text-text-primary">
                  Trainer reports submitted on recent dates awaiting review
                </p>
              </div>

              {/* Native list — one row per date, no wrapping pills. */}
              <div className="mt-3 overflow-hidden rounded-xl border border-primary/15 bg-white">
                {workspace.recentSubmissions.map((sub, idx) => (
                  <Link
                    key={sub.reportDate}
                    href={`/operations/daily-reports?date=${sub.reportDate}`}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs transition active:bg-primary/5 ${
                      idx > 0 ? 'border-t border-primary/10' : ''
                    }`}
                  >
                    <span className="min-w-0 truncate font-semibold text-primary">
                      {sub.reportDate === yesterday ? 'Yesterday' : formatDailyReportDate(sub.reportDate)}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="font-bold text-text-primary">
                        {sub.submittedCount} report{sub.submittedCount === 1 ? '' : 's'}
                      </span>
                      {sub.concerns > 0 ? (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                          {sub.concerns} concern{sub.concerns === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                ))}
              </div>

              {workspace.recentSubmissions.some((s) => s.reportDate === yesterday) ? (
                <Link
                  href={`/operations/daily-reports?date=${yesterday}`}
                  className="mt-3 flex h-9 w-full items-center justify-center rounded-lg bg-primary text-xs font-bold text-white shadow-2xs transition active:scale-[0.98] sm:w-auto sm:px-4"
                >
                  View Yesterday&apos;s Reports
                </Link>
              ) : null}
            </div>
          ) : null}

          {showPendingBanner ? (
            <div className={`flex items-start gap-2 p-4 ${showRecentBanner ? 'border-t border-amber-200/60' : ''}`}>
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
          ) : null}
        </section>
      ) : null}

      <HodDailyReportList workspace={workspace} />
    </div>
  );
}

