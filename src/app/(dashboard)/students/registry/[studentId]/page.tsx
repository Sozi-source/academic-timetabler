import { ArrowLeft, CalendarDays, Eye, History, UserRound } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { ProgressionForm } from '@/features/students/progression-form';
import { EditAdmissionNumberDialog } from '@/features/students/edit-admission-number-dialog';
import { ResetStudentPasswordDialog } from '@/features/students/reset-student-password-dialog';
import { getStudentActiveReportingStatus, getStudentById, getStudentLifecycleEvents } from '@/features/students/queries';
import type { StudentLifecycleEventType, StudentLifecycleStatus } from '@/features/students/types';

function statusVariant(status: StudentLifecycleStatus) {
  if (status === 'active' || status === 'admitted' || status === 'completed' || status === 'graduated') return 'success' as const;
  if (status === 'deferred' || status === 'suspended') return 'warning' as const;
  if (status === 'dropped_out') return 'danger' as const;
  return 'neutral' as const;
}

const eventLabels: Partial<Record<StudentLifecycleEventType, string>> = {
  admission: 'Admitted',
  cohort_change: 'Cohort changed',
  deferral: 'Deferred',
  resumption: 'Resumed',
  dropout: 'Dropped out',
  programme_completion: 'Programme completed',
  graduation: 'Graduated',
  administrative_correction: 'Administrative correction',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

export default async function StudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  await requireHodAccess();
  const { studentId } = await params;
  const student = await getStudentById(studentId);
  if (!student) notFound();

  const [events, reportingStatus] = await Promise.all([getStudentLifecycleEvents(student.id), getStudentActiveReportingStatus(student.id)]);

  return (
    <div className="space-y-4">
      <Link href="/students/registry" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
        <ArrowLeft className="size-3.5" /> Student registry
      </Link>

      <PageHeader
        eyebrow={student.admission_number}
        title={student.full_name}
        description={`${student.programme?.code ?? 'Programme'} · ${student.current_cohort?.name ?? student.admission_cohort?.name ?? 'No cohort'}`}
        icon={UserRound}
        context={<Badge variant={statusVariant(student.lifecycle_status)}>{student.lifecycle_status.replaceAll('_', ' ')}</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <EditAdmissionNumberDialog
              studentId={student.id}
              studentName={student.full_name}
              currentAdmissionNumber={student.admission_number}
            />
            <ResetStudentPasswordDialog
              studentId={student.id}
              studentName={student.full_name}
              admissionNumber={student.admission_number}
            />
            <Link
              href={`/students/registry/${student.id}/portal-view`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-bold text-white shadow-2xs transition hover:bg-primary-hover active:scale-95"
            >
              <Eye className="size-3.5" />
              <span>View as Student</span>
            </Link>
          </div>
        }

      />

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-3">
          <p className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-text-muted">Admission cohort</p>
          <p className="mt-1 text-xs font-semibold text-text-primary">{student.admission_cohort?.name ?? '—'}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-text-muted">Current cohort</p>
          <p className="mt-1 text-xs font-semibold text-text-primary">{student.current_cohort?.name ?? '—'}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-text-muted">Projected completion</p>
          <p className="mt-1 text-xs font-semibold text-text-primary">{formatDate(student.projected_completion_date)}</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-institutional-yellow text-institutional-yellow-ink"><CalendarDays className="size-3.5" /></span>
            <h2 className="text-sm font-bold text-text-primary">Update student status</h2>
          </div>
          <ProgressionForm studentId={student.id} status={student.lifecycle_status} academicPhase={student.academic_phase} reportingStatus={reportingStatus} />
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <History className="size-3.5 text-primary" />
            <h2 className="text-sm font-bold text-text-primary">Timeline</h2>
          </div>
          {events.length === 0 ? (
            <p className="px-4 py-5 text-xs text-text-muted">No lifecycle events yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {events.map((event) => (
                <div key={event.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-text-primary">{eventLabels[event.event_type] ?? event.event_type.replaceAll('_', ' ')}</p>
                      {event.to_cohort ? <p className="mt-1 text-[0.6875rem] text-text-muted">Cohort: {event.to_cohort.name}</p> : null}
                    </div>
                    <span className="shrink-0 text-[0.6875rem] font-medium text-text-muted">{formatDate(event.effective_date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
