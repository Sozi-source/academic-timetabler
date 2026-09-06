import {
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileText,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { redirect } from 'next/navigation';

import { StudentPortalShell } from '@/components/student/student-portal-shell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
          <div className="xl:grid xl:grid-cols-12 xl:gap-6 xl:items-start space-y-4 xl:space-y-0">
            {/* Left Column: Student Details, Status, Quick Actions & Units Summary (Desktop Sidebar) */}
            <div className="xl:col-span-5 2xl:col-span-4 xl:sticky xl:top-20 xl:self-start space-y-4 print:hidden">
              {/* Card 1: Registration Overview & Status */}
              <Card className="p-4 space-y-3 border-border shadow-2xs">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <ClipboardCheck className="size-4.5" />
                    </div>
                    <div>
                      <h1 className="text-sm font-bold text-text-primary">Unit Registration</h1>
                      <p className="text-[11px] text-text-muted">{context.period.name}</p>
                    </div>
                  </div>
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
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Reporting Status</span>
                    <Badge variant={context.reportingStatus === 'reported' ? 'success' : 'warning'}>
                      {context.reportingStatus === 'reported' ? 'Reported' : 'Pending'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Assigned Units</span>
                    <span className="font-bold text-text-primary">{units.length} Units</span>
                  </div>
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Student ID</span>
                    <span className="font-mono font-bold text-text-primary">{context.student.admissionNumber}</span>
                  </div>
                </div>
              </Card>

              {/* Card 2: PDF Export & Print Quick Actions */}
              <Card className="p-4 space-y-3 border-border shadow-2xs bg-surface-subtle/50">
                <p className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <Download className="size-3.5 text-primary" />
                  Form Export & Print
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
                  <a
                    href="/api/student/unit-registration/form"
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 text-xs font-bold text-white shadow-2xs transition hover:bg-primary-hover active:scale-95"
                  >
                    <Download className="size-4" />
                    <span>Download Official PDF</span>
                  </a>
                  <PrintActionButton
                    label="Print Registration Form"
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-xs font-semibold text-text-primary shadow-2xs transition hover:bg-surface-subtle active:scale-95"
                  />
                </div>
              </Card>

              {/* Card 3: Clearance Checklist Guidance */}
              <Card className="p-4 space-y-2.5 border-border shadow-2xs">
                <p className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-primary" />
                  Physical Approval Steps
                </p>

                <ol className="space-y-2 text-[11px] text-text-secondary">
                  <li className="flex items-start gap-2">
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">1</span>
                    <span>Download or print official unit registration form.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">2</span>
                    <span>Obtain Accounts Officer fee clearance & signature.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">3</span>
                    <span>Present form to HOD & Registrar for approvals.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">4</span>
                    <span>Submit filled copy to Registrar of Students.</span>
                  </li>
                </ol>
              </Card>

              {/* Card 4: Registered Units List Overview */}
              <Card className="p-4 space-y-3 border-border shadow-2xs">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                    <BookOpenCheck className="size-3.5 text-primary" />
                    Pre-Registered Units ({units.length})
                  </p>
                </div>

                <div className="divide-y divide-border max-h-60 overflow-y-auto pr-1">
                  {units.map((u) => (
                    <div key={u.unitCode} className="py-2 flex items-start justify-between gap-2 text-[11px]">
                      <div className="min-w-0">
                        <span className="font-bold font-mono text-text-primary">{u.unitCode}</span>
                        <p className="text-text-secondary truncate text-[10.5px]">{u.unitName}</p>
                      </div>
                      <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 mt-0.5" />
                    </div>
                  ))}
                </div>
              </Card>

              {context.submission?.verificationNote ? (
                <p className="text-[11px] text-text-muted italic px-1">
                  Department Note: {context.submission.verificationNote}
                </p>
              ) : null}
            </div>

            {/* Right Column: Centered A4 Unit Registration Form Preview */}
            <div className="xl:col-span-7 2xl:col-span-8 space-y-3">
              {/* Guidance Callout (Visible on top of preview) */}
              <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-subtle p-3 text-xs text-primary-deep print:hidden">
                <FileCheck2 className="size-4 shrink-0 text-primary mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-text-primary">Official Form Preview</p>
                    <Badge variant="neutral" className="text-[10px] font-mono bg-surface">A4 Single Page</Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-text-secondary leading-relaxed">
                    Pre-filled official document for <span className="font-bold">{context.student.fullName}</span>. Print or download as PDF for clearance signatures.
                  </p>
                </div>
              </div>

              {/* Complete Official A4 HTML Form Container */}
              <div className="rounded-xl border border-border bg-slate-100/80 p-2 sm:p-5 shadow-xs print:border-none print:bg-white print:p-0">
                <UnitRegistrationFormPreview context={context} />
              </div>
            </div>
          </div>
        )}
      </div>
    </StudentPortalShell>
  );
}
