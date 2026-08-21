import {
  ArrowLeft,
  BookOpenCheck,
} from 'lucide-react';
import Link from 'next/link';
import {
  notFound,
} from 'next/navigation';

import {
  Badge,
} from '@/components/ui/badge';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  requireStaffAllocation,
} from '@/features/staff-assessment/queries';
import type {
  StaffAssessmentSummary,
} from '@/features/staff-assessment/types';

interface PageProps {
  params: Promise<{
    allocationId: string;
  }>;
}

function AssessmentCard({
  allocationId,
  assessment,
  type,
}: {
  allocationId: string;
  assessment: StaffAssessmentSummary | null;
  type:
    | 'CAT'
    | 'Exam';
}) {
  if (!assessment) {
    return (
      <article className="rounded-xl border border-border bg-white px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-text-primary">
            {
              type
            }
          </h2>

          <Badge variant="neutral">
            Not created
          </Badge>
        </div>

        <p className="mt-2 text-[11px] text-text-muted">
          No assessment event is
          currently available.
        </p>
      </article>
    );
  }

  return (
    <Link
      href={`/staff/units/${allocationId}/assessment/${assessment.assessmentId}`}
      className="block rounded-xl border border-border bg-white px-4 py-4 transition hover:border-border-strong hover:bg-surface-subtle/40"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">
          {
            type
          }
        </h2>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="neutral">
            {
              assessment.workflowStatus
            }
          </Badge>

          {assessment.published ? (
            <Badge variant="success">
              Published
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Registered
          </p>

          <p className="mt-1 text-sm font-semibold text-text-primary">
            {
              assessment.registered
            }
          </p>
        </div>

        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Absent
          </p>

          <p className="mt-1 text-sm font-semibold text-text-primary">
            {
              assessment.absent
            }
          </p>
        </div>

        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Maximum
          </p>

          <p className="mt-1 text-sm font-semibold text-text-primary">
            {
              assessment.maximumMark ??
              '—'
            }
          </p>
        </div>
      </div>
    </Link>
  );
}

export default async function StaffUnitPage({
  params,
}: PageProps) {
  const profile =
    await requireTrainerAccess();

  const {
    allocationId,
  } = await params;

  const context =
    await requireStaffAllocation({
      profileId:
        profile.id,
      allocationId,
    });

  if (!context) {
    notFound();
  }

  const {
    allocation,
  } = context;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="My Units"
        title={
          allocation.unitName
        }
        description={`${allocation.cohortName} · ${allocation.academicPeriodName}`}
        icon={BookOpenCheck}
        actions={
          <Link
            href="/staff/units"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <ArrowLeft
              className="size-3.5"
              aria-hidden="true"
            />
            My Units
          </Link>
        }
      />

      <section className="grid gap-3 lg:grid-cols-2">
        <AssessmentCard
          allocationId={
            allocation.allocationId
          }
          assessment={
            allocation.cat
          }
          type="CAT"
        />

        <AssessmentCard
          allocationId={
            allocation.allocationId
          }
          assessment={
            allocation.exam
          }
          type="Exam"
        />
      </section>

      <Link
        href={`/staff/attendance?allocationId=${allocation.allocationId}`}
        className="block rounded-xl border border-border bg-white px-4 py-4 transition hover:border-border-strong hover:bg-surface-subtle/40"
      >
        <p className="text-sm font-semibold text-text-primary">
          Class Attendance
        </p>

        <p className="mt-1 text-[11px] leading-5 text-text-muted">
          Present or absent attendance
          from the published timetable.
        </p>
      </Link>

      <Link
        href={`/staff/units/${allocation.allocationId}/documents`}
        className="block rounded-xl border border-border bg-white px-4 py-4 transition hover:border-border-strong hover:bg-surface-subtle/40"
      >
        <p className="text-sm font-semibold text-text-primary">
          Teaching Documents
        </p>

        <p className="mt-1 text-[11px] leading-5 text-text-muted">
          Attendance sheet, course
          outline, scheme of work and
          record of work.
        </p>
      </Link>
    </div>
  );
}
