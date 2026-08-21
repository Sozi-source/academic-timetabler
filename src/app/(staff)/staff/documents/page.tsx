import {
  FileText,
} from 'lucide-react';
import Link from 'next/link';

import {
  Badge,
} from '@/components/ui/badge';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  getStaffWorkspace,
} from '@/features/staff-assessment/queries';
import {
  teachingDocumentKinds,
} from '@/features/teaching-documents/domain';
import {
  getActiveTeachingDocumentTemplates,
  getTeachingDocumentsByAllocationIds,
} from '@/features/teaching-documents/queries';

export default async function StaffDocumentsPage() {
  const profile =
    await requireTrainerAccess();

  const workspace =
    await getStaffWorkspace(
      profile.id,
    );

  const [
    templates,
    documents,
  ] =
    await Promise.all([
      getActiveTeachingDocumentTemplates(),
      getTeachingDocumentsByAllocationIds(
        workspace.allocations.map(
          (allocation) =>
            allocation.allocationId,
        ),
      ),
    ]);

  const activeTemplateTypes =
    new Set(
      templates
        .filter(
          (template) =>
            Boolean(
              template.storagePath,
            ),
        )
        .map(
          (template) =>
            template.documentType,
        ),
    );

  const latestByAllocation =
    new Map<string, number>();

  for (
    const document of
      documents
  ) {
    latestByAllocation.set(
      document.allocationId,
      (
        latestByAllocation.get(
          document.allocationId,
        ) ??
        0
      ) + 1,
    );
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
          {
            teachingDocumentKinds.length
          } document types
        </Badge>

        <Badge
          variant={
            activeTemplateTypes.size ===
            teachingDocumentKinds.length
              ? 'success'
              : 'neutral'
          }
        >
          {
            activeTemplateTypes.size
          } templates ready
        </Badge>
      </div>

      {workspace.allocations.length ===
      0 ? (
        <section className="rounded-xl border border-border bg-white px-5 py-10 text-center">
          <p className="text-sm font-semibold text-text-primary">
            No allocated units
          </p>
        </section>
      ) : (
        <section className="space-y-2">
          {workspace.allocations.map(
            (
              allocation,
            ) => (
              <Link
                key={
                  allocation.allocationId
                }
                href={`/staff/units/${allocation.allocationId}/documents`}
                className="block rounded-xl border border-border bg-white px-4 py-3 transition hover:border-border-strong hover:bg-surface-subtle/40"
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(9rem,.7fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {
                        allocation.unitName
                      }
                    </p>

                    <p className="mt-1 text-[11px] text-text-muted">
                      {
                        allocation.cohortName
                      }
                      {' · '}
                      {
                        allocation.academicPeriodName
                      }
                    </p>
                  </div>

                  <p className="text-[11px] text-text-secondary">
                    {
                      latestByAllocation.get(
                        allocation.allocationId,
                      ) ??
                      0
                    } records
                  </p>

                  <Badge variant="neutral">
                    Open
                  </Badge>
                </div>
              </Link>
            ),
          )}
        </section>
      )}
    </div>
  );
}
