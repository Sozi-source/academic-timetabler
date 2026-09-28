import Link from 'next/link';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  RotateCcw,
} from 'lucide-react';

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
  const lessons = workspace.lessons ?? [];
  const totalPresent = lessons.reduce((sum, lesson) => sum + (lesson.presentCount || 0), 0);
  const totalAbsent = lessons.reduce((sum, lesson) => sum + (lesson.absentCount || 0), 0);

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4">
      {/* Single compact context card. Keep the scheduled lessons immediately below it. */}
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-primary/10">
              <ClipboardCheck className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-text-muted">
                  Faculty Operations
                </p>
                <span className="text-text-subtle">·</span>
                <h1 className="text-sm font-bold text-text-primary">Daily Report</h1>
                {isToday ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                    Today
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-600">
                    Historical
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-text-muted">
                <span className="font-semibold text-text-secondary">
                  {formatDailyReportDate(reportDate)}
                </span>
                <span>·</span>
                <span>
                  {workspace.trainerName}
                  {workspace.trainerNumber ? ` (${workspace.trainerNumber})` : ''}
                </span>
                <span>·</span>
                <span>{workspace.homeDepartmentName}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:pl-4">
            <div className="inline-flex items-center rounded-lg border border-border bg-slate-50/60 p-0.5">
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

            <form method="get" className="flex items-center gap-1.5">
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-text-muted" />
                <input
                  type="date"
                  name="date"
                  defaultValue={reportDate}
                  max={today}
                  aria-label="Select report date"
                  className="h-8 w-[132px] rounded-lg border border-border bg-slate-50/50 pl-7 pr-2 text-xs text-text-primary outline-none focus:border-primary focus:bg-white"
                />
              </div>
              <button
                type="submit"
                className="h-8 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text-secondary shadow-2xs transition hover:bg-surface-subtle"
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

        {workspace.status === 'submitted' ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-emerald-100 bg-emerald-50/70 px-4 py-2 sm:px-5">
            <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-emerald-900">
              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
              <span>Submitted</span>
              <span className="font-normal text-emerald-800">· Official record</span>
            </div>
            {lessons.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-emerald-900">
                <span className="rounded-md bg-white/75 px-2 py-0.5">
                  {lessons.length} lesson{lessons.length === 1 ? '' : 's'}
                </span>
                <span className="rounded-md bg-white/75 px-2 py-0.5">Present {totalPresent}</span>
                <span className="rounded-md bg-white/75 px-2 py-0.5">Absent {totalAbsent}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <TrainerDailyReportForm workspace={workspace} />
    </div>
  );
}
