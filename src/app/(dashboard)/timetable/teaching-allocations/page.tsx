import type {
  Metadata,
} from 'next';
import {
  BookOpen,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Upload,
} from 'lucide-react';
import Link from 'next/link';

import {
  MetricCard,
} from '@/components/ui/metric-card';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  TeachingAllocationTable,
} from '@/features/teaching-allocations/teaching-allocation-table';
import {
  getTeachingAllocations,
} from '@/features/teaching-allocations/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Teaching Allocations',
  description:
    'Manage trainer, unit, cohort, room and Academic Period teaching assignments.',
};

export default async function TeachingAllocationsPage() {
  const allocations =
    await getTeachingAllocations();

  const activeAllocations =
    allocations.filter(
      (allocation) =>
        allocation.status === 'active',
    ).length;

  const draftAllocations =
    allocations.filter(
      (allocation) =>
        allocation.status === 'draft',
    ).length;

  const timetableEnabled =
    allocations.filter(
      (allocation) =>
        allocation.isTimetableEnabled,
    ).length;

  const totalWeeklyMinutes =
    allocations
      .filter(
        (allocation) =>
          allocation.status === 'draft' ||
          allocation.status === 'active',
      )
      .reduce(
        (total, allocation) =>
          total +
          allocation.weeklySessions *
            allocation.sessionDurationMinutes,
        0,
      );

  const totalWeeklyHours =
    totalWeeklyMinutes / 60;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Timetable preparation"
        title="Teaching allocations"
        description="Assign curriculum units to cohorts, trainers and preferred rooms before generating the institutional timetable."
        context={
          <div className="inline-flex items-center gap-2 text-sm text-text-muted">
            <CalendarCheck2
              className="size-4"
              aria-hidden="true"
            />

            {allocations.length}{' '}
            allocation
            {allocations.length === 1
              ? ''
              : 's'}{' '}
            registered
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/timetable/teaching-allocations/import"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
            >
              <Upload
                className="size-4"
                aria-hidden="true"
              />
              Import allocations
            </Link>
          </div>
        }
      />

      <section
        aria-label="Teaching Allocation metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="All allocations"
          value={String(
            allocations.length,
          )}
          description="Registered teaching requirements"
          icon={BookOpen}
          status="Total"
        />

        <MetricCard
          label="Active"
          value={String(
            activeAllocations,
          )}
          description="Confirmed for timetable generation"
          icon={CheckCircle2}
          status="Active"
        />

        <MetricCard
          label="Draft"
          value={String(
            draftAllocations,
          )}
          description="Awaiting final confirmation"
          icon={CalendarCheck2}
          status="Draft"
        />

        <MetricCard
          label="Weekly contact hours"
          value={
            Number.isInteger(
              totalWeeklyHours,
            )
              ? String(totalWeeklyHours)
              : totalWeeklyHours.toFixed(1)
          }
          description={`${timetableEnabled} timetable-enabled allocation${
            timetableEnabled === 1
              ? ''
              : 's'
          }`}
          icon={Clock3}
          status="Workload"
        />
      </section>

      {allocations.length > 0 &&
      timetableEnabled === 0 ? (
        <div className="rounded-2xl border border-warning-border bg-warning-surface px-5 py-4 text-sm leading-6 text-text-secondary">
          No teaching allocation is currently enabled
          for timetable generation. Activate or enable
          the required allocations before running the
          generator.
        </div>
      ) : null}

      <section
        aria-labelledby="allocation-register-title"
        className="space-y-4"
      >
        <div>
          <h2
            id="allocation-register-title"
            className="text-lg font-semibold text-text-primary"
          >
            Allocation register
          </h2>

          <p className="mt-1 text-sm text-text-muted">
            Review unit ownership, trainer workload,
            delivery requirements and timetable
            readiness.
          </p>
        </div>

        <TeachingAllocationTable
          allocations={allocations}
        />
      </section>
    </div>
  );
}