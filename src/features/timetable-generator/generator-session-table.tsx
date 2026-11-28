import { Clock3 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { GeneratorPreviewSession } from './server-types';

function formatDay(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function GeneratorSessionTable({
  sessions,
}: {
  sessions: GeneratorPreviewSession[];
}) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
        <CalendarEmptyState />
      </div>
    );
  }

  const orderedSessions = [...sessions].sort(
    (first, second) =>
      first.workingDayName.localeCompare(second.workingDayName) ||
      first.startsAt.localeCompare(second.startsAt) ||
      first.cohortCode.localeCompare(second.cohortCode),
  );

  return (
    <TableContainer label="Generated timetable sessions">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Day &amp; time</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Cohort</TableHead>
            <TableHead>Trainer</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Mode</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {orderedSessions.map((session) => {
            const cohortLabel =
              session.participantCohortCount > 1
                ? `${session.participantCohortCodes.join(' + ')}${
                    session.participantCohortCount > session.participantCohortCodes.length
                      ? ` +${session.participantCohortCount - session.participantCohortCodes.length}`
                      : ''
                  }`
                : session.cohortName;

            return (
              <TableRow
                key={session.id}
                className={
                  session.trainerId && session.roomId
                    ? undefined
                    : 'bg-warning-surface hover:bg-warning-surface/70'
                }
              >
                <TableCell className="font-semibold text-text-primary">
                  {formatDay(session.workingDayName)} · {session.startsAt}–{session.endsAt}
                </TableCell>

                <TableCell
                  className="font-semibold text-text-primary"
                  title={session.unitCode}
                >
                  {session.unitName}
                </TableCell>

                <TableCell className="text-text-secondary">
                  {cohortLabel}
                </TableCell>

                <TableCell>
                  {session.trainerId ? (
                    <span className="text-text-primary">{session.trainerName}</span>
                  ) : (
                    <Badge variant="warning">Unassigned</Badge>
                  )}
                </TableCell>

                <TableCell>
                  {session.roomId ? (
                    <span className="text-text-secondary">{session.roomName}</span>
                  ) : (
                    <Badge variant="warning">No room</Badge>
                  )}
                </TableCell>

                <TableCell>
                  <div className="inline-flex items-center gap-1.5">
                    <Badge variant="neutral">S{session.sessionNumber}</Badge>
                    <Badge variant="success">{session.deliveryMode}</Badge>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function CalendarEmptyState() {
  return (
    <>
      <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Clock3 className="size-5" aria-hidden="true" />
      </div>

      <h3 className="mt-4 font-semibold text-text-primary">
        No sessions generated
      </h3>
    </>
  );
}
