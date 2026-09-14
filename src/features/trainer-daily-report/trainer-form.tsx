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
import { submitTrainerDailyReportAction } from './actions';
import { formatDailyReportDate, formatDailyReportTime } from './domain';
import type {
  PastUnrecordedSession,
  TrainerDailyReportLesson,
  TrainerDailyReportWorkspace,
} from './types';

function AttendanceBadge({
  status,
}: {
  status: TrainerDailyReportLesson['attendanceStatus'];
}) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
        <CheckCircle2 className="size-3 text-emerald-600" />
        Completed
      </span>
    );
  }

  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
        <CheckCircle2 className="size-3 text-slate-500" />
        Did Not Take Place
      </span>
    );
  }

  if (status === 'open') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
        <AlertTriangle className="size-3 text-amber-600" />
        In Progress
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
      <AlertTriangle className="size-3 text-slate-400" />
      Not Recorded
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

function SessionExceptionDialog({
  session,
  open,
  onOpenChange,
  onSuccess,
}: {
  session: PastUnrecordedSession | null;
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Session Exception</DialogTitle>
          <DialogDescription>
            Record why {session.unitName} ({session.cohortName}) did not take place on {session.sessionDate}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-2">
          {error ? (
            <div className="rounded-lg border border-danger-border bg-danger-surface p-2 text-xs text-danger">
              {error}
            </div>
          ) : null}

          <div>
            <label className="block text-xs font-semibold text-text-primary">
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2 text-xs text-text-primary outline-none focus:border-primary"
            >
              {EXCEPTION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary">
              Remarks (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Additional context or rescheduled date..."
              className="mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2 text-xs text-text-primary outline-none focus:border-primary"
            />
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-subtle"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              Save Exception
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PastUnrecordedBanner({
  sessions,
  onRecordPast,
  onLogException,
}: {
  sessions: PastUnrecordedSession[];
  reportDate: string;
  onRecordPast: (session: PastUnrecordedSession) => void;
  onLogException: (session: PastUnrecordedSession) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  if (sessions.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-amber-300 bg-amber-50/90 shadow-xs">
      <div className="flex flex-col gap-2 border-b border-amber-200/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0 text-amber-700" />
          <h3 className="text-xs font-bold text-amber-950">
            Overdue Attendance ({sessions.length})
          </h3>
          <span className="hidden text-xs text-amber-800 sm:inline">
            — Record attendance or log an exception to submit today&apos;s report.
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="self-start text-[11px] font-semibold text-amber-900 underline hover:text-amber-950 sm:self-center"
        >
          {isOpen ? 'Hide Classes' : 'Show Classes'}
        </button>
      </div>

      {isOpen ? (
        <div className="divide-y divide-amber-200/60 bg-white/80">
          {sessions.map((session) => (
            <div
              key={`${session.scheduledSessionId}-${session.sessionDate}`}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text-primary">
                    {session.unitName}
                  </span>
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                    {session.daysOverdue}d overdue
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-text-muted">
                  {session.cohortName} · {session.dayOfWeek}, {session.sessionDate} · {formatDailyReportTime(session.startsAt)}–{formatDailyReportTime(session.endsAt)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onRecordPast(session)}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-primary-hover shadow-xs"
                >
                  <CalendarCheck2 className="size-3" />
                  Record
                </button>
                <button
                  type="button"
                  onClick={() => onLogException(session)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-text-secondary transition hover:bg-surface-subtle"
                >
                  Did Not Take Place
                </button>
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
}: {
  workspace: TrainerDailyReportWorkspace;
  openingId: string | null;
  onRecordAttendance: (lesson: TrainerDailyReportLesson) => void;
}) {
  const lessons = workspace?.lessons ?? [];

  if (lessons.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-white p-6 text-center shadow-xs">
        <UsersRound className="mx-auto size-6 text-text-muted" />
        <p className="mt-2 text-xs font-bold text-text-primary">
          No Scheduled Lessons
        </p>
        <p className="mt-0.5 text-[11px] text-text-muted">
          Submit your activity log or concerns below to file a non-teaching day record.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-border bg-slate-50/70 px-4 py-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary">
          Scheduled Lessons ({lessons.length})
        </h2>
        <span className="text-[10px] font-medium text-text-muted">
          Tap to take or review attendance
        </span>
      </div>

      <div className="divide-y divide-border">
        {lessons.map((lesson, index) => {
          const isOpening = openingId === lesson.scheduledSessionId;

          return (
            <article
              key={lesson.scheduledSessionId || `lesson-${index}`}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/40 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold text-text-primary">
                    {lesson.unitCode ? `${lesson.unitCode} · ` : ''}{lesson.unitName || 'Lesson'}
                  </p>
                  <AttendanceBadge status={lesson.attendanceStatus} />
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-text-muted">
                  <span className="font-medium text-text-secondary">{lesson.cohortName || 'Class'}</span>
                  <span>·</span>
                  <span>{formatDailyReportTime(lesson.startsAt)}–{formatDailyReportTime(lesson.endsAt)}</span>
                  {lesson.roomName ? (
                    <>
                      <span>·</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-700">
                        {lesson.roomName}
                      </span>
                    </>
                  ) : null}
                </div>

                {lesson.attendanceStatus === 'completed' ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
                    <span className="text-slate-600">
                      Roster: <strong>{lesson.rosterCount || 0}</strong>
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-emerald-700">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Present: {lesson.presentCount || 0}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-rose-700">
                      <span className="size-1.5 rounded-full bg-rose-500" />
                      Absent: {lesson.absentCount || 0}
                    </span>
                    {lesson.notReportedCount > 0 ? (
                      <span className="flex items-center gap-1 font-medium text-amber-700">
                        <span className="size-1.5 rounded-full bg-amber-500" />
                        Not Reported: {lesson.notReportedCount}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {lesson.attendanceStatus === 'completed' ? (
                  <button
                    type="button"
                    onClick={() => onRecordAttendance(lesson)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle shadow-2xs"
                  >
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                    View Register
                  </button>
                ) : lesson.attendanceStatus === 'open' ? (
                  <button
                    type="button"
                    onClick={() => onRecordAttendance(lesson)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 shadow-2xs"
                  >
                    <AlertTriangle className="size-3.5 text-amber-600" />
                    Continue Register
                  </button>
                ) : lesson.attendanceStatus === 'cancelled' ? (
                  <span className="text-[11px] font-medium text-text-muted italic">
                    Did Not Take Place
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={isOpening}
                    onClick={() => onRecordAttendance(lesson)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover disabled:opacity-50"
                  >
                    {isOpening ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : (
                      <CalendarCheck2 className="size-3.5" />
                    )}
                    Take Attendance
                  </button>
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

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
      <div className="border-b border-border bg-slate-50/70 px-4 py-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
          Class Attendance Overview
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-slate-50/40 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            <tr>
              <th className="px-4 py-2.5">Time</th>
              <th className="px-4 py-2.5">Unit</th>
              <th className="px-4 py-2.5">Cohort</th>
              <th className="px-3 py-2.5 text-center">Roster</th>
              <th className="px-3 py-2.5 text-center text-emerald-700">Present</th>
              <th className="px-3 py-2.5 text-center text-rose-700">Absent</th>
              <th className="px-3 py-2.5 text-center text-amber-700">Not Reported</th>
              <th className="px-4 py-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lessons.map((l) => (
              <tr key={l.scheduledSessionId} className="hover:bg-slate-50/40 transition-colors">
                <td className="whitespace-nowrap px-4 py-2 text-text-muted font-mono text-[11px]">
                  {formatDailyReportTime(l.startsAt)}–{formatDailyReportTime(l.endsAt)}
                </td>
                <td className="px-4 py-2 font-semibold text-text-primary">
                  {l.unitCode ? `${l.unitCode} · ` : ''}{l.unitName}
                </td>
                <td className="px-4 py-2 text-text-secondary">
                  {l.cohortName}
                </td>
                <td className="px-3 py-2 text-center font-medium text-text-primary font-mono">
                  {l.rosterCount || 0}
                </td>
                <td className="px-3 py-2 text-center font-bold text-emerald-700 font-mono">
                  {l.presentCount || 0}
                </td>
                <td className="px-3 py-2 text-center font-bold text-rose-700 font-mono">
                  {l.absentCount || 0}
                </td>
                <td className="px-3 py-2 text-center text-amber-700 font-medium font-mono">
                  {l.notReportedCount || 0}
                </td>
                <td className="px-4 py-2 text-center">
                  <AttendanceBadge status={l.attendanceStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AbsenteesTableSection({
  lessons,
}: {
  lessons: TrainerDailyReportLesson[];
}) {
  const allAbsentees = lessons.flatMap((l) =>
    l.absentees.map((a) => ({
      ...a,
      unitCode: l.unitCode,
      unitName: l.unitName,
      cohortName: l.cohortName,
    }))
  );

  const anyCompleted = lessons.some((l) => l.attendanceStatus === 'completed');

  if (allAbsentees.length === 0 && !anyCompleted) return null;

  if (allAbsentees.length === 0 && anyCompleted) {
    return (
      <section className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-emerald-950 shadow-xs">
        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
        <p className="text-xs font-medium">
          <strong>100% Attendance:</strong> All enrolled students attended their scheduled classes today.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-rose-200 bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-rose-100 bg-rose-50/80 px-4 py-2.5">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-rose-950">
          <AlertTriangle className="size-3.5 text-rose-600" />
          Absentee Register ({allAbsentees.length})
        </h3>
        <span className="text-[10px] text-rose-800">
          Students marked absent across today&apos;s sessions
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-rose-100 bg-rose-50/40 text-[10px] font-semibold uppercase tracking-wider text-rose-900/80">
            <tr>
              <th className="px-4 py-2">Student Name</th>
              <th className="px-4 py-2">Admission No.</th>
              <th className="px-4 py-2">Cohort</th>
              <th className="px-4 py-2">Unit</th>
              <th className="px-4 py-2">Circumstance / Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {allAbsentees.map((s) => {
              const isKnownCircumstance = (ABSENT_CIRCUMSTANCES as readonly string[]).includes(s.note || '');

              return (
                <tr key={`${s.studentId}-${s.unitCode}`} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2 font-semibold text-text-primary">
                    {s.fullName}
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px] text-text-secondary">
                    {s.admissionNumber}
                  </td>
                  <td className="px-4 py-2 text-text-secondary">
                    {s.cohortName}
                  </td>
                  <td className="px-4 py-2 text-text-muted">
                    {s.unitCode ? `${s.unitCode} · ` : ''}{s.unitName}
                  </td>
                  <td className="px-4 py-2">
                    {s.note ? (
                      isKnownCircumstance ? (
                        <span className="inline-block rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-900">
                          {s.note}
                        </span>
                      ) : (
                        <span className="italic text-text-muted">{s.note}</span>
                      )
                    ) : (
                      <span className="text-text-muted/60">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

  const [exceptionSession, setExceptionSession] = useState<PastUnrecordedSession | null>(null);
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);

  const [state, action, pending] = useActionState(
    submitTrainerDailyReportAction,
    { status: 'idle', message: '' },
  );

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
    }
  }, [router, state.status]);

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

  const isNonTeachingDay = (workspace?.lessons ?? []).length === 0;
  const hasText = otherActivity.trim().length > 0 || concern.trim().length > 0;
  const isSubmittable = isNonTeachingDay ? hasText : Boolean(workspace?.readyToSubmit);

  if (workspace.status === 'submitted') {
    return (
      <div className="space-y-4">
        <section className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 shadow-xs">
          <div className="flex items-center gap-2 text-emerald-900">
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-bold">Daily Report Submitted</p>
              <p className="text-[11px] text-emerald-800">
                Official department record locked for {formatDailyReportDate(workspace.reportDate)}.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-200/60 px-2.5 py-0.5 text-[10px] font-bold text-emerald-900">
            Official Record
          </span>
        </section>

        <ScheduledLessonsSection
          workspace={workspace}
          openingId={null}
          onRecordAttendance={handleRecordAttendance}
        />

        <ClassAttendanceSummaryTable lessons={workspace.lessons} />
        <AbsenteesTableSection lessons={workspace.lessons} />

        {(workspace.otherActivity || workspace.concern) ? (
          <section className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-white p-4 shadow-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Activity Log
              </p>
              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-text-primary">
                {workspace.otherActivity || '—'}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-white p-4 shadow-xs">
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
        reportDate={workspace.reportDate}
        onRecordPast={handleRecordPastAttendance}
        onLogException={handleOpenExceptionDialog}
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

        <ScheduledLessonsSection
          workspace={workspace}
          openingId={openingSessionId}
          onRecordAttendance={handleRecordAttendance}
        />

        <ClassAttendanceSummaryTable lessons={workspace.lessons} />
        <AbsenteesTableSection lessons={workspace.lessons} />

        {/* Pending Attendance Action Banner */}
        {!workspace.readyToSubmit && !isNonTeachingDay ? (
          <section className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 shadow-xs">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-amber-950">
                Attendance Pending Before Submission
              </p>
              <p className="mt-0.5 text-[11px] text-amber-800">
                {workspace.blockingReason || 'Complete register for all scheduled classes above to enable report submission.'}
              </p>
            </div>
          </section>
        ) : null}

        {/* Non-Teaching Day Callout */}
        {isNonTeachingDay ? (
          <section className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-blue-950 shadow-xs">
            <p className="text-xs font-bold">Non-Teaching Day</p>
            <p className="mt-0.5 text-[11px] text-blue-850">
              Please enter your daily activities (meetings, supervision, preparation) or concerns below to submit.
            </p>
          </section>
        ) : null}

        {/* Form Inputs */}
        <section className="grid gap-3 md:grid-cols-2">
          <label className="block rounded-xl border border-border bg-white p-4 shadow-xs">
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

          <label className="block rounded-xl border border-border bg-white p-4 shadow-xs">
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
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
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
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
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
