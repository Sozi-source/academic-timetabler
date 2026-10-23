import { BookOpenCheck, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { getAuthenticatedProfile } from '@/features/auth/queries';
import { getStaffWorkspace } from '@/features/staff-assessment/queries';
import { groupStaffUnitAllocations } from '@/features/staff-assessment/unit-grouping';

export default async function ExternalTrainerUnitsPage() {
  const profile = await getAuthenticatedProfile();
  if (!profile) return null;

  const workspace = await getStaffWorkspace(profile.id);
  const units = groupStaffUnitAllocations(workspace.allocations);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Teaching</p>
          <h1 className="mt-1 text-xl font-bold text-text-primary">My Units</h1>
          <p className="mt-1 text-sm text-text-muted">Open a unit to enter or submit marks.</p>
        </div>
        <span className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-text-secondary">
          {units.length} assigned {units.length === 1 ? 'unit' : 'units'}
        </span>
      </header>

      {units.length === 0 ? (
        <section className="rounded-xl border border-border bg-white px-5 py-12 text-center shadow-xs">
          <BookOpenCheck className="mx-auto size-8 text-text-muted" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-bold text-text-primary">No units assigned</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-text-muted">
            Units will appear here after the department assigns your teaching allocation.
          </p>
        </section>
      ) : (
        <section aria-label="Assigned units" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {units.map((unit) => (
            <Link
              key={unit.primaryAllocationId}
              href={`/external-trainer/units/${unit.primaryAllocationId}`}
              className="group rounded-xl border border-border bg-white p-4 shadow-xs transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-text-muted">{unit.unitCode} · {unit.academicPeriodName}</p>
                  <h2 className="mt-1 text-sm font-bold text-text-primary">{unit.unitName}</h2>
                </div>
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {unit.cohortNames.map((cohort) => (
                  <span key={cohort} className="rounded-md bg-surface-subtle px-2 py-1 text-[10px] font-semibold text-text-secondary">
                    {cohort}
                  </span>
                ))}
              </div>
              <p className="mt-4 border-t border-border pt-3 text-xs font-semibold text-primary">Open marks entry</p>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
