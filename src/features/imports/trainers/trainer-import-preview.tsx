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
  TrainerImportStagedRow,
} from './types';

function getStatusBadge(
  status: TrainerImportStagedRow['status'],
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

    case 'failed':
      return (
        <Badge variant="danger">
          <AlertCircle
            className="mr-1 size-3.5"
            aria-hidden="true"
          />
          Failed
        </Badge>
      );

    default:
      return (
        <Badge variant="danger">
          <AlertCircle
            className="mr-1 size-3.5"
            aria-hidden="true"
          />
          Invalid
        </Badge>
      );
  }
}
function getErrorText(
  row: TrainerImportStagedRow,
) {
  const fieldMessages =
    Object.values(row.fieldErrors).flat();

  return [
    ...fieldMessages,
    ...row.rowErrors,
  ].join(' ');
}

export function TrainerImportPreview({
  rows,
}: {
  rows: TrainerImportStagedRow[];
}) {
  return (
    <TableContainer label="Trainer import preview">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Row</TableHead>
            <TableHead>Staff No.</TableHead>
            <TableHead>Trainer</TableHead>
            <TableHead>School / Department</TableHead>
            <TableHead>Employment</TableHead>
            <TableHead>Workload</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Validation result</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row) => {
            const trainer = row.normalizedData;

            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-text-primary">
                  {row.sourceRowNumber}
                </TableCell>
                <TableCell className="font-mono text-xs text-text-muted">
                  {'staffNumber' in trainer
                    ? trainer.staffNumber
                    : String(row.sourceData['Staff Number'] ?? '')}
                </TableCell>
                <TableCell className="font-semibold text-text-primary">
                  {'fullName' in trainer
                    ? trainer.fullName
                    : String(row.sourceData['Full Name'] ?? 'Unnamed trainer')}
                </TableCell>
                <TableCell className="text-text-secondary">
                  {'departmentCode' in trainer
                    ? trainer.departmentCode
                    : String(row.sourceData['School / Department Code'] ?? '—')}
                </TableCell>
                <TableCell className="text-text-secondary">
                  {'employmentType' in trainer
                    ? trainer.employmentType
                    : String(row.sourceData['Employment Type'] ?? '')}
                </TableCell>
                <TableCell className="text-text-secondary">
                  {'normalWeeklyHours' in trainer
                    ? `${trainer.normalWeeklyHours}h target / ${trainer.maximumDailyHours}h daily limit`
                    : '—'}
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
