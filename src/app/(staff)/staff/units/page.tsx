import {
  BookOpenCheck,
} from 'lucide-react';
import Link from 'next/link';

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
  getStaffWorkspace,
} from '@/features/staff-assessment/queries';
import type { StaffUnitAllocation } from '@/features/staff-assessment/types';

type GroupedUnit = StaffUnitAllocation & {
  cohortNames: string[];
  allocations: StaffUnitAllocation[];
};

function groupAllocationsByUnit(
  allocations: StaffUnitAllocation[],
): GroupedUnit[] {
  const groups = new Map<string, GroupedUnit>();

  for (const allocation of allocations) {
    const normalizedName = allocation.unitName
      .trim()
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const key = `${allocation.academicPeriodId}:${normalizedName}`;
    const existing = groups.get(key);

    if (existing) {
      existing.allocations.push(allocation);
      if (!existing.cohortNames.includes(allocation.cohortName)) {
        existing.cohortNames.push(allocation.cohortName);
      }
      continue;
    }

    groups.set(key, {
      ...allocation,
      cohortNames: [allocation.cohortName],
      allocations: [allocation],
    });
  }

  return [...groups.values()];
}

function groupedAssessmentStatus(
  allocations: StaffUnitAllocation[],
  type: 'cat' | 'exam',
): string | null {
  const statuses = allocations.map((allocation) =>
    allocation[type]?.workflowStatus ?? null,
  );
  const unique = new Set(statuses);
  return unique.size === 1 ? statuses[0] : 'Mixed';
}

function assessmentBadge(
  label: string,
  status:
    | string
    | null,
) {
  return (
    <Badge
      variant={
        status ===
        'finalised' ||
        status ===
        'submitted'
          ? 'success'
          : 'neutral'
      }
    >
      {label}: {
        status ??
        'Not created'
      }
    </Badge>
  );
}

export default async function StaffUnitsPage() {
  const profile =
    await requireTrainerAccess();

  const workspace =
    await getStaffWorkspace(
      profile.id,
    );
  const groupedUnits = groupAllocationsByUnit(workspace.allocations);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Staff"
        title="My Units"
        description="Teaching Allocations assigned to you."
        icon={BookOpenCheck}
      />

      {workspace.allocations.length ===
      0 ? (
        <section className="rounded-xl border border-border bg-white px-5 py-10 text-center">
          <p className="text-sm font-semibold text-text-primary">
            No allocated units
          </p>

          <p className="mt-1 text-xs text-text-muted">
            Your active Teaching
            Allocations will appear here.
          </p>
        </section>
      ) : (
        <section className="space-y-3">
          {groupedUnits.map((allocation) => (
            <Link
              key={allocation.allocationId}
              href={`/staff/units/${allocation.allocationId}`}
              className="block rounded-xl border border-border border-l-4 border-l-primary bg-surface px-5 py-4 shadow-xs transition hover:border-l-institutional-yellow hover:border-border-strong hover:bg-primary-subtle hover:shadow-sm"
            >
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(10rem,.8fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">
                    {allocation.unitName}
                  </p>

                  <p className="mt-1 text-[11px] font-bold text-slate-500">
                    {allocation.cohortNames.join(' + ')}
                    {' · '}
                    <span className="text-primary">{allocation.academicPeriodName}</span>
                  </p>
                </div>

                <p className="text-xs font-black capitalize text-slate-700">
                  <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 border border-slate-200">
                    {allocation.allocationStatus}
                  </span>
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {assessmentBadge(
                    'CAT',
                    groupedAssessmentStatus(allocation.allocations, 'cat'),
                  )}

                  {assessmentBadge(
                    'Exam',
                    groupedAssessmentStatus(allocation.allocations, 'exam'),
                  )}
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
