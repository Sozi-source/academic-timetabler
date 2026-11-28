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
  roomTypeOptions,
} from '@/features/rooms/types';

import type {
  RoomImportStagedRow,
} from './types';

function getRoomTypeLabel(
  roomType: string,
) {
  return (
    roomTypeOptions.find(
      (option) =>
        option.value === roomType,
    )?.label ?? roomType
  );
}

function getStatusBadge(
  status: RoomImportStagedRow['status'],
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
  row: RoomImportStagedRow,
) {
  return [
    ...Object.values(
      row.fieldErrors,
    ).flat(),
    ...row.rowErrors,
  ].join(' ');
}

export function RoomImportPreview({
  rows,
}: {
  rows: RoomImportStagedRow[];
}) {
  return (
    <TableContainer label="Room import preview">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Row</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Capacity</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Validation result</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row) => {
            const room = row.normalizedData;
            const roomCode =
              'code' in room
                ? room.code
                : String(row.sourceData['Room Code'] ?? '');
            const roomName =
              'name' in room
                ? room.name
                : String(row.sourceData['Room Name'] ?? 'Unnamed room');

            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-text-primary">
                  {row.sourceRowNumber}
                </TableCell>
                <TableCell className="font-mono text-xs text-text-muted">
                  {roomCode || '—'}
                </TableCell>
                <TableCell className="font-semibold text-text-primary">
                  {roomName}
                </TableCell>
                <TableCell className="text-text-secondary">
                  {'roomType' in room
                    ? getRoomTypeLabel(room.roomType)
                    : String(row.sourceData['Room Type'] ?? '')}
                </TableCell>
                <TableCell className="text-text-secondary">
                  {'capacity' in room
                    ? room.capacity
                    : String(row.sourceData['Capacity'] ?? '—')}
                </TableCell>
                <TableCell className="text-text-secondary">
                  {'building' in room || 'floor' in room
                    ? [room.building, room.floor].filter(Boolean).join(' · ') || 'Not provided'
                    : 'Not provided'}
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