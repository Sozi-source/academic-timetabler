import { ArrowDownToLine, ClipboardCheck, FileText } from 'lucide-react';

import { getAuthenticatedProfile } from '@/features/auth/queries';
import { getStaffWorkspace } from '@/features/staff-assessment/queries';
import { groupStaffUnitAllocations } from '@/features/staff-assessment/unit-grouping';

const attendanceRegisters = [
  { type: 'class', label: 'Class attendance', detail: 'Teaching sessions' },
  { type: 'cat', label: 'CAT attendance', detail: 'Continuous assessment' },
  { type: 'exam', label: 'Exam attendance', detail: 'Examination session' },
] as const;

export default async function ExternalTrainerDocumentsPage() {
  const profile = await getAuthenticatedProfile();
  if (!profile) return null;

  const workspace = await getStaffWorkspace(profile.id);
  const units = groupStaffUnitAllocations(workspace.allocations);

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="px-1">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">Attendance registers</h1>
      </header>

      {units.length === 0 ? (
        <section className="rounded-2xl border border-border bg-white px-5 py-14 text-center shadow-xs sm:px-8">
          <FileText className="mx-auto size-9 text-text-muted" aria-hidden="true" />
          <h2 className="mt-4 text-base font-bold text-text-primary">No registers available</h2>
          <p className="mt-2 text-sm text-text-muted">Registers will appear here when teaching units are assigned.</p>
        </section>
      ) : (
        <section aria-label="Unit attendance registers" className="grid gap-4 xl:grid-cols-2 2xl:gap-5">
          {units.map((unit) => (
            <article key={unit.primaryAllocationId} className="overflow-hidden rounded-2xl border border-border/80 bg-white shadow-xs">
              <header className="flex items-start gap-3 border-b border-border/70 bg-surface-subtle/70 p-5 sm:p-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-xs">
                  <ClipboardCheck className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold tracking-wide text-primary">{unit.unitCode}</p>
                  <h2 className="mt-1 text-base font-bold leading-snug text-text-primary sm:text-lg">{unit.unitName}</h2>
                </div>
              </header>
              <div className="space-y-4 p-4 sm:p-5">
                {unit.allAllocationIds.map((allocationId, index) => (
                  <section key={allocationId} aria-label={`Registers for ${unit.cohortNames[index] ?? unit.cohortName}`} className="rounded-xl border border-border/70 p-4 sm:p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                      <h3 className="text-sm font-bold text-text-primary">{unit.cohortNames[index] ?? unit.cohortName}</h3>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {attendanceRegisters.map((register) => (
                        <a
                          key={register.type}
                          href={`/api/staff/units/${allocationId}/attendance-sheet/${register.type}?format=pdf`}
                          className="group flex min-h-14 items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 py-2.5 text-left transition hover:border-primary/35 hover:bg-primary-subtle/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-20 sm:flex-col sm:items-start sm:justify-center sm:px-3.5"
                        >
                          <span className="min-w-0">
                            <span className="block text-xs font-bold leading-4 text-text-primary">{register.label}</span>
                            <span className="mt-1 hidden text-[10px] leading-4 text-text-muted sm:block">{register.detail}</span>
                          </span>
                          <ArrowDownToLine className="size-4 shrink-0 text-primary transition group-hover:translate-y-0.5" aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
