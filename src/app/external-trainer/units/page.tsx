import { ArrowUpRight, BookOpenCheck, ChevronRight, GraduationCap } from 'lucide-react';
import Link from 'next/link';

import { getAuthenticatedProfile } from '@/features/auth/queries';
import { getStaffWorkspace } from '@/features/staff-assessment/queries';

export default async function ExternalTrainerUnitsPage() {
  const profile = await getAuthenticatedProfile();
  if (!profile) return null;

  const workspace = await getStaffWorkspace(profile.id);
  const allocations = workspace.allocations;

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-border/80 bg-white p-5 shadow-xs sm:p-7 lg:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Teaching workspace</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">My Units</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-text-muted">Choose a unit and cohort to enter or submit marks.</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-primary-subtle px-4 py-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-white text-primary shadow-xs">
            <BookOpenCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-bold leading-5 text-text-primary">{allocations.length}</p>
            <p className="mt-1 text-[11px] font-medium text-text-muted">Assigned {allocations.length === 1 ? 'class' : 'classes'}</p>
          </div>
        </div>
      </header>

      {allocations.length === 0 ? (
        <section className="rounded-2xl border border-border bg-white px-5 py-14 text-center shadow-xs sm:px-8">
          <BookOpenCheck className="mx-auto size-9 text-text-muted" aria-hidden="true" />
          <h2 className="mt-4 text-base font-bold text-text-primary">No units assigned</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-muted">
            Units will appear here after the department assigns your teaching allocation.
          </p>
        </section>
      ) : (
        <section aria-label="Assigned units" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:gap-5">
          {allocations.map((allocation) => (
            <Link
              key={allocation.allocationId}
              href={`/external-trainer/units/${allocation.allocationId}/assessment/${allocation.exam?.assessmentId ?? 'exam'}/marks`}
              className="group flex min-h-64 flex-col rounded-2xl border border-border/80 bg-white p-5 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-72 sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex size-12 items-center justify-center rounded-xl bg-primary-subtle text-primary transition group-hover:bg-primary group-hover:text-white">
                  <GraduationCap className="size-5" aria-hidden="true" />
                </span>
                <span className="flex size-9 items-center justify-center rounded-full border border-border text-text-muted transition group-hover:border-primary/20 group-hover:bg-primary-subtle group-hover:text-primary">
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-5 min-w-0">
                <p className="text-xs font-bold tracking-wide text-primary">
                  {allocation.unitCode}
                </p>
                <h2 className="mt-2 text-lg font-bold leading-snug text-text-primary sm:text-xl">{allocation.unitName}</h2>
                <p className="mt-2 text-sm text-text-muted">{allocation.cohortName}</p>
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-border/70 pt-4 sm:mt-6">
                <p className="text-sm font-semibold text-text-primary">Enter marks</p>
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-white transition group-hover:translate-x-0.5 group-hover:bg-primary-hover">
                  <ChevronRight className="size-4" aria-hidden="true" />
                </span>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
