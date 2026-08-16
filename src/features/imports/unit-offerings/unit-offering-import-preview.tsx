import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

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
        label: 'New offering',
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
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

              <p className="mt-1 text-sm leading-6 text-text-muted">
                Similar valid units are grouped automatically when their normalized names, delivery type, weekly sessions and duration agree. Every cohort still retains its official programme unit and code.
              </p>

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

          <p className="mt-1 text-sm text-text-muted">
            Review database matches and
            validation errors before the
            import is confirmed.
          </p>
        </div>

        <div className="w-full overflow-hidden">
          <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
            <thead className="bg-surface-subtle text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-3 py-2.5">
                  Row
                </th>
                <th className="px-3 py-2.5">
                  Status
                </th>
                <th className="px-3 py-2.5">
                  Academic Period
                </th>
                <th className="px-3 py-2.5">
                  Programme
                </th>
                <th className="px-3 py-2.5">
                  Cohort
                </th>
                <th className="px-3 py-2.5">
                  Unit
                </th>
                <th className="px-3 py-2.5">
                  Delivery
                </th>
                <th className="px-3 py-2.5">
                  Shared class
                </th>
                <th className="px-3 py-2.5">
                  Operation
                </th>
                <th className="px-3 py-2.5">
                  Validation
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const normalized =
                  getNormalizedRow(row);

                const operation =
                  getOperationDisplay(
                    normalized,
                  );

                const errors =
                  getErrorMessages(row);

                return (
                  <tr
                    key={row.id}
                    className="align-top"
                  >
                    <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-text-muted">
                      {row.sourceRowNumber}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClassName(
                          row.status,
                        )}`}
                      >
                        {getStatusLabel(
                          row.status,
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-text-secondary">
                      {normalized.academicPeriod ??
                        '—'}
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-medium text-text-primary">
                        {normalized.programmeName ??
                          '—'}
                      </p>
                    </td>

                    <td className="px-4 py-4 text-text-secondary">
                      {normalized.cohortName ??
                        '—'}
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-medium text-text-primary">
                        {normalized.unitName ??
                          '—'}
                      </p>

                      {normalized.unitCode ? (
                        <p className="mt-1 font-mono text-xs text-text-muted">
                          {normalized.unitCode}
                        </p>
                      ) : null}

                      {normalized.masterUnitOperation ===
                      'create' ? (
                        <p className="mt-1 text-xs font-semibold text-primary">
                          Master Unit will be created
                        </p>
                      ) : normalized.masterUnitOperation ===
                        'reactivate' ? (
                        <p className="mt-1 text-xs font-semibold text-warning">
                          Master Unit will be reactivated
                        </p>
                      ) : null}
                    </td>

                    <td className="px-4 py-4 text-text-secondary">
                      <p>
                        {normalized.offeringType ??
                          '—'}
                      </p>

                      {normalized.weeklySessions ? (
                        <p className="mt-1 text-xs text-text-muted">
                          {
                            normalized.weeklySessions
                          }{' '}
                          session(s) ·{' '}
                          {
                            normalized.sessionDurationMinutes
                          }{' '}
                          min
                        </p>
                      ) : null}
                    </td>

                    <td className="px-4 py-4">
                      {normalized.sharedClassKey ? (
                        <div className="space-y-1.5">
                          <span className="inline-flex rounded-full border border-primary/20 bg-primary-subtle px-2.5 py-1 font-mono text-xs font-semibold text-primary">
                            {
                              normalized.sharedClassKey
                            }
                          </span>

                          <p className="text-xs text-text-muted">
                            {normalized.sharedClassSource ===
                            'automatic'
                              ? 'Automatically detected'
                              : 'Workbook override'}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <span className="text-text-muted">
                            Independent
                          </span>

                          {normalized.sharedClassSource ===
                          'independent' ? (
                            <p className="mt-1 text-xs text-warning">
                              Forced separate in workbook
                            </p>
                          ) : null}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {operation ? (
                        <div
                          className={`flex items-center gap-2 text-xs font-semibold ${operation.className}`}
                        >
                          <operation.icon
                            className="size-4"
                            aria-hidden="true"
                          />

                          {operation.label}
                        </div>
                      ) : (
                        <span className="text-text-muted">
                          —
                        </span>
                      )}
                    </td>

                    <td className="max-w-sm px-4 py-4">
                      {errors.length > 0 ? (
                        <div className="space-y-2 text-xs leading-5 text-danger">
                          {errors.map(
                            (error) => (
                              <div
                                key={error}
                                className="flex items-start gap-2"
                              >
                                <AlertTriangle
                                  className="mt-0.5 size-3.5 shrink-0"
                                  aria-hidden="true"
                                />

                                <span>
                                  {error}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-success">
                          Database relationships
                          resolved
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}