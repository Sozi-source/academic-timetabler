import {
  AlertCircle,
  CheckCircle2,
  Copy,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import type {
  MasterDataImportEntity,
  MasterDataImportStagedRow,
} from './types';

function statusBadge(
  status: MasterDataImportStagedRow['status'],
) {
  if (
    status === 'valid' ||
    status === 'imported'
  ) {
    return (
      <Badge variant="success">
        <CheckCircle2 className="mr-1 size-3.5" aria-hidden="true" />
        {status === 'imported' ? 'Imported' : 'Ready'}
      </Badge>
    );
  }

  if (
    status === 'duplicate' ||
    status === 'skipped'
  ) {
    return (
      <Badge variant="warning">
        <Copy className="mr-1 size-3.5" aria-hidden="true" />
        {status === 'duplicate' ? 'Duplicate' : 'Skipped'}
      </Badge>
    );
  }

  return (
    <Badge variant="danger">
      <AlertCircle className="mr-1 size-3.5" aria-hidden="true" />
      {status === 'failed' ? 'Failed' : 'Invalid'}
    </Badge>
  );
}

export function MasterDataImportPreview({
  entity,
  rows,
}: {
  entity: MasterDataImportEntity;
  rows: MasterDataImportStagedRow[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-surface-subtle text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3">Row</th>
              <th className="px-4 py-3">
                {entity === 'programmes' ? 'Programme' : 'Cohort'}
              </th>
              {entity === 'cohorts' ? (
                <th className="px-4 py-3">Programme</th>
              ) : null}
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Validation result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft">
            {rows.map((row) => {
              const record = row.normalizedData;
              const errors = [
                ...Object.values(row.fieldErrors).flat(),
                ...row.rowErrors,
              ].join(' ');

              return (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-4 font-medium">
                    {row.sourceRowNumber}
                  </td>
                  <td className="min-w-56 px-4 py-4">
                    <p className="font-semibold text-text-primary">
                      {String(
                        record.name ??
                        row.sourceData[
                          entity === 'programmes'
                            ? 'Programme Name'
                            : 'Cohort Name'
                        ] ??
                        'Unnamed record',
                      )}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {String(
                        record.code ??
                        row.sourceData[
                          entity === 'programmes'
                            ? 'Programme Code'
                            : 'Cohort Code'
                        ] ??
                        'Generated after validation',
                      )}
                    </p>
                  </td>
                  {entity === 'cohorts' ? (
                    <td className="whitespace-nowrap px-4 py-4 text-text-secondary">
                      {String(
                        record.programmeCode ??
                        row.sourceData['Programme Code'] ??
                        '—',
                      )}
                    </td>
                  ) : null}
                  <td className="whitespace-nowrap px-4 py-4">
                    {statusBadge(row.status)}
                  </td>
                  <td className="min-w-72 px-4 py-4 text-text-muted">
                    {errors || 'No validation issues.'}
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
