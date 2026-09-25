import { ArrowLeft, CalendarDays, Eye, History, KeyRound, Pencil, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireHodAccess } from '@/features/auth/authorization';
import { EditAdmissionNumberDialog } from '@/features/students/edit-admission-number-dialog';
import { ProgressionForm } from '@/features/students/progression-form';
import {
  getRegistryCohortOptions,
  getStudentActiveReportingStatus,
  getStudentById,
  getStudentLifecycleEvents,
} from '@/features/students/queries';
import { ReassignCohortDialog } from '@/features/students/reassign-cohort-dialog';
import { ResetStudentPasswordDialog } from '@/features/students/reset-student-password-dialog';
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

  const [events, reportingStatus, cohorts] = await Promise.all([
    getStudentLifecycleEvents(student.id),
    getStudentActiveReportingStatus(student.id),
    getRegistryCohortOptions(),
  ]);

  return (
    <div className="space-y-3">
      {/* Back button at the right place */}
      <div>
        <Link
          href="/students/registry"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to student registry</span>
        </Link>
      </div>

      {/* Slim Student Profile Header Card */}
      <Card className="p-3.5 sm:p-4 shadow-2xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-text-primary leading-tight">
                {student.full_name}
              </h1>
              <Badge variant={statusVariant(student.lifecycle_status)} className="text-[10px] px-2 py-0 min-h-5">
                {student.lifecycle_status.replaceAll('_', ' ')}
              </Badge>
            </div>
            <p className="mt-1 font-mono text-[11px] text-text-muted leading-tight">
              {student.admission_number}
              <span className="mx-1.5 text-border-strong">·</span>
              <span className="font-sans font-medium text-text-secondary">{student.programme?.code ?? 'Programme'}</span>
              <span className="mx-1.5 text-border-strong">·</span>
              <span className="font-sans text-text-muted">{student.current_cohort?.name ?? student.admission_cohort?.name ?? 'No cohort'}</span>
            </p>
          </div>

          {/* Slim, neatly aligned action buttons */}
          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:items-center sm:gap-2 shrink-0">
            <ReassignCohortDialog
              studentId={student.id}
              studentName={student.full_name}
              currentCohortId={student.current_cohort?.id}
              currentCohortName={student.current_cohort?.name}
              cohorts={cohorts}
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto h-8 px-2.5 text-xs font-semibold justify-center whitespace-nowrap cursor-pointer shadow-2xs"
                >
                  <UsersRound className="size-3.5 mr-1" />
                  <span>Reassign</span>
                </Button>
              }
            />
            <EditAdmissionNumberDialog
              studentId={student.id}
              studentName={student.full_name}
              currentAdmissionNumber={student.admission_number}
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto h-8 px-2.5 text-xs font-semibold justify-center whitespace-nowrap cursor-pointer shadow-2xs"
                >
                  <Pencil className="size-3.5 mr-1" />
                  <span>Edit Adm. No.</span>
                </Button>
              }
            />
            <ResetStudentPasswordDialog
              studentId={student.id}
              studentName={student.full_name}
              admissionNumber={student.admission_number}
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto h-8 px-2.5 text-xs font-semibold justify-center whitespace-nowrap cursor-pointer shadow-2xs"
                >
                  <KeyRound className="size-3.5 mr-1" />
                  <span>Reset Pwd</span>
                </Button>
              }
            />
            <Link
              href={`/students/registry/${student.id}/portal-view`}
              className="inline-flex h-8 w-full sm:w-auto items-center justify-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-primary-hover active:scale-95 whitespace-nowrap"
            >
              <Eye className="size-3.5" />
              <span>Student View</span>
            </Link>
          </div>
        </div>
      </Card>

      {/* Slim Overview Metric Cards */}
      <div className="grid gap-2 sm:grid-cols-3">
        <Card className="p-2.5 sm:p-3 shadow-2xs">
          <p className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-text-muted">Admission cohort</p>
          <p className="mt-0.5 text-xs font-semibold text-text-primary">{student.admission_cohort?.name ?? '—'}</p>
        </Card>
        <Card className="p-2.5 sm:p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-text-muted">Current cohort</p>
            <ReassignCohortDialog
              studentId={student.id}
              studentName={student.full_name}
              currentCohortId={student.current_cohort?.id}
              currentCohortName={student.current_cohort?.name}
              cohorts={cohorts}
              trigger={
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                >
                  <Pencil className="size-3" /> Change
                </button>
              }
            />
          </div>
          <p className="mt-0.5 text-xs font-semibold text-text-primary">{student.current_cohort?.name ?? '—'}</p>
        </Card>
        <Card className="p-2.5 sm:p-3 shadow-2xs">
          <p className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-text-muted">Projected completion</p>
          <p className="mt-0.5 text-xs font-semibold text-text-primary">{formatDate(student.projected_completion_date)}</p>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-3.5 sm:p-4 shadow-2xs">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-institutional-yellow text-institutional-yellow-ink">
              <CalendarDays className="size-3.5" />
            </span>
            <h2 className="text-xs sm:text-sm font-bold text-text-primary">Update student status</h2>
          </div>
          <ProgressionForm studentId={student.id} status={student.lifecycle_status} academicPhase={student.academic_phase} reportingStatus={reportingStatus} />
        </Card>

        <Card className="overflow-hidden shadow-2xs">
          <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5 bg-surface-subtle">
            <History className="size-3.5 text-primary" />
            <h2 className="text-xs sm:text-sm font-bold text-text-primary">Timeline</h2>
          </div>
          {events.length === 0 ? (
            <p className="px-3.5 py-4 text-xs text-text-muted">No lifecycle events yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {events.map((event) => (
                <div key={event.id} className="px-3.5 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-text-primary">{eventLabels[event.event_type] ?? event.event_type.replaceAll('_', ' ')}</p>
                      {event.to_cohort ? <p className="mt-0.5 text-[0.6875rem] text-text-muted">Cohort: {event.to_cohort.name}</p> : null}
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
