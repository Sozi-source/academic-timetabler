import { ClipboardCheck, FileText } from 'lucide-react';

import { getAuthenticatedProfile } from '@/features/auth/queries';
import { getStaffWorkspace } from '@/features/staff-assessment/queries';
import { groupStaffUnitAllocations } from '@/features/staff-assessment/unit-grouping';

const attendanceRegisters = [
  { type: 'class', label: 'Class attendance' },
  { type: 'cat', label: 'CAT attendance' },
  { type: 'exam', label: 'Exam attendance' },
] as const;

export default async function ExternalTrainerDocumentsPage() {
  const profile = await getAuthenticatedProfile();
  if (!profile) return null;

  const workspace = await getStaffWorkspace(profile.id);
  const units = groupStaffUnitAllocations(workspace.allocations);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Documents</p>
        <h1 className="mt-1 text-xl font-bold text-text-primary">Attendance registers</h1>
        <p className="mt-1 text-sm text-text-muted">Download registers for your assigned units and cohorts.</p>
      </header>

      {units.length === 0 ? (
        <section className="rounded-xl border border-border bg-white px-5 py-12 text-center shadow-xs">
          <FileText className="mx-auto size-8 text-text-muted" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-bold text-text-primary">No registers available</h2>
          <p className="mt-1 text-xs text-text-muted">Registers will appear here when teaching units are assigned.</p>
        </section>
      ) : (
        <section aria-label="Unit attendance registers" className="space-y-3">
          {units.map((unit) => (
            <article key={unit.primaryAllocationId} className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
              <header className="border-b border-border px-4 py-3">
                <p className="text-[11px] font-semibold text-text-muted">{unit.unitCode} · {unit.academicPeriodName}</p>
                <h2 className="mt-0.5 text-sm font-bold text-text-primary">{unit.unitName}</h2>
              </header>
              <div className="divide-y divide-border">
                {unit.allAllocationIds.map((allocationId, index) => (
                  <div key={allocationId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="size-4 text-primary" aria-hidden="true" />
                      <p className="text-xs font-semibold text-text-secondary">
                        {unit.cohortNames[index] ?? unit.cohortName}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {attendanceRegisters.map((register) => (
                        <a
                          key={register.type}
                          href={`/api/staff/units/${allocationId}/attendance-sheet/${register.type}?format=pdf`}
                          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border bg-white px-3 text-[11px] font-semibold text-text-secondary transition hover:border-primary/30 hover:bg-primary-subtle/30 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          {register.label}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
