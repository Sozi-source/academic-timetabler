import {
  AlertTriangle,
  CheckCircle2,
  UserRound,
} from 'lucide-react';

import { formatDailyReportTime } from './domain';
import type { DepartmentDailyReportWorkspace } from './types';

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
            <table className="w-full min-w-[850px] text-left text-[11px]">
              <thead className="bg-surface-subtle text-[9px] font-semibold uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2 text-center">Present</th>
                  <th className="px-3 py-2 text-center">Absent</th>
                  <th className="px-3 py-2">Absentees</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {report.lessons.map((lesson) => (
                  <tr key={lesson.scheduledSessionId}>
                    <td className="whitespace-nowrap px-3 py-2.5 align-top">
                      {formatDailyReportTime(lesson.startsAt)}–
                      {formatDailyReportTime(lesson.endsAt)}
                    </td>
                    <td className="px-3 py-2.5 align-top font-medium text-text-primary">
                      {lesson.unitCode} · {lesson.unitName}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      {lesson.cohortName}
                    </td>
                    <td className="px-3 py-2.5 text-center align-top">
                      {lesson.presentCount}
                    </td>
                    <td className="px-3 py-2.5 text-center align-top font-semibold">
                      {lesson.absentCount}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      {lesson.absentees.length > 0
                        ? lesson.absentees
                            .map(
                              (student) =>
                                `${student.fullName} (${student.admissionNumber})`,
                            )
                            .join('; ')
                        : 'None'}
                    </td>
                  </tr>
                ))}

                {report.lessons.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
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
