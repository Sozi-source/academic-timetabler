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
        <section aria-label="Assigned units" className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {allocations.map((allocation) => (
            <Link
              key={allocation.allocationId}
              href={`/external-trainer/units/${allocation.allocationId}/assessment/${allocation.exam?.assessmentId ?? 'exam'}/marks`}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#004e46]/30 bg-gradient-to-br from-[#006e63] via-[#005e54] to-[#004e46] p-4 text-white shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-[#004e46]/50 hover:shadow-lg sm:p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-lg bg-white/15 text-teal-100 backdrop-blur-xs">
                      <GraduationCap className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-200">
                      {allocation.unitCode}
                    </span>
                    {allocation.exam?.trainerEntryOpen ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-100 ring-1 ring-emerald-400/35">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                        Entry open
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold text-teal-100/90 ring-1 ring-white/20">
                        <span className="size-1.5 rounded-full bg-amber-400" aria-hidden="true" />
                        Entry locked
                      </span>
                    )}
                  </div>
                  <h2
                    className="unit-card-title mt-2 text-base font-bold leading-snug !text-white sm:text-lg"
                    style={{ color: '#ffffff' }}
                  >
                    {allocation.unitName}
                  </h2>
                  <p className="mt-1 text-xs font-medium text-teal-100/85">
                    {allocation.cohortName}
                  </p>
                </div>

                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-[#005e54] shadow-xs transition duration-150 group-hover:bg-[#f0faf7] group-hover:scale-[1.02] group-hover:shadow-md active:scale-95">
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
