import {
  ClipboardCheck,
  Download,
  FileCheck2,
} from 'lucide-react';
import { redirect } from 'next/navigation';

import { StudentPortalShell } from '@/components/student/student-portal-shell';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PrintActionButton } from '@/components/ui/print-action-button';
import {
  activeStudentUnits,
  studentRegistrationLabel,
} from '@/features/student-portal/domain';
import { getStudentPortalRegistrationContext } from '@/features/student-portal/queries';
import { getStudentPortalSession } from '@/features/student-portal/session';
import { UnitRegistrationFormPreview } from '@/features/student-unit-registration/unit-registration-form-preview';

export default async function StudentUnitRegistrationPage() {
  const session = await getStudentPortalSession();

  if (!session) {
    redirect('/student/login');
  }

  const context = await getStudentPortalRegistrationContext(
    session.studentId,
  );

  if (!context) {
    redirect('/student/login');
  }

  const units = activeStudentUnits(context.units);

  return (
    <StudentPortalShell student={context.student}>
      <div className="space-y-4">
        {!context.period ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Registration unavailable"
            description="No active academic period."
          />
        ) : units.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Not pre-registered"
            description="No units have been pre-registered for your cohort yet. Contact your Department Admin."
          />
        ) : (
          <>
            {/* Header & Workflow Banner (Hidden when printing) */}
            <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs print:hidden space-y-3">
              {/* Guidance Callout */}
              <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary-subtle p-3 text-xs text-primary-deep">
                <FileCheck2 className="size-4 shrink-0 text-primary mt-0.5" />
                <div>
                  <p className="font-bold text-text-primary">Department Pre-Registered Units</p>
                  <p className="mt-0.5 text-[11px] text-text-secondary leading-relaxed">
                    Your units have been registered by your Department Admin. Download or print this official prefilled form and circulate it for physical approvals upon reporting to college.
                  </p>
                </div>
              </div>

              {/* Action Header & Metadata */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-base font-bold text-text-primary sm:text-lg">
                      Official Unit Registration Form
                    </h1>
                    <Badge
                      variant={
                        context.registrationState === 'confirmed'
                          ? 'success'
                          : context.registrationState === 'deregistered'
                            ? 'warning'
                            : 'institutional'
                      }
                    >
                      {studentRegistrationLabel(context.registrationState)}
                    </Badge>
                    <Badge
                      variant={context.reportingStatus === 'reported' ? 'success' : 'warning'}
                    >
                      {context.reportingStatus === 'reported'
                        ? 'Reporting Confirmed'
                        : 'Reporting Pending'}
                    </Badge>
                  </div>

                  <p className="mt-1 text-xs text-text-muted">
                    {context.period?.name ?? 'Academic period'} · <span className="font-bold text-text-primary">{units.length} Assigned Units</span>
                  </p>
                </div>

                {/* Clear Single-Purpose Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <PrintActionButton label="Print / Save PDF" />
                  <a
                    href="/api/student/unit-registration/form"
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-bold text-white shadow-2xs transition hover:bg-primary-hover active:scale-95"
                  >
                    <Download className="size-3.5" />
                    <span>Download Prefilled Form (.docx)</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Complete Full-Page Official HTML Form Preview */}
            <div className="rounded-xl border border-border bg-surface-subtle p-2 sm:p-6 print:border-none print:bg-white print:p-0">
              <UnitRegistrationFormPreview context={context} />
            </div>

            {context.submission?.verificationNote ? (
              <p className="text-[11px] text-text-muted print:hidden">
                Department Note: {context.submission.verificationNote}
              </p>
            ) : null}
          </>
        )}
      </div>
    </StudentPortalShell>
  );
}
