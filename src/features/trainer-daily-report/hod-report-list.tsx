import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserRound,
} from 'lucide-react';

import { formatDailyReportTime, getAbsenteeColumnClass } from './domain';
import type { DepartmentDailyReportWorkspace, TrainerDailyReportLesson } from './types';

function AbsenteeList({
  absentees,
}: {
  absentees: TrainerDailyReportLesson['absentees'];
}) {
  if (absentees.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
        <CheckCircle2 className="size-3 text-emerald-600" />
        None (100% Present)
      </span>
    );
  }

  const colClass = getAbsenteeColumnClass(absentees.length);

  return (
    <div className={`grid ${colClass} gap-x-4 gap-y-1.5`}>
      {absentees.map((student, idx) => (
        <div
          key={`${student.studentId || student.admissionNumber}-${idx}`}
          className="flex items-start gap-1.5 py-0.5 text-[10.5px] leading-snug"
        >
          <span className="mt-1 size-1.5 rounded-full bg-rose-500 shrink-0" />
          <div className="flex flex-wrap items-baseline gap-x-1">
            <span className="font-semibold text-text-primary">
              {student.fullName}
            </span>
            <span className="font-mono text-[9.5px] text-text-muted">
              ({student.admissionNumber})
            </span>
            {student.note ? (
              <span className="rounded bg-rose-50 px-1.5 py-0.2 text-[8.5px] font-medium text-rose-700 border border-rose-200/70">
                {student.note}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function HodDailyReportList({
  workspace,
}: {
  workspace: DepartmentDailyReportWorkspace;
}) {
  if (workspace.reports.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-white p-7 text-center">
        <UserRound className="mx-auto size-5 text-text-muted" />
        <p className="mt-2 text-sm font-semibold text-text-primary">
          No reports submitted
        </p>
        <p className="mt-1 text-[11px] text-text-muted">
          Submitted trainer reports for this date will appear here.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      {workspace.reports.map((report) => (
        <article
          key={report.reportId}
          className="overflow-hidden rounded-xl border border-border bg-white"
        >
          <header className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-text-primary">
                  {report.trainerName}
                </p>
                <span className="inline-flex items-center gap-1 rounded-full border border-success-border bg-success-surface px-2 py-1 text-[9px] font-semibold text-success">
                  <CheckCircle2 className="size-3" />
                  Submitted
                </span>
              </div>
              <p className="mt-1 text-[10px] text-text-muted">
                {report.homeDepartmentName}
                {report.trainerNumber ? ` · ${report.trainerNumber}` : ''}
              </p>
            </div>

            <p className="text-[10px] text-text-muted">
              {new Date(report.submittedAt).toLocaleString('en-GB', {
                timeZone: 'Africa/Nairobi',
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </header>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-[11px] table-fixed">
              <thead className="bg-surface-subtle text-[9px] font-semibold uppercase tracking-wide text-text-muted border-b border-border">
                <tr>
                  <th className="w-[230px] px-3.5 py-2.5">Unit & Time</th>
                  <th className="w-[60px] px-2 py-2.5 text-center">Present</th>
                  <th className="w-[60px] px-2 py-2.5 text-center">Absent</th>
                  <th className="px-3.5 py-2.5">Absentees</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {report.lessons.map((lesson) => (
                  <tr key={lesson.scheduledSessionId} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-3.5 py-3 align-top text-text-primary">
                      <div className="font-semibold text-xs leading-snug">
                        {lesson.unitName}
                      </div>
                      {lesson.unitCode ? (
                        <div className="mt-0.5 font-mono text-[11px] font-medium text-text-secondary">
                          {lesson.unitCode}
                        </div>
                      ) : null}
                      <div className="mt-1 flex items-center gap-1.5 font-mono text-[10.5px] text-text-muted">
                        <Clock className="size-3 text-text-muted/70 shrink-0" />
                        <span>
                          {formatDailyReportTime(lesson.startsAt)}–{formatDailyReportTime(lesson.endsAt)}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center align-top">
                      <span className="inline-block min-w-[24px] rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-emerald-700">
                        {lesson.presentCount}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center align-top">
                      <span
                        className={`inline-block min-w-[24px] rounded px-1.5 py-0.5 font-mono text-[10.5px] font-bold ${
                          lesson.absentCount > 0
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {lesson.absentCount}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 align-top">
                      <AbsenteeList absentees={lesson.absentees} />
                    </td>
                  </tr>
                ))}

                {report.lessons.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-3 text-center text-text-muted"
                    >
                      No scheduled lesson in this department.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {(report.otherActivity || report.concern) ? (
            <div className="grid gap-3 border-t border-border p-4 md:grid-cols-2">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-text-muted">
                  Other activity
                </p>
                <p className="mt-1 whitespace-pre-line text-[11px] leading-5 text-text-primary">
                  {report.otherActivity || '—'}
                </p>
              </div>

              <div>
                <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-text-muted">
                  {report.concern ? (
                    <AlertTriangle className="size-3 text-warning" />
                  ) : null}
                  Concern / action required
                </p>
                <p className="mt-1 whitespace-pre-line text-[11px] leading-5 text-text-primary">
                  {report.concern || '—'}
                </p>
              </div>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
