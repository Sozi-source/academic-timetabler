import {
  BookOpenCheck,
} from 'lucide-react';
import Link from 'next/link';

import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  getStaffWorkspace,
} from '@/features/staff-assessment/queries';
import { groupStaffUnitAllocations } from '@/features/staff-assessment/unit-grouping';

export default async function StaffUnitsPage() {
  const profile = await requireTrainerAccess();

  const workspace = await getStaffWorkspace(profile.id);
  const groupedUnits = groupStaffUnitAllocations(workspace.allocations);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Staff"
        title="My Units"
        description="Your teaching allocations."
        icon={BookOpenCheck}
      />

      {workspace.allocations.length === 0 ? (
        <section className="rounded-xl border border-border bg-white px-5 py-12 text-center">
          <BookOpenCheck className="mx-auto size-8 text-text-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-text-primary">
            No allocated units
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-text-muted">
            Your active teaching allocations will appear here once assigned by the department.
          </p>
        </section>
      ) : (
        <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {groupedUnits.map((allocation) => (
            <Link
              key={allocation.primaryAllocationId || allocation.allocationId}
              href={`/staff/units/${allocation.primaryAllocationId || allocation.allocationId}`}
              className="flex flex-col justify-between rounded-xl border border-border border-l-4 border-l-primary bg-surface p-4 shadow-xs transition hover:border-l-institutional-yellow hover:border-border-strong hover:bg-primary-subtle hover:shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-black text-slate-950">
                    {allocation.unitName}
                  </p>
                  <span className="shrink-0 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-black capitalize text-slate-700 border border-slate-200">
                    {allocation.allocationStatus}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {allocation.cohortNames.map((cohort) => (
                    <span
                      key={cohort}
                      className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-700 border border-slate-200"
                    >
                      {cohort}
                    </span>
                  ))}
                  {allocation.cohortNames.length > 1 && (
                    <span className="text-[10px] font-bold text-primary bg-primary-subtle px-1.5 py-0.5 rounded border border-primary/20">
                      Combined ({allocation.cohortNames.length})
                    </span>
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
