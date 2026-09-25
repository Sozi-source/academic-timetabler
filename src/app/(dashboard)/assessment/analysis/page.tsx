import type {
  Metadata,
} from 'next';
import Link from 'next/link';
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  UsersRound,
} from 'lucide-react';

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
  formatAssessmentMetric,
} from '@/features/assessment/analysis-engine';
import {
  getAssessmentAnalysisBundles,
} from '@/features/assessment/analysis-queries';

export const metadata: Metadata = {
  title:
    'Assessment Analysis',
  description:
    'Review CAT and Exam participation and performance from committed assessment results.',
};

function typeLabel(
  type:
    | 'cat'
    | 'exam',
): string {
  return type ===
    'cat'
    ? 'CAT'
    : 'Exam';
}

function statusLabel(
  value: string,
): string {
  return value
    .replace(
      /_/g,
      ' ',
    )
    .replace(
      /^./,
      (character) =>
        character.toUpperCase(),
    );
}

export default async function AssessmentAnalysisPage() {
  await requireHodAccess();

  const bundles =
    await getAssessmentAnalysisBundles();

  const totalRegistered =
    bundles.reduce(
      (
        total,
        bundle,
      ) =>
        total +
        bundle.summary.registered,
      0,
    );

  const totalSat =
    bundles.reduce(
      (
        total,
        bundle,
      ) =>
        total +
        bundle.summary.sat,
      0,
    );

  const totalAbsent =
    bundles.reduce(
      (
        total,
        bundle,
      ) =>
        total +
        bundle.summary.absent,
      0,
    );

  const analysed =
    bundles.filter(
      (bundle) =>
        bundle.summary.sat >
        0,
    ).length;

  return (
    <div className="admin-screen space-y-6">
      <PageHeader
        eyebrow="Assessment"
        title="CAT & Exam analysis"
        description="Participation and performance from committed assessment results."
        icon={BarChart3}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Assessment sets"
          value={String(
            bundles.length,
          )}
          description="Unit-level CAT and Exam groups"
          icon={ClipboardCheck}
          status="Total"
        />

        <MetricCard
          label="Analysed"
          value={String(
            analysed,
          )}
          description="Assessment sets with numeric marks"
          icon={BarChart3}
          status="Results"
        />

        <MetricCard
          label="Registered"
          value={String(
            totalRegistered,
          )}
          description="Locked assessment population"
          icon={UsersRound}
          status="Population"
        />

        <MetricCard
          label="Sat"
          value={String(
            totalSat,
          )}
          description={`${totalAbsent} explicit absence${totalAbsent === 1 ? '' : 's'}`}
          icon={CheckCircle2}
          status="Participation"
        />
      </section>

      {bundles.length ===
      0 ? (
        <section className="rounded-2xl border border-border bg-white px-5 py-12 text-center">
          <p className="text-sm font-semibold text-text-primary">
            No committed assessment
            analysis yet
          </p>

          <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-text-muted">
            CAT and Exam analysis appears
            after validated markbooks are
            committed.
          </p>
        </section>
      ) : (
        <section className="space-y-2">
          {bundles.map(
            (
              bundle,
            ) => (
              <Link
                key={
                  [
                    bundle.academicPeriodId,
                    bundle.unitId,
                    bundle.assessmentType,
                  ].join(
                    ':',
                  )
                }
                href={`/assessment/analysis/${bundle.rootAssessmentId}`}
                className="block rounded-xl border border-border bg-white px-4 py-3 transition hover:border-border-strong hover:bg-surface-subtle/40"
              >
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(8rem,.7fr)_repeat(5,minmax(5rem,.55fr))] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {
                          bundle.unitName
                        }
                      </p>

                      <Badge
                        variant="neutral"
                      >
                        {typeLabel(
                          bundle.assessmentType,
                        )}
                      </Badge>

                      {bundle.published ? (
                        <Badge variant="success">
                          Published
                        </Badge>
                      ) : null}
                    </div>

                    <p className="mt-1 text-[11px] text-text-muted">
                      {
                        bundle.academicPeriodName
                      }
                      {' · '}
                      {
                        bundle.cohortCount
                      } cohort{
                        bundle.cohortCount ===
                        1
                          ? ''
                          : 's'
                      }
                      {' · '}
                      {statusLabel(
                        bundle.status,
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                      Registered
                    </p>

                    <p className="mt-0.5 text-sm font-semibold text-text-primary">
                      {
                        bundle.summary.registered
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                      Sat
                    </p>

                    <p className="mt-0.5 text-sm font-semibold text-text-primary">
                      {
                        bundle.summary.sat
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                      Absent
                    </p>

                    <p className="mt-0.5 text-sm font-semibold text-text-primary">
                      {
                        bundle.summary.absent
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                      Missing
                    </p>

                    <p className="mt-0.5 text-sm font-semibold text-text-primary">
                      {
                        bundle.summary.missing
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                      Mean
                    </p>

                    <p className="mt-0.5 text-sm font-semibold text-text-primary">
                      {formatAssessmentMetric(
                        bundle.summary.mean,
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                      Pass rate
                    </p>

                    <p className="mt-0.5 text-sm font-semibold text-text-primary">
                      {bundle.summary.passRate ===
                      null
                        ? '—'
                        : `${formatAssessmentMetric(
                            bundle.summary.passRate,
                          )}%`}
                    </p>
                  </div>
                </div>
              </Link>
            ),
          )}
        </section>
      )}

      <p className="text-[11px] leading-5 text-text-muted">
        Means and pass rates use numeric
        marks only. Explicit absences and
        unresolved marks are excluded.
        Pass rate appears only when the
        assessment maximum and pass mark
        are configured.
      </p>
    </div>
  );
}