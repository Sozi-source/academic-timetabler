import { StudentStatusStage } from '@/features/students/student-status-stage';
import { ArrowLeft, ChevronRight, Database, Download, FileUp, KeyRound, UsersRound } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { getStudents } from '@/features/students/queries';

export default async function StudentRegistryPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireHodAccess();
  const params = await searchParams;
  const allowed = ['active', 'deferred', 'dropped_out', 'completed', 'graduated'] as const;
  const status = allowed.includes(params.status as (typeof allowed)[number]) ? params.status as (typeof allowed)[number] : undefined;
  const students = await getStudents(status);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Student Lifecycle"
        title="Student registry"
        description="Current and historical students."
        icon={UsersRound}
        context={<Badge variant="neutral">{students.length} records</Badge>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/students" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle">
              <ArrowLeft className="size-3.5" />
              Students
            </Link>
            <Link href="/students/access" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle">
              <KeyRound className="size-3.5" />
              Student access
            </Link>
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

      <div className="flex flex-wrap gap-2">
        {[['', 'All'], ['active', 'Active'], ['deferred', 'Deferred'], ['dropped_out', 'Dropped out'], ['completed', 'Completed'], ['graduated', 'Graduated']].map(([value, label]) => (
          <Link key={label} href={value ? `/students/registry?status=${value}` : '/students/registry'} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${status === (value || undefined) ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text-secondary hover:border-primary/40'}`}>{label}</Link>
        ))}
      </div>

      {students.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No students yet"
          description="Import a student workbook to get started."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-bold text-text-primary">Current student records</p>
            <p className="mt-0.5 text-xs text-text-muted">Current department students.</p>
          </div>
          <div className="divide-y divide-border">
            <div className="hidden border-b border-border bg-surface-subtle px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted md:grid md:grid-cols-[1.4fr_1fr_1fr_1.2fr_1.5rem] md:items-center md:gap-3">
              <span>Student</span>
              <span>Programme</span>
              <span>Cohort</span>
              <span>Status / Stage</span>
              <span aria-hidden="true" />
            </div>
            {students.slice(0, 100).map((student) => (
              <Link key={student.id} href={`/students/registry/${student.id}`} className="grid gap-2 px-4 py-3 text-xs transition hover:bg-surface-subtle md:grid md:grid-cols-[1.4fr_1fr_1fr_1.2fr_1.5rem] md:items-center md:gap-3">
                <div>
                  <p className="font-semibold text-text-primary">{student.full_name}</p>
                  <p className="mt-0.5 text-text-muted">{student.admission_number}</p>
                </div>
                <div>
                  <p className="font-medium text-text-primary">{student.programme?.code ?? 'Programme unavailable'}</p>
                </div>
                <div>
                  <p className="font-medium text-text-primary">{student.current_cohort?.name ?? 'Not assigned'}</p>
                </div>
                <StudentStatusStage student={student} />
                <ChevronRight className="size-3.5 text-text-muted justify-self-end" />
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
