import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

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
  NormalizedUnitOfferingImportRow,
  UnitOfferingImportStagedRow,
} from './types';

interface UnitOfferingImportPreviewProps {
  rows:
    UnitOfferingImportStagedRow[];
}

type PreviewFilter =
  | 'all'
  | 'valid'
  | 'invalid'
  | 'duplicate';

function getNormalizedRow(
  row:
    UnitOfferingImportStagedRow,
) {
  return row.normalizedData as
    Partial<
      NormalizedUnitOfferingImportRow
    >;
}

function getStatusLabel(
  status:
    UnitOfferingImportStagedRow['status'],
) {
  switch (status) {
    case 'valid':
      return 'Valid';

    case 'invalid':
      return 'Invalid';

    case 'duplicate':
      return 'Duplicate';

    case 'imported':
      return 'Imported';

    case 'skipped':
      return 'Skipped';

    case 'failed':
      return 'Failed';

    default:
      return 'Pending';
  }
}

function getStatusClassName(
  status:
    UnitOfferingImportStagedRow['status'],
) {
  switch (status) {
    case 'valid':
    case 'imported':
      return 'border-success/20 bg-success-subtle text-success';

    case 'invalid':
    case 'failed':
      return 'border-danger/20 bg-danger-subtle text-danger';

    case 'duplicate':
    case 'skipped':
      return 'border-warning/20 bg-warning-subtle text-warning';

    default:
      return 'border-border bg-surface-subtle text-text-muted';
  }
}

function getOperationDisplay(
  normalized:
    Partial<
      NormalizedUnitOfferingImportRow
    >,
) {
  switch (
    normalized.importOperation
  ) {
    case 'insert':
      return {
        label: 'New unit',
        icon: CheckCircle2,
        className:
          'text-success',
      };

    case 'update':
      return {
        label: 'Update existing',
        icon: RefreshCw,
        className:
          'text-primary',
      };

    case 'preserve-reviewed':
      return {
        label:
          'Preserve reviewed decision',
        icon: ShieldCheck,
        className:
          'text-warning',
      };

    default:
      return null;
  }
}

function getErrorMessages(
  row:
    UnitOfferingImportStagedRow,
) {
  const fieldMessages =
    Object.entries(
      row.fieldErrors,
    ).flatMap(
      ([field, messages]) =>
        messages.map(
          (message) =>
            `${field}: ${message}`,
        ),
    );

  return [
    ...fieldMessages,
    ...row.rowErrors,
  ];
}

export function UnitOfferingImportPreview({
  rows,
}: UnitOfferingImportPreviewProps) {
  const counts = {
    all: rows.length,
    valid:
      rows.filter(
        (row) =>
          row.status === 'valid',
      ).length,
    invalid:
      rows.filter(
        (row) =>
          row.status === 'invalid',
      ).length,
    duplicate:
      rows.filter(
        (row) =>
          row.status === 'duplicate',
      ).length,
  } satisfies Record<
    PreviewFilter,
    number
  >;

  const sharedClassGroups =
    new Map<string, number>();

  for (const row of rows) {
    const normalized =
      getNormalizedRow(row);

    const sharedKey =
      normalized.sharedClassKey;

    if (
      row.status !== 'valid' ||
      !sharedKey
    ) {
      continue;
    }

    sharedClassGroups.set(
      sharedKey,
      (
        sharedClassGroups.get(
          sharedKey,
        ) ?? 0
      ) + 1,
    );
  }

  const detectedSharedGroups =
    [...sharedClassGroups.entries()]
      .filter(
        ([, count]) =>
          count > 1,
      )
      .sort(
        ([first], [second]) =>
          first.localeCompare(second),
      );

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            [
              'All rows',
              counts.all,
            ],
            [
              'Valid',
              counts.valid,
            ],
            [
              'Invalid',
              counts.invalid,
            ],
            [
              'Duplicates',
              counts.duplicate,
            ],
          ] as const
        ).map(
          ([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {label}
              </p>

              <p className="mt-2 text-2xl font-bold text-text-primary">
                {value}
              </p>
            </div>
          ),
        )}
      </section>

      {detectedSharedGroups.length >
      0 ? (
        <section className="rounded-2xl border border-primary/20 bg-primary-subtle p-5">
          <div className="flex items-start gap-3">
            <Copy
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />

            <div>
              <h2 className="font-semibold text-text-primary">
                Shared classes detected
              </h2>


              <div className="mt-3 flex flex-wrap gap-2">
                {detectedSharedGroups.map(
                  ([key, count]) => (
                    <span
                      key={key}
                      className="rounded-full border border-primary/20 bg-surface px-3 py-1 text-xs font-semibold text-primary"
                    >
                      {key} · {count} rows
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border px-3 py-2.5">
          <h2 className="font-semibold text-text-primary">
            Workbook rows
          </h2>

        </div>

        <TableContainer embedded label="Unit offering workbook rows">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Row</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Academic Period</TableHead>
                <TableHead>Programme</TableHead>
                <TableHead>Cohort</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>Shared class</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Validation</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((row) => {
                const normalized = getNormalizedRow(row);
                const operation = getOperationDisplay(normalized);
                const errors = getErrorMessages(row);

                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs text-text-muted">
                      {row.sourceRowNumber}
                    </TableCell>

                    <TableCell>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusClassName(
                          row.status,
                        )}`}
                      >
                        {getStatusLabel(row.status)}
                      </span>
                    </TableCell>

                    <TableCell className="text-text-secondary">
                      {normalized.academicPeriod ?? '—'}
                    </TableCell>

                    <TableCell className="font-medium text-text-primary">
                      {normalized.programmeName ?? '—'}
                    </TableCell>

                    <TableCell className="text-text-secondary">
                      {normalized.cohortName ?? '—'}
                    </TableCell>

                    <TableCell title={normalized.unitCode ?? undefined}>
                      <span className="font-medium text-text-primary">
                        {normalized.unitName ?? '—'}
                      </span>
                      {normalized.masterUnitOperation === 'create' ? (
                        <span className="ml-1.5 text-xs font-semibold text-primary">· New unit</span>
                      ) : normalized.masterUnitOperation === 'reactivate' ? (
                        <span className="ml-1.5 text-xs font-semibold text-warning">· Reactivate</span>
                      ) : null}
                    </TableCell>

                    <TableCell className="text-text-secondary">
                      {normalized.offeringType ?? '—'}
                      {normalized.weeklySessions
                        ? ` · ${normalized.weeklySessions}×${normalized.sessionDurationMinutes}m`
                        : ''}
                    </TableCell>

                    <TableCell>
                      {normalized.sharedClassKey ? (
                        <span className="inline-flex rounded-full border border-primary/20 bg-primary-subtle px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                          {normalized.sharedClassKey}
                        </span>
                      ) : (
                        <span className="text-text-muted">
                          {normalized.sharedClassSource === 'independent' ? 'Independent (forced)' : 'Independent'}
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      {operation ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${operation.className}`}>
                          <operation.icon className="size-3.5" aria-hidden="true" />
                          {operation.label}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {errors.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-danger">
                          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                          <span>{errors.join(' · ')}</span>
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-success">
                          Database relationships resolved
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </section>
    </div>
  );
}