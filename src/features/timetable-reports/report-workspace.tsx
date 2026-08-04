import {
  BookOpenCheck,
  Building2,
  CalendarClock,
  Clock3,
  LockKeyhole,
  UsersRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/ui/metric-card';

import { TimetableReportActions } from './report-actions';
import type {
  TimetableReportGroup,
  TimetableReportKind,
  TimetableReportRow,
  TimetableReportsData,
} from './types';

function SessionTable({ rows }: { rows: TimetableReportRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-surface-subtle text-xs uppercase tracking-wide text-text-muted">
          <tr>
            <th className="px-4 py-3">Day & time</th>
            <th className="px-4 py-3">Unit</th>
            <th className="px-4 py-3">Cohort</th>
            <th className="px-4 py-3">Trainer</th>
            <th className="px-4 py-3">Room</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.sessionId} className="align-top">
              <td className="px-4 py-3 font-medium text-text-primary">
                {row.day}
                <div className="mt-0.5 text-xs font-normal text-text-muted">
                  {row.startsAt}–{row.endsAt}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="font-semibold text-text-primary">{row.unitName}</div>
                <div className="text-xs text-text-muted">{row.unitCode}</div>
              </td>
              <td className="px-4 py-3 text-text-secondary">{row.cohort}</td>
              <td className="px-4 py-3 text-text-secondary">{row.trainer}</td>
              <td className="px-4 py-3 text-text-secondary">
                {row.roomCode} · {row.roomName}
              </td>
              <td className="px-4 py-3">
                <Badge variant={row.isLocked ? 'warning' : 'neutral'}>
                  {row.isLocked ? 'Locked' : row.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupedReport({ groups }: { groups: TimetableReportGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-text-muted">
        No timetable sessions are available for this report.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold text-text-primary">{group.label}</h2>
              {group.secondaryLabel ? (
                <p className="mt-1 text-xs text-text-muted">{group.secondaryLabel}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-text-muted">
              <span className="rounded-full bg-surface-subtle px-2.5 py-1">{group.sessionCount} sessions</span>
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-primary">{group.contactHours} hrs</span>
            </div>
          </div>
          <SessionTable rows={group.rows} />
        </section>
      ))}
    </div>
  );
}

function WorkloadReport({ groups }: { groups: TimetableReportGroup[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-surface-subtle text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-5 py-3">Trainer</th>
              <th className="px-5 py-3">Sessions</th>
              <th className="px-5 py-3">Contact hours</th>
              <th className="px-5 py-3">Cohorts</th>
              <th className="px-5 py-3">Units</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {groups.map((group) => (
              <tr key={group.key}>
                <td className="px-5 py-4 font-semibold text-text-primary">{group.label}</td>
                <td className="px-5 py-4 text-text-secondary">{group.sessionCount}</td>
                <td className="px-5 py-4 font-semibold text-primary">{group.contactHours}</td>
                <td className="px-5 py-4 text-text-secondary">
                  {new Set(group.rows.map((row) => row.cohort)).size}
                </td>
                <td className="px-5 py-4 text-text-secondary">
                  {new Set(group.rows.map((row) => row.unitCode)).size}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TimetableReportsWorkspace({
  academicPeriodId,
  data,
  report,
}: {
  academicPeriodId: string;
  data: TimetableReportsData;
  report: TimetableReportKind;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Scheduled sessions" value={String(data.summary.totalSessions)} description="All draft, confirmed and locked sessions." icon={CalendarClock} />
        <MetricCard label="Contact hours" value={`${data.summary.totalContactHours}`} description="Total scheduled teaching hours in the selected period." icon={Clock3} />
        <MetricCard label="Cohorts" value={String(data.summary.distinctCohorts)} description="Distinct cohorts represented in the timetable." icon={UsersRound} />
        <MetricCard label="Trainers" value={String(data.summary.distinctTrainers)} description="Distinct trainers with scheduled teaching." icon={BookOpenCheck} />
        <MetricCard label="Rooms" value={String(data.summary.distinctRooms)} description="Distinct teaching spaces currently in use." icon={Building2} />
        <MetricCard label="Locked sessions" value={String(data.summary.lockedSessions)} description="Sessions protected from regeneration." icon={LockKeyhole} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-text-primary">Report output</p>
          <p className="mt-1 text-xs text-text-muted">Print the current view or export the selected report as CSV.</p>
        </div>
        <TimetableReportActions academicPeriodId={academicPeriodId} report={report} />
      </div>

      {report === 'master' ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <SessionTable rows={data.rows} />
        </div>
      ) : null}
      {report === 'cohort' ? <GroupedReport groups={data.byCohort} /> : null}
      {report === 'trainer' ? <GroupedReport groups={data.byTrainer} /> : null}
      {report === 'room' ? <GroupedReport groups={data.byRoom} /> : null}
      {report === 'workload' ? <WorkloadReport groups={data.workload} /> : null}
    </div>
  );
}
