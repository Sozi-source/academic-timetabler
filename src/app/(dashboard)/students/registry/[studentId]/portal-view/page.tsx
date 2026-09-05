import {
  ArrowLeft,
  BookOpenCheck,
  Download,
  Eye,
  FileCheck2,
  GraduationCap,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PrintActionButton } from '@/components/ui/print-action-button';
import { requireHodAccess } from '@/features/auth/authorization';
import {
  activeStudentUnits,
  studentRegistrationLabel,
} from '@/features/student-portal/domain';
import { getStudentPortalRegistrationContext } from '@/features/student-portal/queries';
import { UnitRegistrationFormPreview } from '@/features/student-unit-registration/unit-registration-form-preview';

export default async function AdminStudentPortalViewPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  await requireHodAccess();
  const { studentId } = await params;

  const context = await getStudentPortalRegistrationContext(studentId);

  if (!context || !context.student) {
    notFound();
  }

  const units = activeStudentUnits(context.units);

  return (
    <div className="space-y-4">
      {/* Top Admin Banner Notice */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-950 shadow-2xs print:hidden">
        <div className="flex items-center gap-2.5">
          <Eye className="size-4 text-sky-700 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">Admin Mode: Viewing Student Portal</p>
            <p className="text-[11px] text-sky-800">
              You are currently inspecting the student portal view for{' '}
              <span className="font-bold text-sky-950">{context.student.fullName}</span> (
              {context.student.admissionNumber}).
            </p>
          </div>
        </div>

        <Link
          href={`/students/registry/${context.student.id}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-sky-900 px-3 text-xs font-bold text-white shadow-2xs transition hover:bg-sky-950 active:scale-95"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Student Record</span>
        </Link>
      </div>

      {/* Header */}
      <PageHeader
        eyebrow={context.student.admissionNumber}
        title={context.student.fullName}
        description={`${context.student.programmeCode} · ${context.student.cohortName ?? 'Cohort'} · ${context.period?.name ?? 'Academic period'}`}
        icon={GraduationCap}
        context={
          <div className="flex items-center gap-2">
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
            <Badge variant={context.reportingStatus === 'reported' ? 'success' : 'warning'}>
              {context.reportingStatus === 'reported' ? 'Reporting Confirmed' : 'Reporting Pending'}
            </Badge>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Link
              href={`/students/registry/${context.student.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
            >
              <UserRound className="size-3.5" />
              Student Record
            </Link>
            <PrintActionButton label="Print / Save PDF" />
            <a
              href={`/api/student/unit-registration/form?studentId=${context.student.id}`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-bold text-white shadow-2xs transition hover:bg-primary-hover active:scale-95"
            >
              <Download className="size-3.5" />
              <span>Download Prefilled Form (.docx)</span>
            </a>
          </div>
        }
      />

      {/* Main Student Portal View Content */}
      {!context.period ? (
        <EmptyState
          icon={BookOpenCheck}
          title="No active academic period"
          description="Activate an academic period to view student registrations."
        />
      ) : units.length === 0 ? (
        <EmptyState
          icon={BookOpenCheck}
          title="No registered units"
          description="This student has no pre-registered units for the active academic period."
        />
      ) : (
        <div className="space-y-4">
          {/* Guidance Callout */}
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-subtle p-3.5 text-xs text-primary-deep print:hidden">
            <FileCheck2 className="size-4 shrink-0 text-primary mt-0.5" />
            <div>
              <p className="font-bold text-text-primary">Student Portal View & Prefilled Form</p>
              <p className="mt-0.5 text-[11px] text-text-secondary leading-relaxed">
                This is the exact view seen by <span className="font-bold">{context.student.fullName}</span> in their student portal. The prefilled unit registration form can be printed or downloaded as an official .docx document.
              </p>
            </div>
          </div>

          {/* Full-Page Official HTML Form Preview */}
          <div className="rounded-xl border border-border bg-surface-subtle p-2 sm:p-6 print:border-none print:bg-white print:p-0">
            <UnitRegistrationFormPreview context={context} />
          </div>
        </div>
      )}
    </div>
  );
}
