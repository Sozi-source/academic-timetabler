import { History, UserRoundCheck } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { getProgressionStudents, getStudentSummary } from '@/features/students/queries';
import type { StudentLifecycleStatus } from '@/features/students/types';

function statusVariant(status: StudentLifecycleStatus) {
  if (status === 'completed' || status === 'graduated') return 'success' as const;
  if (status === 'deferred') return 'warning' as const;
  if (status === 'dropped_out') return 'danger' as const;
  return 'neutral' as const;
}

export default async function StudentProgressionPage() {
  await requireHodAccess();
  const [students, summary] = await Promise.all([getProgressionStudents(), getStudentSummary()]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Student Lifecycle"
        title="Lifecycle & progression"
        description="Track exceptions and completion."
        icon={History}
        context={<Badge variant="neutral">{students.length} tracked</Badge>}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Deferred" value={String(summary.deferred)} description="Expected to return" icon={History} />
        <MetricCard label="Dropped out" value={String(summary.droppedOut)} description="Follow-up" icon={UserRoundCheck} />
        <MetricCard label="Graduated" value={String(summary.graduated)} description="Historical record" icon={History} />
      </div>

      {students.length === 0 ? (
        <EmptyState icon={UserRoundCheck} title="No progression exceptions" description="Deferred, dropped out, completed and graduated students will appear here." />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {students.map((student) => (
              <Link
                key={student.id}
                href={`/students/registry/${student.id}`}
                className="grid gap-2 px-4 py-3 transition hover:bg-surface-subtle md:grid-cols-[1.4fr_1fr_auto] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-text-primary">{student.full_name}</p>
                  <p className="mt-0.5 text-[0.6875rem] text-text-muted">{student.admission_number}</p>
                </div>
                <div className="min-w-0 text-xs">
                  <p className="truncate font-medium text-text-primary">{student.current_cohort?.name ?? student.admission_cohort?.name ?? 'No cohort'}</p>
                  <p className="mt-0.5 text-[0.6875rem] text-text-muted">{student.programme?.code ?? 'Programme'}</p>
                </div>
                <Badge variant={statusVariant(student.lifecycle_status)}>{student.lifecycle_status.replaceAll('_', ' ')}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
