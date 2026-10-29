import {
  ArrowRight,
  BookOpenCheck,
  FileText,
  Keyboard,
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

  const assessmentChoicesByUnit = new Map(
    groupedUnits.map((group) => {
      const groupAllocationIds = new Set(group.allAllocationIds);
      const choices = workspace.allocations.flatMap((allocation) => {
        if (!groupAllocationIds.has(allocation.allocationId)) return [];
        return [allocation.cat, allocation.exam]
          .filter((assessment) => assessment !== null)
          .map((assessment) => ({ allocationId: allocation.allocationId, assessment }));
      });
      const uniqueChoices = [...new Map(
        choices.map((choice) => [choice.assessment.assessmentId, choice]),
      ).values()];
      return [group.primaryAllocationId, uniqueChoices] as const;
    }),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Staff"
        title="My Units"
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
            <article
              key={allocation.primaryAllocationId}
              className="flex flex-col justify-between rounded-xl border border-border border-l-4 border-l-primary bg-surface p-4 shadow-xs transition hover:border-border-strong hover:shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-black text-slate-950">
                      {allocation.unitName}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-text-muted">
                      {allocation.unitCode} · {allocation.academicPeriodName}
                    </p>
                  </div>
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

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                {(() => {
                  const choices = assessmentChoicesByUnit.get(allocation.primaryAllocationId) ?? [];
                  const openChoices = choices.filter((choice) => choice.assessment.trainerEntryOpen);
                  const entryChoice = choices.length === 1 ? choices[0] : null;
                  const marksHref = entryChoice
                    ? `/staff/units/${entryChoice.allocationId}/assessment/${entryChoice.assessment.assessmentId}/marks`
                    : `/staff/units/${allocation.primaryAllocationId}/marks`;

                  return (
                    <Link
                      href={marksHref}
                      className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-primary-hover"
                    >
                      <Keyboard className="size-3.5" aria-hidden="true" />
                      {openChoices.length > 0 || choices.length === 0 ? 'Enter marks' : 'View marks'}
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  );
                })()}
                <Link
                  href={`/staff/units/${allocation.primaryAllocationId}`}
                  className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
                >
                  <FileText className="size-3.5" aria-hidden="true" />
                  Unit documents
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
