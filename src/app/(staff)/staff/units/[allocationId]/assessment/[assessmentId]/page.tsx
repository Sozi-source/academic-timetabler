import {
  ArrowLeft,
  BarChart3,
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
  formatAssessmentMetric,
} from '@/features/assessment/analysis-engine';
import {
  getAssessmentAnalysisDetail,
} from '@/features/assessment/analysis-queries';
import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  requireStaffAssessment,
} from '@/features/staff-assessment/queries';

interface PageProps {
  params: Promise<{
    allocationId: string;
    assessmentId: string;
  }>;
}

export default async function StaffAssessmentPage({
  params,
}: PageProps) {
  const profile =
    await requireTrainerAccess();

  const {
    allocationId,
    assessmentId,
  } = await params;

  const access =
    await requireStaffAssessment({
      profileId:
        profile.id,
      allocationId,
      assessmentId,
    });

  if (!access) {
    notFound();
  }

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
    <div className="space-y-5">
      <PageHeader
        eyebrow={`My Units · ${typeLabel}`}
        title={
          analysis.unitName
        }
        description={`${access.allocation.cohortName} · ${analysis.academicPeriodName}`}
        icon={BarChart3}
        actions={
          <Link
            href={`/staff/units/${allocationId}`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <ArrowLeft
              className="size-3.5"
              aria-hidden="true"
            />
            Unit
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Registered"
          value={String(
            analysis.summary.registered,
          )}
          description="Locked assessment population"
          icon={BarChart3}
          status="Population"
        />

        <MetricCard
          label="Sat"
          value={String(
            analysis.summary.sat,
          )}
          description="Numeric marks recorded"
          icon={BarChart3}
          status="Results"
        />

        <MetricCard
          label="Absent"
          value={String(
            analysis.summary.absent,
          )}
          description={`${analysis.summary.missing} missing`}
          icon={BarChart3}
          status="Attendance"
        />

        <MetricCard
          label="Mean"
          value={formatAssessmentMetric(
            analysis.summary.mean,
          )}
          description={
            analysis.summary.passRate ===
            null
              ? 'Pass rule not configured'
              : `${formatAssessmentMetric(
                  analysis.summary.passRate,
                )}% pass rate`
          }
          icon={BarChart3}
          status="Performance"
        />
      </section>

      <section className="space-y-1.5">
        {analysis.students.map(
          (
            student,
          ) => (
            <div
              key={
                student.studentId
              }
              className="grid gap-2 rounded-lg border border-border bg-white px-3.5 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(7rem,.7fr)_auto_minmax(4rem,.35fr)] sm:items-center"
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

              <Badge
                variant={
                  student.status ===
                  'sat'
                    ? 'success'
                    : 'neutral'
                }
              >
                {student.status ===
                'missing_mark'
                  ? 'Missing'
                  : student.status}
              </Badge>

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
      </section>
    </div>
  );
}
