'use client';

import {
  AlertCircle,
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ExternalLink,
  LoaderCircle,
  Send,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ABSENT_CIRCUMSTANCES } from '@/features/class-attendance/domain';
import { submitTrainerDailyReportAction, submitDailyReportDirectAction, dismissOverdueReportAction } from './actions';
import {
  formatDailyReportDate,
  formatDailyReportTime,
  formatStudentTwoNames,
  nairobiToday,
} from './domain';
import type {
  PastUnrecordedSession,
  PastUnsubmittedReportDate,
  TrainerDailyReportLesson,
  TrainerDailyReportWorkspace,
} from './types';

const ATTENDANCE_BADGE_CONFIG = {
  completed: {
    icon: CheckCircle2,
    label: 'Completed',
    className:
      'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-emerald-100/70 text-emerald-800',
    iconClassName: 'text-emerald-600',
  },
  cancelled: {
    icon: CheckCircle2,
    label: 'Did Not Take Place',
    className:
      'border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/70 text-slate-700',
    iconClassName: 'text-slate-500',
  },
  open: {
    icon: AlertTriangle,
    label: 'In Progress',
    className:
      'border-amber-200/80 bg-gradient-to-br from-amber-50 to-amber-100/70 text-amber-800',
    iconClassName: 'text-amber-600',
  },
  default: {
    icon: AlertTriangle,
    label: 'Not Recorded',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
    iconClassName: 'text-slate-400',
  },
} as const;

function AttendanceBadge({
  status,
}: {
  status: TrainerDailyReportLesson['attendanceStatus'];
}) {
  const config =
    ATTENDANCE_BADGE_CONFIG[status as keyof typeof ATTENDANCE_BADGE_CONFIG] ??
    ATTENDANCE_BADGE_CONFIG.default;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold shadow-2xs ${config.className}`}
    >
      <Icon className={`size-3 ${config.iconClassName}`} />
      {config.label}
    </span>
  );
}

const EXCEPTION_REASONS = [
  'Public Holiday',
  'College Event / Sports Day',
  'Rescheduled Session',
  'Trainer Approved Leave / Official Duty',
  'Timetable Adjustment',
  'Other',
];

interface ExceptionTargetSession {
  scheduledSessionId: string;
  sessionDate: string;
  unitName: string;
  cohortName: string;
  teachingAllocationId?: string;
  unitId?: string;
  cohortId?: string;
}

function SessionExceptionDialog({
  session,
  open,
  onOpenChange,
  onSuccess,
}: {
  session: ExceptionTargetSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState(EXCEPTION_REASONS[0]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/staff/attendance/sessions/exception', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledSessionId: session.scheduledSessionId,
          sessionDate: session.sessionDate,
          teachingAllocationId: session.teachingAllocationId,
          unitId: session.unitId,
          cohortId: session.cohortId,
          reason,
          notes,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message || 'Failed to save session exception.');
        return;
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden rounded-2xl border-border/80 p-0 shadow-xl sm:max-w-md">
        <DialogHeader className="border-b border-border/70 bg-surface-subtle/60 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200/70">
              <AlertTriangle className="size-4" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-bold text-text-primary">Session exception</DialogTitle>
              <DialogDescription className="mt-1 text-[11px] leading-5 text-text-muted">
                {session.unitName} · {session.cohortName} · {session.sessionDate}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-danger-border bg-danger-surface px-3 py-2.5 text-[11px] font-medium text-danger">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-xs font-medium text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            >
              {EXCEPTION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Remarks
              </label>
              <span className="text-[9px] text-text-subtle">Optional · {notes.length}/500</span>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Add context or a rescheduled date if needed."
              className="mt-1.5 w-full resize-none rounded-xl border border-border bg-surface-subtle/40 px-3 py-2.5 text-xs leading-5 text-text-primary outline-none transition placeholder:text-text-subtle focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
            />
          </div>

          <DialogFooter className="border-t border-border/70 pt-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpenChange(false)}
              className="rounded-xl border border-border bg-white px-3.5 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-hover disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              {busy ? 'Saving…' : 'Save exception'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PastUnrecordedBanner({
  sessions,
  unsubmittedReports = [],
  onRecordPast,
  onLogException,
  onSubmitReportDirect,
  onDismissDate,
}: {
  sessions: PastUnrecordedSession[];
  unsubmittedReports?: PastUnsubmittedReportDate[];
  reportDate: string;
  onRecordPast: (session: PastUnrecordedSession) => void;
  onLogException: (session: PastUnrecordedSession) => void;
  onSubmitReportDirect?: (reportDate: string) => Promise<void>;
  onDismissDate?: (reportDate: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [submittingDate, setSubmittingDate] = useState<string | null>(null);
  const [dismissingDate, setDismissingDate] = useState<string | null>(null);

  if (sessions.length === 0 && unsubmittedReports.length === 0) return null;

  const totalOverdue = sessions.length + unsubmittedReports.length;

  async function handleDirectSubmit(dateStr: string) {
    if (!onSubmitReportDirect) return;
    setSubmittingDate(dateStr);
    try {
      await onSubmitReportDirect(dateStr);
    } finally {
      setSubmittingDate(null);
    }
  }

  async function handleDismiss(dateStr: string) {
    if (!onDismissDate) return;
    if (!confirm(`Hide the ${dateStr} reminder? This just removes it from your list — it does not submit a report.`)) {
      return;
    }
    setDismissingDate(dateStr);
    try {
      await onDismissDate(dateStr);
    } finally {
      setDismissingDate(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-200/80 bg-white shadow-xs">
      <div className="flex flex-col gap-3 border-b border-amber-100 bg-amber-50/55 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-100/80 text-amber-700 ring-1 ring-amber-200/70">
            <AlertCircle className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-bold text-text-primary">Pending items</h3>
              <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[9px] font-bold text-amber-800">
                {totalOverdue}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-text-muted">Past attendance or reports requiring attention.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="self-start rounded-lg px-2 py-1 text-[10px] font-semibold text-text-secondary transition hover:bg-white hover:text-text-primary sm:self-center"
        >
          {isOpen ? 'Collapse' : 'View pending'}
        </button>
      </div>

      {isOpen ? (
        <div className="divide-y divide-border/70">
          {unsubmittedReports.map((report) => (
            <div
              key={report.reportDate}
              className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-text-primary">Daily report</span>
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-700 ring-1 ring-rose-200/70">
                    {report.daysOverdue}d overdue
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-text-muted">
                  {report.dayOfWeek}, {report.reportDate} · {report.lessonCount} class(es) recorded
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {onSubmitReportDirect ? (
                  <button
                    type="button"
                    disabled={submittingDate === report.reportDate}
                    onClick={() => handleDirectSubmit(report.reportDate)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-white shadow-xs transition hover:bg-primary-hover disabled:opacity-50"
                  >
                    {submittingDate === report.reportDate ? <LoaderCircle className="size-3 animate-spin" /> : <ClipboardCheck className="size-3" />}
                    {submittingDate === report.reportDate ? 'Submitting…' : 'Submit'}
                  </button>
                ) : (
                  <Link
                    href={`/staff/daily-report?date=${report.reportDate}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-white shadow-xs transition hover:bg-primary-hover"
                  >
                    <ClipboardCheck className="size-3" />
                    Submit
                  </Link>
                )}
                <Link
                  href={`/staff/daily-report?date=${report.reportDate}`}
                  className="rounded-lg px-2 py-1.5 text-[10px] font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
                >
                  Review
                </Link>
                {onDismissDate ? (
                  <button
                    type="button"
                    disabled={dismissingDate === report.reportDate}
                    onClick={() => handleDismiss(report.reportDate)}
                    className="rounded-lg px-2 py-1.5 text-[10px] font-medium text-text-muted transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                  >
                    {dismissingDate === report.reportDate ? 'Hiding…' : 'Hide'}
                  </button>
                ) : null}
              </div>
            </div>
          ))}

          {sessions.map((session) => (
            <div
              key={`${session.scheduledSessionId}-${session.sessionDate}`}
              className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-xs font-semibold text-text-primary">{session.unitName}</span>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-800 ring-1 ring-amber-200/70">
                    {session.daysOverdue}d overdue
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-text-muted">
                  {session.cohortName} · {session.dayOfWeek}, {session.sessionDate} · {formatDailyReportTime(session.startsAt)}–{formatDailyReportTime(session.endsAt)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onRecordPast(session)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-white shadow-xs transition hover:bg-primary-hover"
                >
                  <CalendarCheck2 className="size-3" />
                  Record
                </button>
                <button
                  type="button"
                  onClick={() => onLogException(session)}
                  className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-[10px] font-semibold text-text-secondary transition hover:bg-surface-subtle"
                >
                  Exception
                </button>
                {onDismissDate ? (
                  <button
                    type="button"
                    disabled={dismissingDate === session.sessionDate}
                    onClick={() => handleDismiss(session.sessionDate)}
                    className="rounded-lg px-2 py-1.5 text-[10px] font-medium text-text-muted transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                  >
                    {dismissingDate === session.sessionDate ? 'Hiding…' : 'Hide'}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ScheduledLessonsSection({
  workspace,
  openingId,
  onRecordAttendance,
  onLogException,
}: {
  workspace: TrainerDailyReportWorkspace;
  openingId: string | null;
  onRecordAttendance: (lesson: TrainerDailyReportLesson) => void;
  onLogException?: (lesson: TrainerDailyReportLesson) => void;
}) {
  const lessons = workspace?.lessons ?? [];

  if (lessons.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border-strong bg-gradient-to-b from-white to-surface-subtle p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-soft ring-4 ring-primary-soft/40">
          <UsersRound className="size-5 text-primary" />
        </div>
        <p className="mt-3 text-sm font-bold text-text-primary">
          No Scheduled Lessons
        </p>
        <p className="mx-auto mt-1 max-w-xs text-[11px] text-text-muted">
          Submit your activity log or concerns below to file a non-teaching day record.
        </p>
      </section>
    );
  }

  const statusAccent: Record<string, string> = {
    completed: 'from-emerald-400 to-emerald-500',
    cancelled: 'from-slate-300 to-slate-400',
    open: 'from-amber-400 to-amber-500',
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-white to-surface-subtle/30 shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-white/80 px-4 py-3 backdrop-blur-sm sm:px-5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary-soft text-primary">
            <CalendarCheck2 className="size-3.5" />
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary">
            Scheduled Lessons <span className="text-text-muted">({lessons.length})</span>
          </h2>
        </div>
        <span className="hidden text-[10px] font-medium text-text-muted sm:inline">
          Tap a lesson to take or review attendance
        </span>
      </div>

      <div className="grid gap-3 p-3 sm:p-4">
        {lessons.map((lesson, index) => {
          const isOpening = openingId === lesson.scheduledSessionId;
          const accent = statusAccent[lesson.attendanceStatus] ?? 'from-slate-200 to-slate-300';

          return (
            <article
              key={lesson.scheduledSessionId || `lesson-${index}`}
              className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border/70 bg-white p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <span className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${accent}`} />

              <div className="min-w-0 pl-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold text-text-primary">
                    {lesson.unitName || 'Lesson'}
                  </p>
                  {lesson.unitCode ? (
                    <span className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                      {lesson.unitCode}
                    </span>
                  ) : null}
                  <AttendanceBadge status={lesson.attendanceStatus} />
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-text-muted">
                  <span className="font-medium text-text-secondary">{lesson.cohortName || 'Class'}</span>
                  <span className="text-text-subtle">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3 text-text-subtle" />
                    {formatDailyReportTime(lesson.startsAt)}–{formatDailyReportTime(lesson.endsAt)}
                  </span>
                  {lesson.roomName ? (
                    <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] text-text-secondary">
                      {lesson.roomName}
                    </span>
                  ) : null}
                </div>

                {lesson.attendanceStatus === 'completed' ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="rounded-md bg-surface-muted px-2 py-0.5 font-medium text-text-secondary">
                      Roster <strong className="text-text-primary">{lesson.rosterCount || 0}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {lesson.presentCount || 0} Present
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-rose-200/60 bg-rose-50 px-2 py-0.5 font-semibold text-rose-800">
                      <span className="size-1.5 rounded-full bg-rose-500" />
                      {lesson.absentCount || 0} Absent
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2 pl-2 sm:pl-0">
                {lesson.attendanceStatus === 'completed' ? (
                  <button
                    type="button"
                    onClick={() => onRecordAttendance(lesson)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-text-secondary shadow-2xs transition hover:border-primary/30 hover:bg-primary-subtle hover:text-primary"
                  >
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                    View Register
                  </button>
                ) : lesson.attendanceStatus === 'cancelled' ? (
                  <span className="text-[11px] font-medium italic text-text-muted">
                    Did Not Take Place
                  </span>
                ) : lesson.attendanceStatus === 'open' ? (
                  <button
                    type="button"
                    onClick={() => onRecordAttendance(lesson)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-gradient-to-b from-amber-50 to-amber-100/70 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-2xs transition hover:from-amber-100 hover:to-amber-100"
                  >
                    <AlertTriangle className="size-3.5 text-amber-600" />
                    Continue Register
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isOpening}
                      onClick={() => onRecordAttendance(lesson)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-primary to-primary-hover px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-50"
                    >
                      {isOpening ? (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : (
                        <CalendarCheck2 className="size-3.5" />
                      )}
                      Take Attendance
                    </button>
                    {onLogException ? (
                      <button
                        type="button"
                        onClick={() => onLogException(lesson)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-text-secondary shadow-2xs transition hover:bg-surface-subtle"
                      >
                        Did Not Take Place
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ClassAttendanceSummaryTable({
  lessons,
}: {
  lessons: TrainerDailyReportLesson[];
}) {
  if (lessons.length === 0) return null;

  const totals = lessons.reduce(
    (acc, lesson) => ({
      roster: acc.roster + (lesson.rosterCount || 0),
      present: acc.present + (lesson.presentCount || 0),
      absent: acc.absent + (lesson.absentCount || 0),
      completed: acc.completed + (lesson.attendanceStatus === 'completed' ? 1 : 0),
    }),
    { roster: 0, present: 0, absent: 0, completed: 0 }
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-primary">
            Attendance Summary
          </h3>
          <p className="mt-0.5 text-[10px] text-text-muted">
            {totals.completed}/{lessons.length} registers completed
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-text-secondary">{totals.roster} enrolled</span>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-800">{totals.present} present</span>
          {totals.absent > 0 ? (
            <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-800">{totals.absent} absent</span>
          ) : null}
        </div>
      </div>
      <div className="divide-y divide-border/70">
        {lessons.map((l) => (
          <div key={l.scheduledSessionId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 transition-colors hover:bg-slate-50/60 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-xs font-semibold text-text-primary">{l.unitName}</span>
                {l.unitCode ? <span className="hidden shrink-0 font-mono text-[9.5px] text-text-muted sm:inline">{l.unitCode}</span> : null}
              </div>
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-text-muted">
                <span className="truncate">{l.cohortName}</span><span>·</span>
                <span className="font-mono">{formatDailyReportTime(l.startsAt)}–{formatDailyReportTime(l.endsAt)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold">
              <span className="rounded-md bg-slate-100 px-2 py-1 text-text-secondary">{l.rosterCount || 0}</span>
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-800">{l.presentCount || 0}</span>
              {(l.absentCount || 0) > 0 ? <span className="rounded-md bg-rose-50 px-2 py-1 text-rose-800">{l.absentCount || 0}</span> : null}
            </div>
            <div className="justify-self-end"><AttendanceBadge status={l.attendanceStatus} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AbsenteesTableSection({ lessons }: { lessons: TrainerDailyReportLesson[] }) {
  const allAbsentees = lessons.flatMap((l) => l.absentees.map((a) => ({ ...a, unitCode: l.unitCode, unitName: l.unitName, cohortName: l.cohortName })));
  const anyCompleted = lessons.some((l) => l.attendanceStatus === 'completed');
  if (allAbsentees.length === 0 && !anyCompleted) return null;

  if (allAbsentees.length === 0 && anyCompleted) {
    return (
      <section className="flex items-center gap-2.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-3 shadow-sm">
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
        <div><p className="text-xs font-semibold text-emerald-950">Full attendance</p><p className="text-[10px] text-emerald-800">No students were marked absent.</p></div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-rose-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-rose-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600"><AlertTriangle className="size-3.5" /></span>
          <div className="min-w-0"><h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-rose-950">Absentees</h3><p className="text-[10px] text-rose-800">{allAbsentees.length} student{allAbsentees.length === 1 ? '' : 's'} across today&apos;s classes</p></div>
        </div>
        <span className="shrink-0 rounded-full bg-rose-50 px-2 py-1 font-mono text-[10px] font-bold text-rose-800">{allAbsentees.length}</span>
      </div>
      <div className="divide-y divide-border/60 sm:hidden">
        {allAbsentees.map((s) => {
          const isKnownCircumstance = (ABSENT_CIRCUMSTANCES as readonly string[]).includes(s.note || '');
          return <article key={`${s.studentId}-${s.unitCode}`} className="px-4 py-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold text-text-primary" title={s.fullName}>{formatStudentTwoNames(s.fullName)}</p><p className="mt-0.5 font-mono text-[9.5px] text-text-muted">{s.admissionNumber}</p></div>{s.note ? (isKnownCircumstance ? <span className="max-w-[145px] shrink-0 truncate rounded-full border border-rose-200/70 bg-rose-50 px-2 py-1 text-[9.5px] font-semibold text-rose-900">{s.note}</span> : <span className="max-w-[145px] shrink-0 truncate text-[10px] italic text-text-muted">{s.note}</span>) : <span className="shrink-0 rounded-full bg-rose-50 px-2 py-1 text-[9.5px] font-medium text-rose-700">Absent</span>}</div><div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[10px] text-text-muted"><span className="truncate">{s.cohortName}</span><span>·</span><span className="truncate">{s.unitName}</span></div></article>;
        })}
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-xs"><thead className="border-b border-rose-100 bg-rose-50/40 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-rose-900/80"><tr><th className="px-4 py-2.5">Student</th><th className="px-4 py-2.5">Class</th><th className="px-4 py-2.5">Unit</th><th className="px-4 py-2.5">Remarks</th></tr></thead><tbody className="divide-y divide-border/60">
          {allAbsentees.map((s) => { const isKnownCircumstance = (ABSENT_CIRCUMSTANCES as readonly string[]).includes(s.note || ''); return <tr key={`${s.studentId}-${s.unitCode}`} className="transition-colors hover:bg-slate-50/50"><td className="px-4 py-2.5"><p className="text-xs font-semibold text-text-primary" title={s.fullName}>{formatStudentTwoNames(s.fullName)}</p><p className="mt-0.5 font-mono text-[9.5px] text-text-muted">{s.admissionNumber}</p></td><td className="px-4 py-2.5 text-[11px] text-text-secondary">{s.cohortName}</td><td className="px-4 py-2.5"><p className="text-[11px] font-medium text-text-primary">{s.unitName}</p>{s.unitCode ? <p className="font-mono text-[9.5px] text-text-muted">{s.unitCode}</p> : null}</td><td className="px-4 py-2.5">{s.note ? (isKnownCircumstance ? <span className="rounded-full border border-rose-200/70 bg-rose-50 px-2 py-1 text-[9.5px] font-semibold text-rose-900">{s.note}</span> : <span className="text-[10px] italic text-text-muted">{s.note}</span>) : <span className="text-[10px] text-text-muted/60">—</span>}</td></tr>; })}
        </tbody></table>
      </div>
    </section>
  );
}

export function TrainerDailyReportForm({
  workspace,
}: {
  workspace: TrainerDailyReportWorkspace;
}) {
  const router = useRouter();

  const [otherActivity, setOtherActivity] = useState(workspace?.otherActivity || '');
  const [concern, setConcern] = useState(workspace?.concern || '');
  const [openingSessionId, setOpeningSessionId] = useState<string | null>(null);

  const [exceptionSession, setExceptionSession] = useState<ExceptionTargetSession | null>(null);
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);

  const [state, action, pending] = useActionState(
    submitTrainerDailyReportAction,
    { status: 'idle', message: '' },
  );

  useEffect(() => {
    if (state.status === 'success') {
      const today = nairobiToday();
      if (workspace.reportDate !== today) {
        router.push('/staff/daily-report');
      }
      router.refresh();
    }
  }, [router, state.status, workspace.reportDate]);

  async function handleDirectSubmitReport(dateToSubmit: string) {
    try {
      const res = await submitDailyReportDirectAction(dateToSubmit);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit daily report.';
      alert(msg);
    }
  }

  async function handleDismissBacklogDate(dateToDismiss: string) {
    try {
      const res = await dismissOverdueReportAction(dateToDismiss);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to hide this item.';
      alert(msg);
    }
  }

  async function handleRecordAttendance(lesson: TrainerDailyReportLesson) {
    const returnUrl = encodeURIComponent(`/staff/daily-report?date=${workspace.reportDate}`);

    if (lesson.attendanceSessionId) {
      router.push(`/staff/attendance/${lesson.attendanceSessionId}?returnTo=${returnUrl}`);
      return;
    }

    setOpeningSessionId(lesson.scheduledSessionId);
    try {
      const res = await fetch('/api/staff/attendance/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledSessionId: lesson.scheduledSessionId,
          sessionDate: workspace.reportDate,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.classSessionId) {
        router.push(`/staff/attendance/${data.classSessionId}?returnTo=${returnUrl}`);
      } else {
        alert(data?.message || 'Could not open attendance session.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to open class attendance.';
      alert(msg);
    } finally {
      setOpeningSessionId(null);
    }
  }

  async function handleRecordPastAttendance(pastSession: PastUnrecordedSession) {
    const returnUrl = encodeURIComponent(`/staff/daily-report?date=${workspace.reportDate}`);

    try {
      const res = await fetch('/api/staff/attendance/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledSessionId: pastSession.scheduledSessionId,
          sessionDate: pastSession.sessionDate,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.classSessionId) {
        router.push(`/staff/attendance/${data.classSessionId}?returnTo=${returnUrl}`);
      } else {
        alert(data?.message || 'Could not open past attendance session.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to open past class attendance.';
      alert(msg);
    }
  }

  function handleOpenExceptionDialog(pastSession: PastUnrecordedSession) {
    setExceptionSession(pastSession);
    setExceptionDialogOpen(true);
  }

  function handleOpenLessonException(lesson: TrainerDailyReportLesson) {
    setExceptionSession({
      scheduledSessionId: lesson.scheduledSessionId,
      sessionDate: workspace.reportDate,
      unitName: lesson.unitName,
      cohortName: lesson.cohortName,
      teachingAllocationId: lesson.teachingAllocationId,
      unitId: lesson.unitId,
      cohortId: lesson.cohortId,
    });
    setExceptionDialogOpen(true);
  }

  const isNonTeachingDay = (workspace?.lessons ?? []).length === 0;
  const hasText = otherActivity.trim().length > 0 || concern.trim().length > 0;
  const isSubmittable = isNonTeachingDay
    ? hasText
    : Boolean(workspace?.readyToSubmit);

  if (workspace.status === 'submitted') {
    const lessons = workspace.lessons ?? [];
    const totalPresent = lessons.reduce((sum, l) => sum + (l.presentCount || 0), 0);
    const totalAbsent = lessons.reduce((sum, l) => sum + (l.absentCount || 0), 0);

    return (
      <div className="space-y-4">
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-900">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold">Daily Report Submitted</p>
                <p className="text-[11px] text-emerald-800">
                  {formatDailyReportDate(workspace.reportDate)}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-200/60 px-2.5 py-0.5 text-[10px] font-bold text-emerald-900">
              Official Record
            </span>
          </div>

          {lessons.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-emerald-900">
              <span className="rounded-md bg-white/70 px-2 py-0.5">
                {lessons.length} lesson{lessons.length === 1 ? '' : 's'}
              </span>
              <span className="rounded-md bg-white/70 px-2 py-0.5">Present: {totalPresent}</span>
              <span className="rounded-md bg-white/70 px-2 py-0.5">Absent: {totalAbsent}</span>
            </div>
          ) : null}
        </section>

        <ScheduledLessonsSection
          workspace={workspace}
          openingId={null}
          onRecordAttendance={handleRecordAttendance}
        />

        {(workspace.otherActivity || workspace.concern) ? (
          <section className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border/80 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Activity Log
              </p>
              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-text-primary">
                {workspace.otherActivity || '—'}
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Concerns & Issues
              </p>
              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-text-primary">
                {workspace.concern || '—'}
              </p>
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <PastUnrecordedBanner
        sessions={workspace.pastUnrecordedSessions ?? []}
        unsubmittedReports={workspace.unsubmittedPastReportDates ?? []}
        reportDate={workspace.reportDate}
        onRecordPast={handleRecordPastAttendance}
        onLogException={handleOpenExceptionDialog}
        onSubmitReportDirect={handleDirectSubmitReport}
        onDismissDate={handleDismissBacklogDate}
      />

      <SessionExceptionDialog
        session={exceptionSession}
        open={exceptionDialogOpen}
        onOpenChange={setExceptionDialogOpen}
        onSuccess={() => router.refresh()}
      />

      <form
        action={action}
        onSubmit={(e) => {
          if (isNonTeachingDay && !hasText) {
            e.preventDefault();
          }
        }}
        className="space-y-4"
      >
        <input type="hidden" name="reportDate" value={workspace.reportDate} />

        {state.status === 'error' && state.message ? (
          <section className="flex items-start gap-2.5 rounded-xl border border-rose-300 bg-rose-50 p-3.5 shadow-xs">
            <AlertCircle className="size-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-rose-950">Submission Failed</p>
              <p className="mt-0.5 text-[11px] text-rose-800">{state.message}</p>
            </div>
          </section>
        ) : null}

        <ScheduledLessonsSection
          workspace={workspace}
          openingId={openingSessionId}
          onRecordAttendance={handleRecordAttendance}
          onLogException={handleOpenLessonException}
        />

        <ClassAttendanceSummaryTable lessons={workspace.lessons} />
        <AbsenteesTableSection lessons={workspace.lessons} />

        {/* Pending Attendance & Overdue Action Banner */}
        {!workspace.readyToSubmit ? (
          <section className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 shadow-xs">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-amber-950">
                Attendance Pending Before Submission
              </p>
              <p className="mt-0.5 text-[11px] text-amber-800">
                {workspace.blockingReason ||
                  'Complete register for all scheduled classes above to enable report submission.'}
              </p>
            </div>
          </section>
        ) : null}

        {/* Non-Teaching Day Callout */}
        {isNonTeachingDay ? (
          <section className="flex items-center gap-2.5 rounded-2xl border border-blue-200/80 bg-blue-50/60 px-4 py-3 shadow-sm">
            <span className="rounded-lg bg-white/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-900">Non-teaching day</span>
            <p className="text-[10px] text-blue-800">Add your activity or note to complete the report.</p>
          </section>
        ) : null}

        {/* Form Inputs */}
        <section className="grid gap-3 md:grid-cols-2">
          <label className="block rounded-2xl border border-border/80 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-primary">
                Activity Log
              </span>
              <span className="text-[10px] text-text-muted">
                {otherActivity.length}/800 {isNonTeachingDay ? '(Required)' : '(Optional)'}
              </span>
            </div>
            <textarea
              name="otherActivity"
              rows={3}
              maxLength={800}
              value={otherActivity}
              onChange={(e) => setOtherActivity(e.target.value)}
              className="mt-2 w-full resize-y rounded-lg border border-border bg-slate-50/50 p-2.5 text-xs text-text-primary outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/20"
              placeholder="Meetings, exam prep, lab setup, project supervision..."
            />
          </label>

          <label className="block rounded-2xl border border-border/80 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-primary">
                Concerns & Academic Notes
              </span>
              <span className="text-[10px] text-text-muted">
                {concern.length}/1200 (Optional)
              </span>
            </div>
            <textarea
              name="concern"
              rows={3}
              maxLength={1200}
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              className="mt-2 w-full resize-y rounded-lg border border-border bg-slate-50/50 p-2.5 text-xs text-text-primary outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/20"
              placeholder="Student attendance, timetable conflicts, room or equipment issues..."
            />
          </label>
        </section>

        {state.message ? (
          <div
            className={`rounded-xl border px-4 py-2.5 text-xs font-semibold ${
              state.status === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            {state.message}
          </div>
        ) : null}

        {/* Action Bar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px] text-text-muted">
            {isNonTeachingDay && !hasText ? (
              <span className="font-medium text-amber-800">
                * Enter an activity log or note above to submit.
              </span>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={pending || !isSubmittable}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <ClipboardCheck className="size-3.5" />
            )}
            {pending ? 'Submitting Report...' : 'Submit Daily Report'}
          </button>
        </div>
      </form>
    </>
  );
}
