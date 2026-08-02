import {
  AlertCircle,
  CheckCircle2,
  Copy,
} from 'lucide-react';

import {
  Badge,
} from '@/components/ui/badge';

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
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-surface-subtle text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3">
                Row
              </th>

              <th className="px-4 py-3">
                Allocation
              </th>

              <th className="px-4 py-3">
                Period
              </th>

              <th className="px-4 py-3">
                Trainer
              </th>

              <th className="px-4 py-3">
                Delivery
              </th>

              <th className="px-4 py-3">
                Room
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
              const allocation =
                row.normalizedData;

              const cohortCode =
                'cohortCode' in allocation
                  ? allocation.cohortCode
                  : String(
                      row.sourceData[
                        'Cohort Code'
                      ] ?? '',
                    );

              const unitCode =
                'unitCode' in allocation
                  ? allocation.unitCode
                  : String(
                      row.sourceData[
                        'Unit Code'
                      ] ?? '',
                    );

              return (
                <tr
                  key={row.id}
                  className="align-top"
                >
                  <td className="whitespace-nowrap px-4 py-4 font-medium text-text-primary">
                    {row.sourceRowNumber}
                  </td>

                  <td className="min-w-56 px-4 py-4">
                    <p className="font-semibold text-text-primary">
                      {unitCode}
                    </p>

                    <p className="mt-1 text-xs text-text-muted">
                      Cohort {cohortCode}
                    </p>
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-text-secondary">
                    {'academicPeriodCode' in
                    allocation
                      ? allocation.academicPeriodCode
                      : String(
                          row.sourceData[
                            'Academic Period Code'
                          ] ?? '',
                        )}
                  </td>

                  <td className="min-w-44 px-4 py-4 text-text-secondary">
                    {'trainerStaffNumber' in
                    allocation
                      ? allocation
                          .trainerStaffNumber
                      : String(
                          row.sourceData[
                            'Trainer Staff Number'
                          ] ?? '',
                        )}
                  </td>

                  <td className="min-w-48 px-4 py-4">
                    {'deliveryMode' in
                    allocation ? (
                      <>
                        <Badge variant="neutral">
                          {allocation.deliveryMode}
                        </Badge>

                        <p className="mt-2 text-xs text-text-muted">
                          {formatWeeklyHours(
                            allocation.weeklySessions,
                            allocation
                              .sessionDurationMinutes,
                          )}
                        </p>

                        <p className="mt-1 text-xs text-text-muted">
                          {
                            allocation
                              .sessionDurationMinutes
                          }{' '}
                          minutes per session
                        </p>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>

                  <td className="min-w-40 px-4 py-4 text-text-secondary">
                    {'preferredRoomCode' in
                    allocation
                      ? allocation
                          .preferredRoomCode ||
                        'No preference'
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