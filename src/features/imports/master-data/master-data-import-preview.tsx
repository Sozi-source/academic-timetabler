import {
  AlertCircle,
  CheckCircle2,
  Copy,
} from 'lucide-react';

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
    <TableContainer label="Master data import preview">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Row</TableHead>
            <TableHead>
              {entity === 'programmes' ? 'Programme' : 'Cohort'}
            </TableHead>
            <TableHead>Code</TableHead>
            {entity === 'cohorts' ? (
              <TableHead>Programme</TableHead>
            ) : null}
            <TableHead>Status</TableHead>
            <TableHead>Validation result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const record = row.normalizedData;
            const errors = [
              ...Object.values(row.fieldErrors).flat(),
              ...row.rowErrors,
            ].join(' ');

            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.sourceRowNumber}
                </TableCell>
                <TableCell className="font-semibold text-text-primary">
                  {String(
                    record.name ??
                    row.sourceData[
                      entity === 'programmes'
                        ? 'Programme Name'
                        : 'Cohort Name'
                    ] ??
                    'Unnamed record',
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-text-muted">
                  {String(
                    record.code ??
                    row.sourceData[
                      entity === 'programmes'
                        ? 'Programme Code'
                        : 'Cohort Code'
                    ] ??
                    '—',
                  )}
                </TableCell>
                {entity === 'cohorts' ? (
                  <TableCell className="text-text-secondary">
                    {String(
                      record.programmeCode ??
                      row.sourceData['Programme Code'] ??
                      '—',
                    )}
                  </TableCell>
                ) : null}
                <TableCell>
                  {statusBadge(row.status)}
                </TableCell>
                <TableCell className="text-text-muted">
                  {errors || 'No validation issues.'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
