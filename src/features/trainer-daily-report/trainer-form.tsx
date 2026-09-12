'use client';

import {
  AlertCircle,
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  LoaderCircle,
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
      <span className="inline-flex items-center gap-1 rounded-full border border-success-border bg-success-surface px-2 py-1 text-[10px] font-semibold text-success">
        <CheckCircle2 className="size-3" />
        Completed
      </span>
    );
  }

  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700">
        <CheckCircle2 className="size-3" />
        Did Not Take Place
      </span>
    );
  }

  if (status === 'open') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-warning-border bg-warning-surface px-2 py-1 text-[10px] font-semibold text-warning">
        <AlertTriangle className="size-3" />
        In progress
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-subtle px-2 py-1 text-[10px] font-semibold text-text-muted">
      <AlertTriangle className="size-3" />
      Not completed
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
    } catch (err: any) {
      setError(err?.message || 'Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Session Did Not Take Place</DialogTitle>
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
              Explanation / Remarks (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Provide any additional context or rescheduled date..."
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
  reportDate,
  onRecordPast,
  onLogException,
}: {
  sessions: PastUnrecordedSession[];
  reportDate: string;
  onRecordPast: (session: PastUnrecordedSession) => void;
  onLogException: (session: PastUnrecordedSession) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const overdueCount = sessions.filter((s) => s.daysOverdue > 2).length;

  if (sessions.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-amber-300 bg-amber-50/80 shadow-xs">
      <div className="flex flex-col gap-2 border-b border-amber-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="mt-0.5 size-4.5 shrink-0 text-amber-700" />
          <div>
            <h3 className="text-xs font-bold text-amber-950">
              Unrecorded Past Classes ({sessions.length})
            </h3>
            <p className="mt-0.5 text-[11px] text-amber-800">
              {overdueCount > 0
                ? `${overdueCount} class(es) are older than 48 hours. Record attendance or log an exception to unlock today's submission.`
                : 'Please record past class attendance or log an exception if the class did not take place.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="self-start text-[11px] font-semibold text-amber-900 underline hover:text-amber-950 sm:self-center"
        >
          {isOpen ? 'Collapse' : 'View Classes'}
        </button>
      </div>

      {isOpen ? (
        <div className="divide-y divide-amber-200/70 bg-white/70">
          {sessions.map((session) => (
            <div
              key={`${session.scheduledSessionId}-${session.sessionDate}`}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-text-primary">
                    {session.unitName}
                  </span>
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                    {session.daysOverdue}d ago
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-text-muted">
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
                  Record Attendance
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
      <section className="rounded-xl border border-border bg-white p-6 text-center">
        <UsersRound className="mx-auto size-6 text-text-muted" />
        <p className="mt-2 text-sm font-semibold text-text-primary">
          No scheduled lessons for this date
        </p>
        <p className="mt-1 text-xs text-text-muted">
          You may still report other activities (meetings, supervision, prep) or concerns below.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
      <div className="border-b border-border bg-surface-subtle px-4 py-3 sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-text-primary">
            Scheduled Lessons
          </h2>
          <p className="mt-0.5 text-[11px] text-text-muted">
            Record class attendance directly for each session below.
          </p>
        </div>
        <span className="hidden rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-700 sm:inline-block">
          {lessons.length} Lesson{lessons.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="divide-y divide-border">
        {lessons.map((lesson, index) => {
          const isOpening = openingId === lesson.scheduledSessionId;

          return (
            <article
              key={lesson.scheduledSessionId || `lesson-${index}`}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold text-text-primary">
                    {lesson.unitCode ? `${lesson.unitCode} · ` : ''}{lesson.unitName || 'Lesson'}
                  </p>
                  <AttendanceBadge status={lesson.attendanceStatus} />
                </div>
                <p className="mt-1 text-[11px] text-text-muted">
                  {lesson.cohortName || 'Class'} · {formatDailyReportTime(lesson.startsAt)}–{formatDailyReportTime(lesson.endsAt)}
                  {lesson.roomName ? ` · Room: ${lesson.roomName}` : ''}
                </p>

                {lesson.attendanceStatus === 'completed' ? (
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                    <span className="text-slate-700">
                      Roster: <strong>{lesson.rosterCount || 0}</strong>
                    </span>
                    <span className="text-emerald-700 font-medium">
                      Present: <strong>{lesson.presentCount || 0}</strong>
                    </span>
                    <span className="text-rose-700 font-medium">
                      Absent: <strong>{lesson.absentCount || 0}</strong>
                    </span>
                    {lesson.notReportedCount > 0 ? (
                      <span className="text-amber-700 font-medium">
                        Not Reported: <strong>{lesson.notReportedCount}</strong>
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
                  >
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                    View / Edit Register
                  </button>
                ) : lesson.attendanceStatus === 'open' ? (
                  <button
                    type="button"
                    onClick={() => onRecordAttendance(lesson)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-warning-border bg-warning-surface px-3 py-1.5 text-xs font-semibold text-warning-hover transition hover:bg-warning/10"
                  >
                    <AlertTriangle className="size-3.5" />
                    Continue Marking
                  </button>
                ) : lesson.attendanceStatus === 'cancelled' ? (
                  <span className="text-[11px] font-medium text-text-muted">
                    Session Cancelled / Exception Logged
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
                    Record Attendance
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
      <div className="border-b border-border bg-surface-subtle px-4 py-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-text-primary">
          Class Attendance Summary
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-surface-subtle/50 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-2.5">Time</th>
              <th className="px-4 py-2.5">Unit</th>
              <th className="px-4 py-2.5">Class / Cohort</th>
              <th className="px-3 py-2.5 text-center">Roster</th>
              <th className="px-3 py-2.5 text-center text-emerald-700">Present</th>
              <th className="px-3 py-2.5 text-center text-rose-700">Absent</th>
              <th className="px-3 py-2.5 text-center text-amber-700">Not Reported</th>
              <th className="px-4 py-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lessons.map((l) => (
              <tr key={l.scheduledSessionId} className="hover:bg-surface-subtle/30">
                <td className="whitespace-nowrap px-4 py-2.5 text-text-muted">
                  {formatDailyReportTime(l.startsAt)}–{formatDailyReportTime(l.endsAt)}
                </td>
                <td className="px-4 py-2.5 font-semibold text-text-primary">
                  {l.unitCode ? `${l.unitCode} · ` : ''}{l.unitName}
                </td>
                <td className="px-4 py-2.5 text-text-secondary">
                  {l.cohortName}
                </td>
                <td className="px-3 py-2.5 text-center font-medium text-text-primary">
                  {l.rosterCount || 0}
                </td>
                <td className="px-3 py-2.5 text-center font-bold text-emerald-700">
                  {l.presentCount || 0}
                </td>
                <td className="px-3 py-2.5 text-center font-bold text-rose-700">
                  {l.absentCount || 0}
                </td>
                <td className="px-3 py-2.5 text-center text-amber-700 font-medium">
                  {l.notReportedCount || 0}
                </td>
                <td className="px-4 py-2.5 text-center">
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

  const totalNotReported = lessons.reduce((acc, l) => acc + (l.notReportedCount || 0), 0);
  const anyCompleted = lessons.some((l) => l.attendanceStatus === 'completed');

  return (
    <div className="space-y-3">
      {allAbsentees.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-rose-200 bg-white shadow-xs">
          <div className="border-b border-rose-100 bg-rose-50/70 px-4 py-3">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-rose-950">
              <AlertTriangle className="size-3.5 text-rose-600" />
              Students Who Missed Class ({allAbsentees.length})
            </h3>
            <p className="mt-0.5 text-[11px] text-rose-800">
              These reported students were marked absent across your scheduled classes.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-rose-100 bg-rose-50/30 text-[10px] font-semibold uppercase tracking-wide text-rose-900/80">
                <tr>
                  <th className="px-4 py-2.5">Student Name</th>
                  <th className="px-4 py-2.5">Admission No.</th>
                  <th className="px-4 py-2.5">Cohort</th>
                  <th className="px-4 py-2.5">Unit</th>
                  <th className="px-4 py-2.5">Remarks / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allAbsentees.map((s) => (
                  <tr key={`${s.studentId}-${s.unitCode}`} className="hover:bg-surface-subtle/40">
                    <td className="px-4 py-2.5 font-semibold text-text-primary">
                      {s.fullName}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-text-secondary">
                      {s.admissionNumber}
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">
                      {s.cohortName}
                    </td>
                    <td className="px-4 py-2.5 text-text-muted">
                      {s.unitCode ? `${s.unitCode} · ` : ''}{s.unitName}
                    </td>
                    <td className="px-4 py-2.5 text-text-muted italic">
                      {s.note || 'No note recorded'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : anyCompleted ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <p className="text-xs font-semibold">100% Attendance Recorded</p>
          </div>
          <p className="mt-0.5 text-[11px] text-emerald-800">
            All reported students attended their scheduled classes today.
          </p>
        </section>
      ) : null}

      {totalNotReported > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-amber-950 shadow-xs">
          <p className="text-xs font-medium">
            ℹ️ <strong>{totalNotReported}</strong> enrolled student{totalNotReported === 1 ? '' : 's'} have not yet reported for this semester and are excluded from absences.
          </p>
        </section>
      ) : null}
    </div>
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
    } catch (err: any) {
      alert(err?.message || 'Failed to open class attendance.');
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
    } catch (err: any) {
      alert(err?.message || 'Failed to open past class attendance.');
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
        <section className="rounded-xl border border-success-border bg-success-surface px-4 py-3">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="size-4" />
            <p className="text-sm font-semibold">Daily Report submitted</p>
          </div>
          <p className="mt-1 text-[11px] text-text-secondary">
            This daily report is locked as an official department record.
          </p>
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
            <div className="rounded-xl border border-border bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Other activity
              </p>
              <p className="mt-2 whitespace-pre-line text-xs leading-5 text-text-primary">
                {workspace.otherActivity || '—'}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Concern / action required
              </p>
              <p className="mt-2 whitespace-pre-line text-xs leading-5 text-text-primary">
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

        {!workspace.readyToSubmit ? (
          <section className="rounded-xl border border-warning-border bg-warning-surface px-4 py-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <p className="text-xs font-semibold text-text-primary">
                  Attendance pending before report submission
                </p>
                <p className="mt-1 text-[11px] leading-5 text-text-secondary">
                  {workspace.blockingReason}
                </p>
                <Link
                  href="/staff/attendance"
                  className="mt-2 inline-flex text-[11px] font-semibold text-primary hover:underline"
                >
                  Go to Class Attendance portal →
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        {isNonTeachingDay ? (
          <section className="rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-blue-950">
            <p className="text-xs font-semibold">
              No scheduled lessons for this date
            </p>
            <p className="mt-0.5 text-[11px] text-blue-800/80">
              To submit an official daily record for a non-teaching day, please enter your activity (meetings, prep, supervision) or any concerns below.
            </p>
          </section>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2">
          <label className="block rounded-xl border border-border bg-white p-4">
            <span className="text-xs font-semibold text-text-primary">
              Other activity
            </span>
            <span className="mt-1 block text-[10px] text-text-muted">
              {isNonTeachingDay ? 'Required on non-teaching days' : 'Optional · keep it brief'}
            </span>
            <textarea
              name="otherActivity"
              rows={4}
              maxLength={800}
              value={otherActivity}
              onChange={(e) => setOtherActivity(e.target.value)}
              className="mt-3 w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-xs leading-5 text-text-primary outline-none focus:border-primary"
              placeholder="Meeting, supervision, practical preparation..."
            />
          </label>

          <label className="block rounded-xl border border-border bg-white p-4">
            <span className="text-xs font-semibold text-text-primary">
              Concern / action required
            </span>
            <span className="mt-1 block text-[10px] text-text-muted">
              Optional · only what needs attention
            </span>
            <textarea
              name="concern"
              rows={4}
              maxLength={1200}
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              className="mt-3 w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-xs leading-5 text-text-primary outline-none focus:border-primary"
              placeholder="Student, timetable, room, equipment or academic concern..."
            />
          </label>
        </section>

        {state.message ? (
          <div
            className={`rounded-xl border px-4 py-3 text-xs font-semibold ${
              state.status === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            {state.message}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px] text-text-muted">
            {isNonTeachingDay && !hasText ? (
              <span className="text-amber-800 font-medium">
                * Enter your activity or notes above to enable submission.
              </span>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={pending || !isSubmittable}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ClipboardCheck className="size-4" />
            {pending ? 'Submitting...' : 'Submit daily report'}
          </button>
        </div>
      </form>
    </>
  );
}
