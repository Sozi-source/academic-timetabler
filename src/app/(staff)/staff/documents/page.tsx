import {
  BookOpen,
  CalendarCheck2,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { getStaffWorkspace } from '@/features/staff-assessment/queries';
import {
  getTeachingDocumentsByAllocationIds,
} from '@/features/teaching-documents/queries';

export default async function StaffDocumentsPage() {
  const profile = await requireTrainerAccess();
  const workspace = await getStaffWorkspace(profile.id);

  const documents = await getTeachingDocumentsByAllocationIds(
    workspace.allocations.map((allocation) => allocation.allocationId)
  );

  const latestByAllocation = new Map<string, number>();
  const rowEntriesByAllocation = new Map<string, number>();

  for (const document of documents) {
    latestByAllocation.set(
      document.allocationId,
      (latestByAllocation.get(document.allocationId) ?? 0) + 1
    );
    if (document.documentType === 'record_of_work' && document.originalFilename) {
      try {
        const parsed = JSON.parse(document.originalFilename);
        if (Array.isArray(parsed)) {
          rowEntriesByAllocation.set(document.allocationId, parsed.length);
        }
      } catch {
        // ignore
      }
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Staff"
        title="Teaching Documents"
        description="Documents for your allocated units."
        icon={FileText}
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">
          {workspace.allocations.length} Allocated Units
        </Badge>
      </div>

      {workspace.allocations.length === 0 ? (
        <section className="rounded-xl border border-border bg-white px-5 py-12 text-center">
          <FileText className="mx-auto size-8 text-text-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-text-primary">
            No allocated units
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-text-muted">
            Official teaching documents will appear here once teaching allocations are assigned.
          </p>
        </section>
      ) : (
        <section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {workspace.allocations.map((allocation) => {
            const rowEntries =
              rowEntriesByAllocation.get(allocation.allocationId) ?? 0;

            return (
              <Card
                key={allocation.allocationId}
                className="flex flex-col justify-between p-4 shadow-2xs transition hover:border-border-strong hover:bg-surface-subtle/30"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-bold text-text-primary">
                        {allocation.unitName}
                      </p>
                      <p className="mt-1 text-[11px] text-text-muted">
                        {allocation.cohortName}
                      </p>
                    </div>
                    {allocation.unitCode ? (
                      <Badge variant="neutral" className="shrink-0">{allocation.unitCode}</Badge>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-1.5">
                  <Link
                    href={`/staff/units/${allocation.allocationId}/documents/course-outline`}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border bg-white px-2 text-[11px] font-semibold text-text-secondary hover:bg-surface-subtle"
                    title="View Course Outline"
                  >
                    <BookOpen className="size-3 text-primary" />
                    Outline
                  </Link>

                  <Link
                    href={`/staff/units/${allocation.allocationId}/documents/scheme-of-work`}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border bg-white px-2 text-[11px] font-semibold text-text-secondary hover:bg-surface-subtle"
                    title="View Scheme of Work"
                  >
                    <FileSpreadsheet className="size-3 text-primary" />
                    Scheme
                  </Link>

                  <Link
                    href={`/staff/units/${allocation.allocationId}/documents/record-of-work`}
                    className="col-span-2 inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-semibold text-white hover:bg-primary-hover"
                    title="Log Record of Work delivery progress"
                  >
                    <CalendarCheck2 className="size-3" />
                    Record of Work ({rowEntries})
                  </Link>
                </div>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
