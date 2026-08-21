import type {
  Metadata,
} from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  CircleMinus,
  Sigma,
  UsersRound,
} from 'lucide-react';
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
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  AssessmentRuleReleaseControls,
} from '@/features/assessment/assessment-rule-release-controls';
import {
  formatAssessmentMetric,
} from '@/features/assessment/analysis-engine';
import {
  getAssessmentAnalysisDetail,
} from '@/features/assessment/analysis-queries';

export const metadata: Metadata = {
  title:
    'Assessment Analysis',
  description:
    'Review unit-level CAT or Exam participation and performance.',
};

interface PageProps {
  params: Promise<{
    assessmentId: string;
  }>;
}

function resultLabel(
  status: string,
): string {
  if (
    status ===
    'sat'
  ) {
    return 'Sat';
  }

  if (
    status ===
    'absent'
  ) {
    return 'Absent';
  }

  if (
    status ===
      'missing_mark' ||
    status ===
      'pending'
  ) {
    return 'Missing';
  }

  return status;
}

export default async function AssessmentAnalysisDetailPage({
  params,
}: PageProps) {
  await requireHodAccess();

  const {
    assessmentId,
  } = await params;

  const analysis =
    await getAssessmentAnalysisDetail(
      assessmentId,
    );

  if (!analysis) {
    notFound();
  }

  const typeLabel =
    analysis.assessmentType ===
    'cat'
      ? 'CAT'
      : 'Exam';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Assessment · ${typeLabel}`}
        title={
          analysis.unitName
        }
        description={analysis.academicPeriodName}
        icon={BarChart3}
        actions={
          <Link
            href="/assessment/analysis"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <ArrowLeft
              className="size-3.5"
              aria-hidden="true"
            />
            Analysis
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Registered"
          value={String(
            analysis.summary.registered,
          )}
          description={`${analysis.cohorts.length} participating cohort${analysis.cohorts.length === 1 ? '' : 's'}`}
          icon={UsersRound}
          status="Population"
        />

        <MetricCard
          label="Sat"
          value={String(
            analysis.summary.sat,
          )}
          description="Numeric results recorded"
          icon={CheckCircle2}
          status="Results"
        />

        <MetricCard
          label="Absent"
          value={String(
            analysis.summary.absent,
          )}
          description={`${analysis.summary.missing} missing mark${analysis.summary.missing === 1 ? '' : 's'}`}
          icon={CircleMinus}
          status="Attendance"
        />

        <MetricCard
          label="Mean mark"
          value={formatAssessmentMetric(
            analysis.summary.mean,
          )}
          description={
            analysis.maximumMark ===
            null
              ? 'Absent and missing excluded'
              : `Out of ${formatAssessmentMetric(
                  analysis.maximumMark,
                )}`
          }
          icon={Sigma}
          status="Performance"
        />

        <MetricCard
          label="Pass rate"
          value={
            analysis.summary.passRate ===
            null
              ? '—'
              : `${formatAssessmentMetric(
                  analysis.summary.passRate,
                )}%`
          }
          description={
            analysis.passMark ===
            null
              ? 'Configure assessment rule'
              : `Pass mark ${formatAssessmentMetric(
                  analysis.passMark,
                )}`
          }
          icon={BarChart3}
          status="Threshold"
        />
      </section>

      <AssessmentRuleReleaseControls
        assessmentId={
          analysis.rootAssessmentId
        }
        maximumMark={
          analysis.maximumMark
        }
        passMark={
          analysis.passMark
        }
        workflowStatus={
          analysis.status
        }
        published={
          analysis.published
        }
      />

      <section className="rounded-xl border border-border bg-white px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Performance summary
            </h2>

            <p className="mt-1 text-[11px] text-text-muted">
              Numeric marks only
            </p>
          </div>

          <Badge variant="neutral">
            {
              analysis.status
            }
          </Badge>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-lg border border-border bg-surface-subtle/40 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              Lowest
            </p>

            <p className="mt-1 text-lg font-semibold text-text-primary">
              {formatAssessmentMetric(
                analysis.summary.minimum,
              )}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface-subtle/40 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              Median
            </p>

            <p className="mt-1 text-lg font-semibold text-text-primary">
              {formatAssessmentMetric(
                analysis.summary.median,
              )}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface-subtle/40 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              Highest
            </p>

            <p className="mt-1 text-lg font-semibold text-text-primary">
              {formatAssessmentMetric(
                analysis.summary.maximum,
              )}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface-subtle/40 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              Passed
            </p>

            <p className="mt-1 text-lg font-semibold text-text-primary">
              {analysis.summary.passed ??
                '—'}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface-subtle/40 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              Failed
            </p>

            <p className="mt-1 text-lg font-semibold text-text-primary">
              {analysis.summary.failed ??
                '—'}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Cohort breakdown
          </h2>

          <p className="mt-1 text-[11px] text-text-muted">
            Participation and mean mark by
            participating cohort.
          </p>
        </div>

        <div className="space-y-2">
          {analysis.cohorts.map(
            (
              cohort,
            ) => (
              <div
                key={
                  cohort.cohortId ??
                  cohort.cohortName
                }
                className="grid gap-3 rounded-xl border border-border bg-white px-4 py-3 sm:grid-cols-[minmax(0,1.5fr)_repeat(5,minmax(4rem,.55fr))] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {
                      cohort.cohortName
                    }
                  </p>
                </div>

                {[
                  [
                    'Registered',
                    String(
                      cohort.summary.registered,
                    ),
                  ],
                  [
                    'Sat',
                    String(
                      cohort.summary.sat,
                    ),
                  ],
                  [
                    'Absent',
                    String(
                      cohort.summary.absent,
                    ),
                  ],
                  [
                    'Missing',
                    String(
                      cohort.summary.missing,
                    ),
                  ],
                  [
                    'Mean',
                    formatAssessmentMetric(
                      cohort.summary.mean,
                    ),
                  ],
                ].map(
                  ([
                    label,
                    value,
                  ]) => (
                    <div
                      key={
                        label
                      }
                    >
                      <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                        {
                          label
                        }
                      </p>

                      <p className="mt-0.5 text-xs font-semibold text-text-primary">
                        {
                          value
                        }
                      </p>
                    </div>
                  ),
                )}
              </div>
            ),
          )}
        </div>
      </section>

      <section className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Student results
          </h2>

          <p className="mt-1 text-[11px] text-text-muted">
            Locked roster matched to
            committed results.
          </p>
        </div>

        <div className="space-y-1.5">
          {analysis.students.map(
            (
              student,
            ) => (
              <div
                key={
                  student.studentId
                }
                className="grid gap-2 rounded-lg border border-border bg-white px-3.5 py-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(7rem,.8fr)_minmax(7rem,.8fr)_minmax(5rem,.5fr)_minmax(4rem,.4fr)] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-text-primary">
                    {
                      student.fullName
                    }
                  </p>

                  <p className="mt-0.5 text-[10px] text-text-muted">
                    {
                      student.admissionNumber
                    }
                  </p>
                </div>

                <p className="truncate text-[11px] text-text-secondary">
                  {
                    student.cohortName
                  }
                </p>

                <div>
                  <Badge
                    variant={
                      student.status ===
                      'sat'
                        ? 'success'
                        : 'neutral'
                    }
                  >
                    {resultLabel(
                      student.status,
                    )}
                  </Badge>
                </div>

                <p className="text-[11px] text-text-muted">
                  {student.status ===
                  'absent'
                    ? 'AB'
                    : student.status ===
                        'missing_mark' ||
                      student.status ===
                        'pending'
                      ? '—'
                      : 'Mark'}
                </p>

                <p className="text-sm font-semibold text-text-primary sm:text-right">
                  {student.status ===
                  'absent'
                    ? 'AB'
                    : formatAssessmentMetric(
                        student.mark,
                      )}
                </p>
              </div>
            ),
          )}
        </div>
      </section>

      <p className="text-[11px] leading-5 text-text-muted">
        Pass/fail uses the configured
        assessment rule and numeric marks
        only. Publishing is separate from
        finalisation so results remain
        controlled until explicitly
        released.
      </p>
    </div>
  );
}