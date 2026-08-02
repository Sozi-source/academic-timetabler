import {
  AlertCircle,
  CheckCircle2,
  Copy,
} from 'lucide-react';

import {
  Badge,
} from '@/components/ui/badge';

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
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-surface-subtle text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3">
                Row
              </th>
              <th className="px-4 py-3">
                Trainer
              </th>
              <th className="px-4 py-3">
                Employment
              </th>
              <th className="px-4 py-3">
                Workload
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
              const trainer =
                row.normalizedData;

              return (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-4 font-medium text-text-primary">
                    {row.sourceRowNumber}
                  </td>

                  <td className="min-w-64 px-4 py-4">
                    <p className="font-semibold text-text-primary">
                      {'fullName' in trainer
                        ? trainer.fullName
                        : String(
                            row.sourceData[
                              'Full Name'
                            ] ?? 'Unnamed trainer',
                          )}
                    </p>

                    <p className="mt-1 text-xs text-text-muted">
                      {'staffNumber' in trainer
                        ? trainer.staffNumber
                        : String(
                            row.sourceData[
                              'Staff Number'
                            ] ?? '',
                          )}
                    </p>
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-text-secondary">
                    {'employmentType' in trainer
                      ? trainer.employmentType
                      : String(
                          row.sourceData[
                            'Employment Type'
                          ] ?? '',
                        )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-text-secondary">
                    {'maximumWeeklyHours' in trainer
                      ? `${trainer.maximumWeeklyHours} weekly / ${trainer.maximumDailyHours} daily`
                      : 'â€”'}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4">
                    {getStatusBadge(row.status)}
                  </td>

                  <td className="min-w-72 px-4 py-4 text-sm text-text-muted">
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