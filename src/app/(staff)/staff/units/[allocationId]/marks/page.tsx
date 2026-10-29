import { ArrowRight, BookOpenCheck, Keyboard } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { groupStaffUnitAllocations } from '@/features/staff-assessment/unit-grouping';
import { requireStaffAllocation } from '@/features/staff-assessment/queries';
import type { StaffAssessmentSummary, StaffUnitAllocation } from '@/features/staff-assessment/types';

interface PageProps {
  params: Promise<{ allocationId: string }>;
}

interface AssessmentChoice {
  allocation: StaffUnitAllocation;
  assessment: StaffAssessmentSummary;
}

function canEnterMarks(assessment: StaffAssessmentSummary): boolean {
  const closedStatuses = new Set(['submitted', 'finalised', 'finalized', 'archived', 'published']);
  const workflowStatus = assessment.workflowStatus.trim().toLowerCase().replaceAll(' ', '_');
  return assessment.trainerEntryOpen === true
    && !assessment.published
    && !closedStatuses.has(workflowStatus);
}

export default async function StaffUnitMarksPage({ params }: PageProps) {
  const profile = await requireTrainerAccess();
  const { allocationId } = await params;
  const context = await requireStaffAllocation({ profileId: profile.id, allocationId });

  if (!context) notFound();

  const allocations = context.workspace.allocations.some((allocation) => allocation.allocationId === allocationId)
    ? context.workspace.allocations
    : [...context.workspace.allocations, context.allocation];
  const unitGroup = groupStaffUnitAllocations(allocations).find((group) =>
    group.allAllocationIds.includes(allocationId),
  );

  if (!unitGroup) notFound();

  const groupAllocationIds = new Set(unitGroup.allAllocationIds);
  const choicesByAssessmentId = new Map<string, AssessmentChoice>();
  for (const allocation of allocations) {
    if (!groupAllocationIds.has(allocation.allocationId)) continue;
    for (const assessment of [allocation.cat, allocation.exam]) {
      if (!assessment) continue;
      const key = `${assessment.assessmentId}:${assessment.type}`;
      if (!choicesByAssessmentId.has(key)) choicesByAssessmentId.set(key, { allocation, assessment });
    }
  }

  const choices = [...choicesByAssessmentId.values()].sort((first, second) =>
    first.assessment.type.localeCompare(second.assessment.type)
      || first.allocation.cohortName.localeCompare(second.allocation.cohortName),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="My Units · Marks"
        title="Enter marks"
        description={`${unitGroup.unitCode} · ${unitGroup.unitName} · ${unitGroup.academicPeriodName}`}
        icon={Keyboard}
        backHref="/staff/units"
        backLabel="My Units"
      />

      {choices.length === 0 ? (
        <EmptyState
          icon={BookOpenCheck}
          title="No markbooks are available for this unit"
          description="The department must set up an assessment before marks can be entered."
        />
      ) : (
        <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Available markbooks">
          {choices.map(({ allocation, assessment }) => {
            const entryOpen = canEnterMarks(assessment);
            const statusLabel = assessment.workflowStatus.replaceAll('_', ' ');

            return (
              <Card key={`${assessment.assessmentId}:${allocation.allocationId}`} className="flex flex-col justify-between border-l-4 border-l-primary p-4 shadow-xs">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-text-primary">
                        {assessment.type === 'cat' ? 'CAT marks' : 'Exam marks'}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">{allocation.cohortName}</p>
                    </div>
                    <Badge variant={entryOpen ? 'success' : 'neutral'} className="capitalize">
                      {statusLabel}
                    </Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5 text-[11px] font-semibold text-text-secondary">
                    <span className="rounded-md bg-surface-subtle px-2 py-1">{assessment.registered} registered</span>
                    {assessment.absent > 0 ? (
                      <span className="rounded-md bg-surface-subtle px-2 py-1">{assessment.absent} absent</span>
                    ) : null}
                    {assessment.published ? <span className="rounded-md bg-success-subtle px-2 py-1 text-success">Published</span> : null}
                  </div>
                </div>

                <Link
                  href={`/staff/units/${allocation.allocationId}/assessment/${assessment.assessmentId}/marks`}
                  className="mt-4 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-primary-hover"
                >
                  <Keyboard className="size-3.5" aria-hidden="true" />
                  {entryOpen ? 'Enter marks' : 'View marks'}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
