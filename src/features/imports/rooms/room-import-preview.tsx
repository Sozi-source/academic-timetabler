import {
  AlertCircle,
  CheckCircle2,
  Copy,
} from 'lucide-react';

import {
  Badge,
} from '@/components/ui/badge';
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
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-surface-subtle text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3">
                Row
              </th>

              <th className="px-4 py-3">
                Room
              </th>

              <th className="px-4 py-3">
                Type
              </th>

              <th className="px-4 py-3">
                Capacity
              </th>

              <th className="px-4 py-3">
                Location
              </th>

              <th className="px-4 py-3">
                Status
              </th>

              <th className="px-4 py-3">
                Validation result
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border-soft">
            {rows.map((row) => {
              const room =
                row.normalizedData;

              const roomCode =
                'code' in room
                  ? room.code
                  : String(
                      row.sourceData[
                        'Room Code'
                      ] ?? '',
                    );

              const roomName =
                'name' in room
                  ? room.name
                  : String(
                      row.sourceData[
                        'Room Name'
                      ] ??
                        'Unnamed room',
                    );

              return (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-4 font-medium text-text-primary">
                    {row.sourceRowNumber}
                  </td>

                  <td className="min-w-56 px-4 py-4">
                    <p className="font-semibold text-text-primary">
                      {roomName}
                    </p>

                    <p className="mt-1 text-xs text-text-muted">
                      {roomCode}
                    </p>
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-text-secondary">
                    {'roomType' in room
                      ? getRoomTypeLabel(
                          room.roomType,
                        )
                      : String(
                          row.sourceData[
                            'Room Type'
                          ] ?? '',
                        )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-text-secondary">
                    {'capacity' in room
                      ? room.capacity
                      : String(
                          row.sourceData[
                            'Capacity'
                          ] ?? '—',
                        )}
                  </td>

                  <td className="min-w-44 px-4 py-4 text-text-secondary">
                    {'building' in room ||
                    'floor' in room
                      ? [
                          room.building,
                          room.floor,
                        ]
                          .filter(Boolean)
                          .join(' · ') ||
                        'Not provided'
                      : 'Not provided'}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4">
                    {getStatusBadge(
                      row.status,
                    )}
                  </td>

                  <td className="min-w-72 px-4 py-4 text-text-muted">
                    {getErrorText(row) ||
                      'No validation issues.'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}