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
        <section className="space-y-2">
          {workspace.allocations.map(
            (
              allocation,
            ) => (
              <Link
                key={
                  allocation.allocationId
                }
                href={`/staff/units/${allocation.allocationId}`}
                className="block rounded-xl border border-border bg-white px-4 py-3 transition hover:border-border-strong hover:bg-surface-subtle/40"
              >
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(10rem,.8fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {
                        allocation.unitName
                      }
                    </p>

                    <p className="mt-1 text-[11px] text-text-muted">
                      {
                        allocation.cohortName
                      }
                      {' · '}
                      {
                        allocation.academicPeriodName
                      }
                    </p>
                  </div>

                  <p className="text-[11px] capitalize text-text-secondary">
                    {
                      allocation.allocationStatus
                    }
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {assessmentBadge(
                      'CAT',
                      allocation.cat
                        ?.workflowStatus ??
                        null,
                    )}

                    {assessmentBadge(
                      'Exam',
                      allocation.exam
                        ?.workflowStatus ??
                        null,
                    )}
                  </div>
                </div>
              </Link>
            ),
          )}
        </section>
      )}
    </div>
  );
}
