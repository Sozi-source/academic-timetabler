import {
  BookOpenCheck,
  ClipboardCheck,
  GraduationCap,
} from 'lucide-react';
import Link from 'next/link';

import {
  MetricCard,
} from '@/components/ui/metric-card';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  getStaffWorkspace,
} from '@/features/staff-assessment/queries';

export default async function StaffHomePage() {
  const profile =
    await requireTrainerAccess();

  const workspace =
    await getStaffWorkspace(
      profile.id,
    );

  const assessmentCount =
    workspace.allocations.reduce(
      (
        total,
        allocation,
      ) =>
        total +
        (
          allocation.cat
            ? 1
            : 0
        ) +
        (
          allocation.exam
            ? 1
            : 0
        ),
      0,
    );

  const published =
    workspace.allocations.reduce(
      (
        total,
        allocation,
      ) =>
        total +
        (
          allocation.cat
            ?.published
            ? 1
            : 0
        ) +
        (
          allocation.exam
            ?.published
            ? 1
            : 0
        ),
      0,
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Staff"
        title="Teaching workspace"
        description="Your allocated units and assessments."
        icon={GraduationCap}
        actions={
          <Link
            href="/staff/units"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-header-blue px-3.5 text-xs font-semibold text-white transition hover:opacity-90"
          >
            My Units
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Allocated units"
          value={String(
            workspace.allocations.length,
          )}
          description="Active and completed Teaching Allocations"
          icon={BookOpenCheck}
          status="My Units"
        />

        <MetricCard
          label="Assessments"
          value={String(
            assessmentCount,
          )}
          description="CAT and Exam assessment sets"
          icon={ClipboardCheck}
          status="Assessment"
        />

        <MetricCard
          label="Published"
          value={String(
            published,
          )}
          description="Assessment sets released"
          icon={GraduationCap}
          status="Results"
        />
      </section>

      <section className="rounded-xl border border-border bg-white px-4 py-4">
        <h2 className="text-sm font-semibold text-text-primary">
          {
            workspace.trainerName
          }
        </h2>

        <p className="mt-1 text-[11px] leading-5 text-text-muted">
          Access is derived from your
          Teaching Allocations. Units and
          assessments not allocated to
          you are not exposed here.
        </p>
      </section>
    </div>
  );
}
