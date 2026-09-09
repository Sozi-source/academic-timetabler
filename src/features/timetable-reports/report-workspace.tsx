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
import { getMasterSessionPresentation } from './master-presentation';
import type {
  TimetableReportGroup,
  TimetableReportKind,
  TimetableReportRow,
  TimetableReportsData,
} from './types';
import type { ManualEntryOptions } from './manual-entry';
import { ManualTrainerEntryForm } from './manual-entry-form';
import { ManualVenueEditor } from './manual-venue-editor';
import { formatVenueLabel } from './venue-label';

function SessionTable({
  rows,
  master = false,
  academicPeriodId,
  manualEntryOptions,
}: {
  rows: TimetableReportRow[];
  master?: boolean;
  academicPeriodId?: string;
  manualEntryOptions?: ManualEntryOptions;
}) {
  return (
    <div className="w-full overflow-hidden">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <thead className="bg-surface-subtle text-xs uppercase tracking-wide text-text-muted">
          <tr>
            <th className="px-3 py-2.5">Day & time</th>
            <th className="px-3 py-2.5">Unit</th>
            <th className="px-3 py-2.5">Cohort</th>
            <th className="px-3 py-2.5">Trainer</th>
            <th className="px-3 py-2.5">{master ? 'Venue' : 'Room'}</th>
            <th className="px-3 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const presentation = getMasterSessionPresentation(row);

            return (
              <tr key={row.sessionId} className={master ? 'align-middle' : 'align-top'}>
              <td className="px-4 py-3 font-medium text-text-primary">
                {row.day}
                <div className="mt-0.5 text-xs font-normal text-text-muted">
                  {row.startsAt}–{row.endsAt}
                </div>
              </td>
              <td className="px-3 py-2.5">
                <div className={master ? 'text-base font-bold leading-snug text-text-primary' : 'font-semibold text-text-primary'}>{row.unitName}</div>
                {!master ? <div className="text-xs text-text-muted">{row.unitCode}</div> : null}
                {!master && row.departmentName && row.departmentCode?.toUpperCase() !== 'HND' && row.departmentName?.toUpperCase() !== 'HND' ? (
                  <div className="mt-1 text-xs font-medium text-primary">
                    {row.departmentCode ? `${row.departmentCode} · ` : ''}{row.departmentName}
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3 text-text-secondary">{row.cohort}</td>
              <td className="px-4 py-3 text-text-secondary">
                {row.trainerId ? <span className={master ? 'text-sm font-medium' : undefined}>{row.trainer}</span> : (
                  <Badge variant="warning">Unassigned</Badge>
                )}
              </td>
              <td className={master ? 'px-3 py-2.5 text-xs italic text-text-muted' : 'px-3 py-2.5 text-text-secondary'}>
                <div>{master ? presentation.venue : formatVenueLabel(row.roomCode, row.roomName)}</div>
                {!master && row.status === 'manual' && academicPeriodId && manualEntryOptions ? (
                  <div className="mt-2">
                    <ManualVenueEditor entryId={row.sessionId} academicPeriodId={academicPeriodId} rooms={manualEntryOptions.rooms} currentRoomCode={row.roomCode} />
                  </div>
                ) : null}
              </td>
              <td className="px-3 py-2.5">
                <Badge variant={row.isLocked ? 'warning' : row.status === 'confirmed' ? 'success' : 'neutral'}>
                  {row.isLocked ? 'Locked' : row.status === 'confirmed' ? 'Confirmed' : row.status === 'draft' ? 'Scheduled' : row.status}
                </Badge>
              </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GroupedReport({ groups, academicPeriodId, manualEntryOptions }: {
  groups: TimetableReportGroup[];
  academicPeriodId?: string;
  manualEntryOptions?: ManualEntryOptions;
}) {
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
        <section key={group.key} className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="font-semibold text-text-primary">{group.label}</h2>
              {group.secondaryLabel ? (
                <p className="mt-1 text-xs text-text-muted">{group.secondaryLabel}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="neutral">{group.sessionCount} sessions</Badge>
              <Badge variant="primary">{group.contactHours} hrs</Badge>
              {group.targetHours !== undefined ? <Badge variant="neutral">Target {group.targetHours} hrs</Badge> : null}
              {(group.extraHours ?? 0) > 0 ? <Badge variant="warning">Extra +{group.extraHours} hrs</Badge> : null}
            </div>
          </div>
          <SessionTable rows={group.rows} academicPeriodId={academicPeriodId} manualEntryOptions={manualEntryOptions} />
        </section>
      ))}
    </div>
  );
}

function WorkloadReport({ groups }: { groups: TimetableReportGroup[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <thead className="bg-surface-subtle text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-3 py-2.5">Trainer</th>
              <th className="px-3 py-2.5">Sessions</th>
              <th className="px-3 py-2.5">Target</th>
              <th className="px-3 py-2.5">Allocated</th>
              <th className="px-3 py-2.5">Scheduled</th>
              <th className="px-3 py-2.5">Extra</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Coverage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {groups.map((group) => (
              <tr key={group.key}>
                <td className="break-words px-3 py-2.5 font-semibold text-text-primary">{group.label}</td>
                <td className="px-3 py-2.5 text-text-secondary">{group.sessionCount}</td>
                <td className="px-3 py-2.5 text-text-secondary">{group.targetHours ?? 0}h</td>
                <td className="px-3 py-2.5 font-semibold text-text-primary">{group.allocatedHours ?? group.contactHours}h</td>
                <td className="px-3 py-2.5 font-semibold text-primary">{group.contactHours}h</td>
                <td className={`px-3 py-2.5 font-semibold ${(group.extraHours ?? 0) > 0 ? 'text-warning' : 'text-text-muted'}`}>{(group.extraHours ?? 0) > 0 ? `+${group.extraHours}h` : '0'}</td>
                <td className="px-3 py-2.5"><Badge variant={(group.extraHours ?? 0) > 0 ? 'warning' : 'success'}>{(group.extraHours ?? 0) > 0 ? 'Extra hours' : 'Within target'}</Badge></td>
                <td className="px-3 py-2.5 text-xs text-text-secondary">
                  {new Set(group.rows.map((row) => row.cohort)).size} cohorts · {new Set(group.rows.map((row) => row.unitCode)).size} units
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
  manualEntryOptions,
}: {
  academicPeriodId: string;
  data: TimetableReportsData;
  report: TimetableReportKind;
  manualEntryOptions?: ManualEntryOptions;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Scheduled sessions" value={String(data.summary.totalSessions)} description="Draft & confirmed" icon={CalendarClock} />
        <MetricCard label="Contact hours" value={`${data.summary.totalContactHours}`} description="Teaching hours" icon={Clock3} />
        <MetricCard label="Cohorts" value={String(data.summary.distinctCohorts)} description="Active cohorts" icon={UsersRound} />
        <MetricCard label="Trainers" value={String(data.summary.distinctTrainers)} description="Active trainers" icon={BookOpenCheck} />
        <MetricCard label="Rooms" value={String(data.summary.distinctRooms)} description="Active rooms" icon={Building2} />
        <MetricCard label="Locked sessions" value={String(data.summary.lockedSessions)} description="Protected sessions" icon={LockKeyhole} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-text-primary">Report output</p>
          <p className="mt-1 text-xs text-text-muted">
            {report === 'trainer'
              ? 'Export trainer timetables as Word or PDF.'
              : report === 'master'
                ? 'Export master timetable as Word, PDF or CSV.'
                : 'Print report or download CSV data.'}
          </p>
        </div>
        <TimetableReportActions academicPeriodId={academicPeriodId} report={report} />
      </div>

      {report === 'trainer' && manualEntryOptions ? (
        <ManualTrainerEntryForm academicPeriodId={academicPeriodId} options={manualEntryOptions} />
      ) : null}

      {report === 'master' ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <SessionTable rows={data.rows} master />
        </div>
      ) : null}
      {report === 'cohort' ? <GroupedReport groups={data.byCohort} /> : null}
      {report === 'trainer' ? <GroupedReport groups={data.byTrainer} academicPeriodId={academicPeriodId} manualEntryOptions={manualEntryOptions} /> : null}
      {report === 'room' ? <GroupedReport groups={data.byRoom} /> : null}
      {report === 'workload' ? <WorkloadReport groups={data.workload} /> : null}
    </div>
  );
}
