import Link from 'next/link';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { getStudentPortalRegistrationContext } from '@/features/student-portal/queries';
import { UnitRegistrationFormPreview } from '@/features/student-unit-registration/unit-registration-form-preview';

interface PageProps {
  params: Promise<{ studentId: string }>;
}

export default async function UnitRegistrationPreviewPage({ params }: PageProps) {
  await requireHodAccess();
  const { studentId } = await params;
  const context = await getStudentPortalRegistrationContext(studentId);
  const registeredUnits = context?.units.filter((unit) => unit.registrationStatus === 'registered') ?? [];

  if (!context?.period || registeredUnits.length === 0) notFound();

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <PageHeader
          eyebrow="Unit registration"
          title="Form preview"
          description={`${context.student.fullName} · ${context.student.admissionNumber}`}
          icon={FileText}
          actions={(
            <>
              <Link
                href="/students/unit-registration"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
              >
                <ArrowLeft className="size-3.5" />
                Back to registrations
              </Link>
              <a
                href={`/api/students/unit-registration/${studentId}/form`}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                <Download className="size-3.5" />
                Download Word form
              </a>
            </>
          )}
        />
        <p className="rounded-lg border border-border bg-surface-subtle px-3 py-2 text-xs text-text-muted">
          This preview matches the one-page registration form issued to the student.
        </p>
      </div>

      <UnitRegistrationFormPreview context={context} />
    </div>
  );
}
