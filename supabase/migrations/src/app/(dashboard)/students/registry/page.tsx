import { ArrowLeft, Download, FileUp, KeyRound, UsersRound } from 'lucide-react';
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
  const allowed = ['active', 'deferred', 'dropped_out', 'completed', 'graduated'] as const;
  const status = allowed.includes(params.status as (typeof allowed)[number]) ? params.status as (typeof allowed)[number] : undefined;
  
  // Fetch full student roster and active cohort options concurrently
  const [students, cohorts] = await Promise.all([
    getStudents(),
    getRegistryCohortOptions(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Student Lifecycle"
        title="Student registry"
        description="Current and historical students."
        icon={UsersRound}
        context={<Badge variant="neutral">{students.length} records</Badge>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/students" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle">
              <ArrowLeft className="size-3.5" />
              Students
            </Link>
            <Link href="/students/access" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle">
              <KeyRound className="size-3.5" />
              Student access
            </Link>
            <ReportingSyncDialog />
            <Link href="/api/students/export" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle">
              <Download className="size-3.5" />
              Export Excel
            </Link>
            <Link href="/students/registry/import" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover">
              <FileUp className="size-3.5" />
              Import students
            </Link>
          </div>
        }
      />

      <StudentRegistryTable students={students} cohorts={cohorts} initialStatus={status} />
    </div>
  );
}
