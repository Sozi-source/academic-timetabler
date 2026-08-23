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
          {workspace.allocations.map((allocation) => (
            <Link
              key={allocation.allocationId}
              href={`/staff/units/${allocation.allocationId}`}
              className="block rounded-xl border border-slate-200 border-l-4 border-l-teal-800 bg-white px-5 py-4 shadow-xs transition hover:border-l-amber-400 hover:border-slate-300 hover:bg-teal-50/20 hover:shadow-sm"
            >
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(10rem,.8fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">
                    {allocation.unitName}
                  </p>

                  <p className="mt-1 text-[11px] font-bold text-slate-500">
                    {allocation.cohortName}
                    {' · '}
                    <span className="text-teal-800">{allocation.academicPeriodName}</span>
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
                    allocation.cat?.workflowStatus ?? null,
                  )}

                  {assessmentBadge(
                    'Exam',
                    allocation.exam?.workflowStatus ?? null,
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
