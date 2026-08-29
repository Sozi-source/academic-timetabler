import {
  ArrowLeft,
  FileSpreadsheet,
} from 'lucide-react';
import Link from 'next/link';
import {
  notFound,
} from 'next/navigation';

import {
  Badge,
} from '@/components/ui/badge';
import {
  MetricCard,
} from '@/components/ui/metric-card';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  getStagedAssessmentMarkbook,
} from '@/features/assessment/markbook-staging-query';
import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  StaffCommitControl,
} from '@/features/staff-assessment/staff-commit-control';
import {
  trainerCanAccessAssessment,
} from '@/features/staff-assessment/authorization';

interface PageProps {
  params: Promise<{
    batchId: string;
  }>;
  searchParams: Promise<{
    allocationId?: string;
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

export default async function StaffStagedMarkbookPage({
  params,
  searchParams,
}: PageProps) {
  await requireTrainerAccess();

  const {
    batchId,
  } = await params;

  const {
    allocationId,
  } = await searchParams;

  const staged =
    await getStagedAssessmentMarkbook(
      batchId,
    );

  const allowed =
    await trainerCanAccessAssessment(
      staged.rootAssessmentId,
    );

  if (!allowed) {
    notFound();
  }

  const backHref =
    allocationId
      ? `/staff/units/${allocationId}/assessment/${staged.rootAssessmentId}`
      : '/staff/units';

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Staff · Markbook"
        title={
          staged.unitName
        }
        description={`${staged.academicPeriodName} · ${staged.assessmentType.toUpperCase()}`}
        icon={FileSpreadsheet}
        actions={
          <Link
            href={
              backHref
            }
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <ArrowLeft
              className="size-3.5"
              aria-hidden="true"
            />
            Assessment
          </Link>
        }
      />

      <section className="portal-metric-grid" data-columns="4">
        <MetricCard
          label="Rows"
          value={String(
            staged.totalRows,
          )}
          icon={FileSpreadsheet}
          status="Population"
        />

        <MetricCard
          label="Marks"
          value={String(
            staged.numericMarks,
          )}
          icon={FileSpreadsheet}
          status="Results"
        />

        <MetricCard
          label="Absent"
          value={String(
            staged.absences,
          )}
          icon={FileSpreadsheet}
          status="Attendance"
        />

        <MetricCard
          label="Missing"
          value={String(
            staged.missingMarks,
          )}
          icon={FileSpreadsheet}
          status="Validation"
        />
      </section>

      <section className="rounded-xl border border-border bg-white px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary">
                Import preview
              </h2>

              <Badge variant="neutral">
                {
                  staged.status
                }
              </Badge>
            </div>

            <p className="mt-1 text-[11px] text-text-muted">
              {
                staged.sourceFilename
              }
            </p>
          </div>

          <StaffCommitControl
            batchId={
              staged.id
            }
            allocationId={
              allocationId ??
              null
            }
            rootAssessmentId={
              staged.rootAssessmentId
            }
            status={
              staged.status
            }
            totalRows={
              staged.totalRows
            }
            missingMarks={
              staged.missingMarks
            }
          />
        </div>

        {staged.missingMarks >
        0 ? (
          <p className="mt-3 text-[11px] font-medium text-text-secondary">
            Correct missing marks in the
            workbook and upload it again.
          </p>
        ) : null}
      </section>

      <section className="space-y-1.5">
        {staged.rows.map(
          (
            row,
          ) => (
            <div
              key={
                row.id
              }
              className="grid gap-2 rounded-lg border border-border bg-white px-3.5 py-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(7rem,.7fr)_auto_minmax(4rem,.35fr)] sm:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-text-primary">
                  {
                    row.admissionNumber
                  }
                </p>

                <p className="mt-0.5 text-[10px] text-text-muted">
                  {
                    row.sheetName
                  }
                  {' · Row '}
                  {
                    row.workbookRow
                  }
                </p>
              </div>

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

              <p className="text-[11px] text-text-muted">
                {
                  row.attendanceStatus
                }
              </p>

              <p className="text-sm font-semibold text-text-primary sm:text-right">
                {row.resultStatus ===
                'absent'
                  ? 'AB'
                  : row.mark ??
                    '—'}
              </p>
            </div>
          ),
        )}
      </section>
    </div>
  );
}
