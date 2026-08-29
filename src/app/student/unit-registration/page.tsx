import {
  ClipboardCheck,
  Download,
} from 'lucide-react';
import { redirect } from 'next/navigation';

import { StudentPortalShell } from '@/components/student/student-portal-shell';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  activeStudentUnits,
  studentRegistrationLabel,
} from '@/features/student-portal/domain';
import { getStudentPortalRegistrationContext } from '@/features/student-portal/queries';
import { getStudentPortalSession } from '@/features/student-portal/session';
import { StudentRegistrationUnitList } from '@/features/student-portal/unit-registration-form';

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
            description="No units are registered for this period."
          />
        ) : (
          <>
            {/* Unified Elegant Header Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-bold text-slate-900">
                      Unit Registration
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
                        ? 'Reporting confirmed'
                        : 'Reporting pending'}
                    </Badge>
                  </div>

                  <p className="mt-0.5 text-xs text-slate-500">
                    {context.period?.name ?? 'Academic period'} · {units.length} Assigned Units
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-700">
                    <span className="font-bold text-slate-900">{context.student.fullName}</span>
                    <span className="text-slate-300">|</span>
                    <span className="font-medium text-slate-600">{context.student.admissionNumber}</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-600">{context.student.cohortName ?? 'Cohort'}</span>
                  </div>
                </div>

                <div className="flex flex-col items-start sm:items-end gap-1">
                  <a
                    href="/api/student/unit-registration/form"
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-slate-800"
                  >
                    <Download className="size-3.5" />
                    <span>Download Form (.docx)</span>
                  </a>
                  <span className="text-[11px] text-slate-400">
                    For clearance desk approvals
                  </span>
                </div>
              </div>
            </div>

            {/* Units Roster */}
            <StudentRegistrationUnitList units={units} />

            {context.submission?.verificationNote ? (
              <p className="text-[11px] text-slate-500">
                Department note: {context.submission.verificationNote}
              </p>
            ) : null}
          </>
        )}
      </div>
    </StudentPortalShell>
  );
}
