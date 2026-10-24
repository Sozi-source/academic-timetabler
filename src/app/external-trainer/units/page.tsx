import { BookOpenCheck, ChevronRight, GraduationCap } from 'lucide-react';
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
        <section aria-label="Assigned units" className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {allocations.map((allocation) => (
            <Link
              key={allocation.allocationId}
              href={`/external-trainer/units/${allocation.allocationId}/assessment/${allocation.exam?.assessmentId ?? 'exam'}/marks`}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#005f54] via-[#006e62] to-[#004d44] p-4 text-white shadow-xs ring-1 ring-white/10 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:ring-white/25 sm:p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-lg bg-white/15 text-teal-100 backdrop-blur-xs">
                      <GraduationCap className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-teal-200">
                      {allocation.unitCode}
                    </span>
                  </div>
                  <h2 className="mt-2 text-base font-bold leading-snug text-white sm:text-lg">
                    {allocation.unitName}
                  </h2>
                  <p className="mt-1 text-xs font-medium text-teal-100/75">
                    {allocation.cohortName}
                  </p>
                </div>

                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#005247] shadow-xs transition duration-150 group-hover:bg-teal-50 group-hover:shadow-md group-hover:scale-[1.02] active:scale-95">
                  <span>Enter marks</span>
                  <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
