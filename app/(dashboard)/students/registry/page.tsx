import { FileUp } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { ReportingSyncDialog } from '@/features/student-reporting-sync/reporting-sync-dialog';
import { getRegistryCohortOptions, getStudents } from '@/features/students/queries';
import { StudentRegistryTable } from '@/features/students/student-registry-table';

export default async function StudentRegistryPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireHodAccess();
  const params = await searchParams;
  const allowed = ['active', 'deferred', 'dropped_out', 'suspended', 'completed', 'graduated'] as const;
  const status = allowed.includes(params.status as (typeof allowed)[number]) ? params.status as (typeof allowed)[number] : undefined;
  
  // Fetch full student roster and active cohort options concurrently
  const [students, cohorts] = await Promise.all([
    getStudents(),
    getRegistryCohortOptions(),
  ]);

  return (
    <div className="space-y-3">
      <PageHeader
        backHref="/students"
        backLabel="Students"
        eyebrow="Student Lifecycle"
        title="Student registry"
        description="Current and historical students."
        context={<Badge variant="neutral">{students.length} records</Badge>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ReportingSyncDialog />
            <Link
              href="/students/registry/import"
              className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover active:scale-95"
            >
              <FileUp className="size-3.5" />
              <span>Import students</span>
            </Link>
          </div>
        }
      />

      <StudentRegistryTable students={students} cohorts={cohorts} initialStatus={status} />
    </div>
  );
}
