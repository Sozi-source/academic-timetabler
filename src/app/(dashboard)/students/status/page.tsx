import { ArrowLeft, RefreshCw, UsersRound } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { getStudents } from '@/features/students/queries';
import { InlineStatusUpdater } from '@/features/students/inline-status-updater';

export const dynamic = 'force-dynamic';

export default async function StudentStatusPage() {
  await requireHodAccess();
  const students = await getStudents();

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Student Lifecycle"
        title="Update student statuses"
        description="Change status and reporting for any student directly from this list — no navigation required."
        icon={UsersRound}
        context={<Badge variant="neutral">{students.length} students</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/students"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              <ArrowLeft className="size-3.5" />
              Students
            </Link>
            <Link
              href="/students/status"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Link>
          </div>
        }
      />

      <InlineStatusUpdater students={students} />
    </div>
  );
}
