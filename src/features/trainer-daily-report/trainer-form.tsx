'use client';

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  initialTrainerDailyReportActionState,
  submitTrainerDailyReportAction,
} from './actions';
import { formatDailyReportTime } from './domain';
import type { TrainerDailyReportWorkspace } from './types';

function AttendanceBadge({
  status,
}: {
  status: TrainerDailyReportWorkspace['lessons'][number]['attendanceStatus'];
}) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success-border bg-success-surface px-2 py-1 text-[10px] font-semibold text-success">
        <CheckCircle2 className="size-3" />
        Completed
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

function LessonList({
  workspace,
}: {
  workspace: TrainerDailyReportWorkspace;
}) {
  if (workspace.lessons.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-white p-5 text-center">
        <UsersRound className="mx-auto size-5 text-text-muted" />
        <p className="mt-2 text-sm font-semibold text-text-primary">
          No scheduled lessons
        </p>
        <p className="mt-1 text-[11px] text-text-muted">
          You may still report another activity or concern for the day.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">
          Scheduled lessons
        </h2>
        <p className="mt-0.5 text-[11px] text-text-muted">
          Absentees come directly from completed Class Attendance.
        </p>
      </div>

      <div className="divide-y divide-border">
        {workspace.lessons.map((lesson) => (
          <article key={lesson.scheduledSessionId} className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-text-primary">
                  {lesson.unitCode} · {lesson.unitName}
                </p>
                <p className="mt-1 text-[11px] text-text-muted">
                  {lesson.cohortName} · {formatDailyReportTime(lesson.startsAt)}–
                  {formatDailyReportTime(lesson.endsAt)}
                </p>
              </div>

              <AttendanceBadge status={lesson.attendanceStatus} />
            </div>

            {lesson.attendanceStatus === 'completed' ? (
              <div className="mt-3 rounded-lg bg-surface-subtle px-3 py-2.5">
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
                  <span>
                    Present: <strong>{lesson.presentCount}</strong>
                  </span>
                  <span>
                    Absent: <strong>{lesson.absentCount}</strong>
                  </span>
                </div>

                {lesson.absentees.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                      Absentees
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {lesson.absentees.map((student) => (
                        <span
                          key={student.studentId}
                          className="rounded-md border border-border bg-white px-2 py-1 text-[10px] text-text-secondary"
                        >
                          {student.fullName} · {student.admissionNumber}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-[10px] text-text-muted">
                    No absentees recorded.
                  </p>
                )}
              </div>
            ) : null}
          </article>
        ))}
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

  const [otherActivity, setOtherActivity] = useState('');
  const [concern, setConcern] = useState('');

  const [state, action, pending] = useActionState(
    submitTrainerDailyReportAction,
    initialTrainerDailyReportActionState,
  );

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
    }
  }, [router, state.status]);

  const isNonTeachingDay = workspace.lessons.length === 0;
  const hasText = otherActivity.trim().length > 0 || concern.trim().length > 0;
  const isSubmittable = isNonTeachingDay ? hasText : workspace.readyToSubmit;

  if (workspace.status === 'submitted') {
    return (
      <div className="space-y-4">
        <section className="rounded-xl border border-success-border bg-success-surface px-4 py-3">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="size-4" />
            <p className="text-sm font-semibold">Report submitted</p>
          </div>
          <p className="mt-1 text-[11px] text-text-secondary">
            This daily report is locked as an official record.
          </p>
        </section>

        <LessonList workspace={workspace} />

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

      <LessonList workspace={workspace} />

      {!workspace.readyToSubmit ? (
        <section className="rounded-xl border border-warning-border bg-warning-surface px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <p className="text-xs font-semibold text-text-primary">
                Attendance pending
              </p>
              <p className="mt-1 text-[11px] leading-5 text-text-secondary">
                {workspace.blockingReason}
              </p>
              <Link
                href="/staff/attendance"
                className="mt-2 inline-flex text-[11px] font-semibold text-primary hover:underline"
              >
                Open Class Attendance
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
  );
}
