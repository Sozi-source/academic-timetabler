import {
  BookOpen,
  CalendarCheck2,
  FileSpreadsheet,
  FileText,
  Printer,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { getStaffWorkspace } from '@/features/staff-assessment/queries';
import { teachingDocumentKinds } from '@/features/teaching-documents/domain';
import {
  getActiveTeachingDocumentTemplates,
  getTeachingDocumentsByAllocationIds,
} from '@/features/teaching-documents/queries';

export default async function StaffDocumentsPage() {
  const profile = await requireTrainerAccess();
  const workspace = await getStaffWorkspace(profile.id);

  const [templates, documents] = await Promise.all([
    getActiveTeachingDocumentTemplates(),
    getTeachingDocumentsByAllocationIds(
      workspace.allocations.map((allocation) => allocation.allocationId)
    ),
  ]);

  const activeTemplateTypes = new Set(
    templates
      .filter((template) => Boolean(template.storagePath))
      .map((template) => template.documentType)
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
        description="Standardised TVET course outlines, schemes of work, and interactive records of work."
        icon={FileText}
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="success">TVET Standards Ready</Badge>
        <Badge variant="neutral">
          {workspace.allocations.length} Allocated Units
        </Badge>
        <Badge
          variant={
            activeTemplateTypes.size === teachingDocumentKinds.length
              ? 'success'
              : 'neutral'
          }
        >
          {activeTemplateTypes.size} Institutional Templates Ready
        </Badge>
      </div>

      {workspace.allocations.length === 0 ? (
        <section className="rounded-xl border border-border bg-white px-5 py-10 text-center">
          <p className="text-sm font-semibold text-text-primary">
            No allocated units
          </p>
        </section>
      ) : (
        <section className="space-y-3">
          {workspace.allocations.map((allocation) => {
            const rowEntries =
              rowEntriesByAllocation.get(allocation.allocationId) ?? 0;

            return (
              <Card
                key={allocation.allocationId}
                className="p-4 transition hover:border-border-strong hover:bg-surface-subtle/30"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-text-primary">
                        {allocation.unitName}
                      </p>
                      {allocation.unitCode ? (
                        <Badge variant="neutral">{allocation.unitCode}</Badge>
                      ) : null}
                    </div>

                    <p className="mt-1 text-[11px] text-text-muted">
                      {allocation.cohortName} · {allocation.academicPeriodName}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/staff/units/${allocation.allocationId}/documents/course-outline`}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-white px-2.5 text-[11px] font-semibold text-text-secondary hover:bg-surface-subtle"
                      title="View standard Course Outline"
                    >
                      <BookOpen className="size-3" />
                      Course Outline
                    </Link>

                    <Link
                      href={`/staff/units/${allocation.allocationId}/documents/scheme-of-work`}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-white px-2.5 text-[11px] font-semibold text-text-secondary hover:bg-surface-subtle"
                      title="View standard Scheme of Work"
                    >
                      <FileSpreadsheet className="size-3" />
                      Scheme of Work
                    </Link>

                    <Link
                      href={`/staff/units/${allocation.allocationId}/documents/record-of-work`}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-[11px] font-semibold text-white hover:bg-primary-hover"
                      title="Log Record of Work delivery progress"
                    >
                      <CalendarCheck2 className="size-3" />
                      Record of Work ({rowEntries} logged)
                    </Link>

                    <Link
                      href={`/staff/units/${allocation.allocationId}/documents`}
                      className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-[11px] font-semibold text-text-secondary hover:bg-surface-subtle"
                    >
                      All Documents
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
