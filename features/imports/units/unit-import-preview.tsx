import {
  AlertCircle,
  CheckCircle2,
  Copy,
} from 'lucide-react';

import {
  Badge,
} from '@/components/ui/badge';
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
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <thead className="bg-surface-subtle text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-3 py-2.5">
                Row
              </th>

              <th className="px-3 py-2.5">
                Unit
              </th>

              <th className="px-3 py-2.5">
                Programme
              </th>

              <th className="px-3 py-2.5">
                Category
              </th>

              <th className="px-3 py-2.5">
                Period
              </th>

              <th className="px-3 py-2.5">
                Contact hours
              </th>

              <th className="px-3 py-2.5">
                Room preference
              </th>

              <th className="px-3 py-2.5">
                Status
              </th>

              <th className="px-3 py-2.5">
                Validation result
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border-soft">
            {rows.map((row) => {
              const unit =
                row.normalizedData;

              const unitName =
                'name' in unit
                  ? unit.name
                  : String(
                      row.sourceData[
                        'Unit Name'
                      ] ?? 'Unnamed unit',
                    );

              const unitCode =
                'code' in unit
                  ? unit.code
                  : String(
                      row.sourceData[
                        'Unit Code'
                      ] ?? '',
                    );

              return (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-4 font-medium text-text-primary">
                    {row.sourceRowNumber}
                  </td>

                  <td className="min-w-64 px-4 py-4">
                    <p className="font-semibold text-text-primary">
                      {unitName}
                    </p>

                    <p className="mt-1 text-xs text-text-muted">
                      {unitCode}
                    </p>
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-text-secondary">
                    {'programmeCode' in unit
                      ? unit.programmeCode
                      : String(
                          row.sourceData[
                            'Programme Code'
                          ] ?? '',
                        )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4">
                    {'category' in unit
                      ? (
                          <Badge variant="neutral">
                            {getCategoryLabel(
                              unit.category,
                            )}
                          </Badge>
                        )
                      : '—'}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-text-secondary">
                    {'academicPeriodNumber' in unit
                      ? `Period ${unit.academicPeriodNumber}`
                      : '—'}
                  </td>

                  <td className="min-w-48 px-4 py-4 text-text-secondary">
                    {'theoryHours' in unit
                      ? (
                          <>
                            <p>
                              Theory: {unit.theoryHours}
                            </p>

                            <p className="mt-1 text-xs text-text-muted">
                              Practical: {unit.practicalHours}
                              {' · '}
                              {unit.weeklySessions} session
                              {unit.weeklySessions === 1
                                ? ''
                                : 's'}
                              /week
                            </p>
                          </>
                        )
                      : '—'}
                  </td>

                  <td className="min-w-44 px-4 py-4 text-text-secondary">
                    {'preferredRoomType' in unit
                      ? getRoomTypeLabel(
                          unit.preferredRoomType,
                        )
                      : 'No preference'}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4">
                    {getStatusBadge(
                      row.status,
                    )}
                  </td>

                  <td className="min-w-80 px-4 py-4 text-text-muted">
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