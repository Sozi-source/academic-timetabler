import { Pencil } from 'lucide-react';
import { notFound } from 'next/navigation';

import { Card } from '@/components/ui/card';
import { FastTab } from '@/components/ui/fast-tab';
import { requireHodAccess } from '@/features/auth/authorization';
import { ProgressionForm } from '@/features/students/progression-form';
import {
  getRegistryCohortOptions,
  getStudentActiveReportingStatus,
  getStudentById,
  getStudentLifecycleEvents,
} from '@/features/students/queries';
import { ReassignCohortDialog } from '@/features/students/reassign-cohort-dialog';
import type { StudentLifecycleEventType } from '@/features/students/types';

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
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
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
      <FastTab
        title="Cohort and dates"
        summary={`${student.current_cohort?.name ?? '—'} · completes ${formatDate(student.projected_completion_date)}`}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <Card className="p-2.5 shadow-2xs sm:p-3">
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-text-muted">
              Admission cohort
            </p>
            <p className="mt-0.5 text-xs font-semibold text-text-primary">
              {student.admission_cohort?.name ?? '—'}
            </p>
          </Card>
          <Card className="p-2.5 shadow-2xs sm:p-3">
            <div className="flex items-center justify-between">
              <p className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-text-muted">
                Current cohort
              </p>
              <ReassignCohortDialog
                studentId={student.id}
                studentName={student.full_name}
                currentCohortId={student.current_cohort?.id}
                currentCohortName={student.current_cohort?.name}
                cohorts={cohorts}
                trigger={
                  <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                  >
                    <Pencil className="size-3" /> Change
                  </button>
                }
              />
            </div>
            <p className="mt-0.5 text-xs font-semibold text-text-primary">
              {student.current_cohort?.name ?? '—'}
            </p>
          </Card>
          <Card className="p-2.5 shadow-2xs sm:p-3">
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-text-muted">
              Projected completion
            </p>
            <p className="mt-0.5 text-xs font-semibold text-text-primary">
              {formatDate(student.projected_completion_date)}
            </p>
          </Card>
        </div>
      </FastTab>

      <FastTab title="Update student status">
        <ProgressionForm
          studentId={student.id}
          status={student.lifecycle_status}
          academicPhase={student.academic_phase}
          reportingStatus={reportingStatus}
        />
      </FastTab>

      <FastTab
        title="Timeline"
        summary={`${events.length} event${events.length === 1 ? '' : 's'}`}
      >
        {events.length === 0 ? (
          <p className="px-3.5 py-4 text-xs text-text-muted">
            No lifecycle events yet.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {events.map((event) => (
              <div key={event.id} className="px-3.5 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-text-primary">
                      {eventLabels[event.event_type] ??
                        event.event_type.replaceAll('_', ' ')}
                    </p>
                    {event.to_cohort ? (
                      <p className="mt-0.5 text-[0.6875rem] text-text-muted">
                        Cohort: {event.to_cohort.name}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[0.6875rem] font-medium text-text-muted">
                    {formatDate(event.effective_date)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </FastTab>
    </div>
  );
}
