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
import {
  unitCategoryOptions,
} from '@/features/units/types';
import {
  roomTypeOptions,
} from '@/features/rooms/types';

import type {
  UnitImportStagedRow,
} from './types';

function getCategoryLabel(
  category: string,
) {
  return (
    unitCategoryOptions.find(
      (option) =>
        option.value === category,
    )?.label ?? category
  );
}

function getRoomTypeLabel(
  roomType: string | undefined,
) {
  if (!roomType) {
    return 'No preference';
  }

  return (
    roomTypeOptions.find(
      (option) =>
        option.value === roomType,
    )?.label ?? roomType
  );
}

function getStatusBadge(
  status: UnitImportStagedRow['status'],
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
  row: UnitImportStagedRow,
) {
  return [
    ...Object.values(
      row.fieldErrors,
    ).flat(),
    ...row.rowErrors,
  ].join(' ');
}

export function UnitImportPreview({
  rows,
}: {
  rows: UnitImportStagedRow[];
}) {
  return (
    <TableContainer label="Unit import preview">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Row</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Programme</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Y/S</TableHead>
            <TableHead>Contact hours</TableHead>
            <TableHead>Room preference</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Validation result</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row) => {
            const unit = row.normalizedData;
            const unitName =
              'name' in unit
                ? unit.name
                : String(row.sourceData['Unit Name'] ?? 'Unnamed unit');
            const unitCode =
              'code' in unit
                ? unit.code
                : String(row.sourceData['Unit Code'] ?? '');

            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-text-primary">
                  {row.sourceRowNumber}
                </TableCell>
                <TableCell className="font-mono text-xs text-text-muted">
                  {unitCode || '—'}
                </TableCell>
                <TableCell className="font-semibold text-text-primary">
                  {unitName}
                </TableCell>
                <TableCell className="text-text-secondary">
                  {'programmeCode' in unit
                    ? unit.programmeCode
                    : String(row.sourceData['Programme Code'] ?? '')}
                </TableCell>
                <TableCell>
                  {'category' in unit ? (
                    <Badge variant="neutral">
                      {getCategoryLabel(unit.category)}
                    </Badge>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-text-secondary">
                  {'academicPeriodNumber' in unit
                    ? `Period ${unit.academicPeriodNumber}`
                    : '—'}
                </TableCell>
                <TableCell className="text-text-secondary">
                  {'theoryHours' in unit
                    ? `T:${unit.theoryHours} · P:${unit.practicalHours} · ${unit.weeklySessions}s/wk`
                    : '—'}
                </TableCell>
                <TableCell className="text-text-secondary">
                  {'preferredRoomType' in unit
                    ? getRoomTypeLabel(unit.preferredRoomType)
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