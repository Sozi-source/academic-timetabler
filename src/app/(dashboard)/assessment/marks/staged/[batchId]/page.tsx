import {
  FileSpreadsheet,
} from 'lucide-react';
import {
  notFound,
} from 'next/navigation';

import {
  Badge,
} from '@/components/ui/badge';
import {
  Card,
} from '@/components/ui/card';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  getStagedAssessmentMarkbook,
} from '@/features/assessment/markbook-staging-query';

interface PageProps {
  params: Promise<{
    batchId: string;
  }>;
}

function resultLabel(
  status: string,
): string {
  if (
    status ===
    'sat'
  ) {
    return 'Mark';
  }

  if (
    status ===
    'absent'
  ) {
    return 'Absent';
  }

  if (
    status ===
    'missing_mark'
  ) {
    return 'Missing';
  }

  return status;
}

export default async function StagedAssessmentMarkbookPage({
  params,
}: PageProps) {
  await requireHodAccess();

  const {
    batchId,
  } = await params;

  let batch;

  try {
    batch =
      await getStagedAssessmentMarkbook(
        batchId,
      );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        'Staged markbook was not found.'
    ) {
      notFound();
    }

    throw error;
  }

  const grouped =
    new Map<
      string,
      typeof batch.rows
    >();

  for (
    const row of batch.rows
  ) {
    const rows =
      grouped.get(
        row.sheetName,
      ) ??
      [];

    rows.push(
      row,
    );

    grouped.set(
      row.sheetName,
      rows,
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Assessment"
        title="Staged marks"
        description="Validated workbook preview before results are committed."
        icon={FileSpreadsheet}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-text-primary">
              {
                batch.unitName
              }
            </p>

            <p className="mt-1 text-xs text-text-muted">
              {batch.assessmentType ===
              'exam'
                ? 'Exam'
                : 'CAT'}
              {' Â· '}
              {
                batch.academicPeriodName
              }
            </p>

            <p className="mt-1 truncate text-[11px] text-text-muted">
              {
                batch.sourceFilename
              }
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">
              Ready
            </Badge>

            <Badge variant="neutral">
              {
                batch.totalRows
              } students
            </Badge>

            <Badge variant="neutral">
              {
                batch.numericMarks
              } marks
            </Badge>

            <Badge variant="neutral">
              {
                batch.absences
              } absent
            </Badge>

            <Badge variant="neutral">
              {
                batch.missingMarks
              } missing
            </Badge>
          </div>
        </div>
      </Card>

      {[
        ...grouped.entries(),
      ].map(
        ([
          sheetName,
          rows,
        ]) => (
          <Card
            key={
              sheetName
            }
            className="overflow-hidden"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-text-primary">
                {
                  sheetName
                }
              </p>

              <p className="mt-0.5 text-[11px] text-text-muted">
                {
                  rows.length
                } students
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="bg-surface-subtle text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
                  <tr>
                    <th className="px-4 py-2.5">
                      Admission No.
                    </th>

                    <th className="px-4 py-2.5">
                      Attendance
                    </th>

                    <th className="px-4 py-2.5">
                      Result
                    </th>

                    <th className="px-4 py-2.5 text-right">
                      Mark
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {rows.map(
                    (
                      row,
                    ) => (
                      <tr
                        key={
                          row.id
                        }
                        className="bg-white"
                      >
                        <td className="px-4 py-3 font-medium text-text-primary">
                          {
                            row.admissionNumber
                          }
                        </td>

                        <td className="px-4 py-3 text-text-secondary">
                          {row.attendanceStatus ===
                          'absent'
                            ? 'Absent'
                            : 'Expected'}
                        </td>

                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              row.resultStatus ===
                              'sat'
                                ? 'success'
                                : 'neutral'
                            }
                          >
                            {resultLabel(
                              row.resultStatus,
                            )}
                          </Badge>
                        </td>

                        <td className="px-4 py-3 text-right font-semibold text-text-primary">
                          {row.resultStatus ===
                          'absent'
                            ? 'AB'
                            : row.mark ??
                              'â€”'}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ),
      )}

      <p className="text-[11px] leading-5 text-text-muted">
        No academic result has been
        written yet. This batch is an
        auditable staging record awaiting
        final import.
      </p>
    </div>
  );
}
