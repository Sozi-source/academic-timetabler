import {
  AlertCircle,
  CheckCircle2,
  Copy,
} from 'lucide-react';

import {
  Badge,
} from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type {
  TeachingAllocationImportStagedRow,
} from './types';

function getStatusBadge(
  status:
    TeachingAllocationImportStagedRow['status'],
) {
  switch (status) {
    case 'valid':
      return (
        <Badge variant="success">
          <CheckCircle2
            className="mr-1 size-3.5"
            aria-hidden="true"
          />
          Ready
        </Badge>
      );

    case 'imported':
      return (
        <Badge variant="success">
          <CheckCircle2
            className="mr-1 size-3.5"
            aria-hidden="true"
          />
          Imported
        </Badge>
      );

    case 'duplicate':
      return (
        <Badge variant="warning">
          <Copy
            className="mr-1 size-3.5"
            aria-hidden="true"
          />
          Duplicate
        </Badge>
      );

    case 'skipped':
      return (
        <Badge variant="warning">
          <Copy
            className="mr-1 size-3.5"
            aria-hidden="true"
          />
          Skipped
        </Badge>
      );

    default:
      return (
        <Badge variant="danger">
          <AlertCircle
            className="mr-1 size-3.5"
            aria-hidden="true"
          />
          {status === 'failed'
            ? 'Failed'
            : 'Invalid'}
        </Badge>
      );
  }
}

function getErrorText(
  row:
    TeachingAllocationImportStagedRow,
) {
  return [
    ...Object.values(
      row.fieldErrors,
    ).flat(),
    ...row.rowErrors,
  ].join(' ');
}

function formatWeeklyHours(
  weeklySessions: number,
  durationMinutes: number,
) {
  const hours =
    weeklySessions *
    durationMinutes /
    60;

  return Number.isInteger(hours)
    ? `${hours} hrs/week`
    : `${hours.toFixed(1)} hrs/week`;
}

export function TeachingAllocationImportPreview({
  rows,
}: {
  rows:
    TeachingAllocationImportStagedRow[];
}) {
  return (
    <TableContainer label="Teaching allocation import preview">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Row</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Cohort</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Trainer</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Validation result</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row) => {
            const allocation = row.normalizedData;
            const cohortCode =
              'cohortCode' in allocation
                ? allocation.cohortCode
                : String(row.sourceData['Cohort Code'] ?? '');
            const unitCode =
              'unitCode' in allocation
                ? allocation.unitCode
                : String(row.sourceData['Unit Code'] ?? '');

            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-text-primary">
                  {row.sourceRowNumber}
                </TableCell>
                <TableCell className="font-semibold text-text-primary">
                  {unitCode}
                </TableCell>
                <TableCell className="text-text-secondary">
                  {cohortCode}
                </TableCell>
                <TableCell className="text-text-secondary">
                  {'academicPeriodCode' in allocation
                    ? allocation.academicPeriodCode
                    : String(row.sourceData['Academic Period Code'] ?? '')}
                </TableCell>
                <TableCell className="text-text-secondary">
                  {'trainerStaffNumber' in allocation
                    ? allocation.trainerStaffNumber
                    : String(row.sourceData['Trainer Staff Number'] ?? '')}
                </TableCell>
                <TableCell>
                  {'deliveryMode' in allocation ? (
                    <div className="inline-flex items-center gap-2">
                      <Badge variant="neutral">{allocation.deliveryMode}</Badge>
                      <span className="text-xs text-text-muted">
                        {formatWeeklyHours(allocation.weeklySessions, allocation.sessionDurationMinutes)} ({allocation.sessionDurationMinutes}m)
                      </span>
                    </div>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-text-secondary">
                  {'preferredRoomCode' in allocation
                    ? allocation.preferredRoomCode || 'No preference'
                    : 'No preference'}
                </TableCell>
                <TableCell>
                  {getStatusBadge(row.status)}
                </TableCell>
                <TableCell className="text-text-muted">
                  {getErrorText(row) || 'No validation issues.'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}