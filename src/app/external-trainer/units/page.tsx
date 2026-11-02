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
    <div className="space-y-4 sm:space-y-5">
      {/* Sleek, understated header - replaces the previous bulky card */}
      <header className="flex items-center justify-between gap-3 px-1 py-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#1c3a34] sm:text-2xl">
            My Units
          </h1>
          <p className="mt-0.5 text-xs text-[#5c726c]">
            Select a unit markbook to enter or review marks
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#ded8cc] bg-white/80 px-3 py-1 shadow-2xs backdrop-blur-xs">
          <span className="size-2 rounded-full bg-[#00756a]" aria-hidden="true" />
          <span className="text-xs font-semibold text-[#1c3a34]">
            {allocations.length} {allocations.length === 1 ? 'class' : 'classes'}
          </span>
        </div>
      </header>

      {allocations.length === 0 ? (
        <section className="rounded-2xl border border-[#e8e4dc] bg-white px-5 py-12 text-center shadow-xs sm:px-8">
          <BookOpenCheck className="mx-auto size-9 text-[#879691]" aria-hidden="true" />
          <h2 className="mt-4 text-base font-bold text-[#1c3a34]">No units assigned</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#5c726c]">
            Units will appear here after the department assigns your teaching allocation.
          </p>
        </section>
      ) : (
        <section aria-label="Assigned units" className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {allocations.map((allocation) => (
            <Link
              key={allocation.allocationId}
              href={`/external-trainer/units/${allocation.allocationId}/assessment/${allocation.exam?.assessmentId ?? 'exam'}/marks`}
              className="group relative flex min-h-32 items-center justify-between gap-4 overflow-hidden rounded-2xl border border-[#dce7e4] bg-white p-4 text-[#173b35] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#8bb8af] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] sm:min-h-36 sm:p-5"
            >
              <span className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-[#0f766e]" aria-hidden="true" />
              <div className="min-w-0 flex-1 pl-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#e8f4f2] text-[#0f766e]">
                    <GraduationCap className="size-4" aria-hidden="true" />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#0f766e]">
                    {allocation.unitCode}
                  </span>
                  {allocation.exam?.trainerEntryOpen ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">
                      <span className="size-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
                      Entry open
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                      <span className="size-1.5 rounded-full bg-slate-400" aria-hidden="true" />
                      Entry locked
                    </span>
                  )}
                </div>
                <h2 className="mt-2.5 text-base font-bold leading-snug tracking-tight text-[#173b35] sm:text-lg">
                  {allocation.unitName}
                </h2>
                <p className="mt-1 text-xs font-medium text-[#60736e]">
                  {allocation.cohortName}
                </p>
              </div>

              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0f766e] px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs transition duration-150 group-hover:bg-[#0b625b] group-hover:shadow-sm active:scale-[0.98]">
                <span>Enter marks</span>
                <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
