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
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
    <TableContainer embedded label="Timetable sessions report">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Day &amp; time</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Cohort</TableHead>
            <TableHead>Trainer</TableHead>
            <TableHead>{master ? 'Venue' : 'Room'}</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const presentation = getMasterSessionPresentation(row);
            const isExternalDept =
              !master &&
              row.departmentName &&
              row.departmentCode?.toUpperCase() !== 'HND' &&
              row.departmentName?.toUpperCase() !== 'HND';

            return (
              <TableRow key={row.sessionId}>
                <TableCell className="font-semibold text-text-primary">
                  {row.day} · {row.startsAt}–{row.endsAt}
                </TableCell>
                <TableCell title={row.unitCode}>
                  <span className="font-semibold text-text-primary">{row.unitName}</span>
                  {isExternalDept ? (
                    <span className="ml-1.5 rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      {row.departmentCode ?? row.departmentName}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-text-secondary">{row.cohort}</TableCell>
                <TableCell className="text-text-secondary">
                  {row.trainerId ? (
                    <span className="font-medium text-text-primary">{row.trainer}</span>
                  ) : (
                    <Badge variant="warning">Unassigned</Badge>
                  )}
                </TableCell>
                <TableCell className={master ? 'italic text-text-muted' : 'text-text-secondary'}>
                  <div className="inline-flex items-center gap-2">
                    <span>{master ? presentation.venue : formatVenueLabel(row.roomCode, row.roomName)}</span>
                    {!master && row.status === 'manual' && academicPeriodId && manualEntryOptions ? (
                      <ManualVenueEditor
                        entryId={row.sessionId}
                        academicPeriodId={academicPeriodId}
                        rooms={manualEntryOptions.rooms}
                        currentRoomCode={row.roomCode}
                      />
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={row.isLocked ? 'warning' : row.status === 'confirmed' ? 'success' : 'neutral'}>
                    {row.isLocked ? 'Locked' : row.status === 'confirmed' ? 'Confirmed' : row.status === 'draft' ? 'Scheduled' : row.status}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
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
    <TableContainer label="Trainer workload report">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Trainer</TableHead>
            <TableHead>Sessions</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Allocated</TableHead>
            <TableHead>Scheduled</TableHead>
            <TableHead>Extra</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Coverage</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <TableRow key={group.key}>
              <TableCell className="font-semibold text-text-primary">{group.label}</TableCell>
              <TableCell className="text-text-secondary">{group.sessionCount}</TableCell>
              <TableCell className="text-text-secondary">{group.targetHours ?? 0}h</TableCell>
              <TableCell className="font-semibold text-text-primary">{group.allocatedHours ?? group.contactHours}h</TableCell>
              <TableCell className="font-semibold text-primary">{group.contactHours}h</TableCell>
              <TableCell className={`font-semibold ${(group.extraHours ?? 0) > 0 ? 'text-warning' : 'text-text-muted'}`}>
                {(group.extraHours ?? 0) > 0 ? `+${group.extraHours}h` : '0'}
              </TableCell>
              <TableCell>
                <Badge variant={(group.extraHours ?? 0) > 0 ? 'warning' : 'success'}>
                  {(group.extraHours ?? 0) > 0 ? 'Extra hours' : 'Within target'}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-text-secondary">
                {new Set(group.rows.map((row) => row.cohort)).size} cohorts · {new Set(group.rows.map((row) => row.unitCode)).size} units
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
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
