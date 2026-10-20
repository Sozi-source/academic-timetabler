import Link from 'next/link';
import { ArrowLeft, BookOpenCheck, CheckCircle2 } from 'lucide-react';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { registerStudentUnitsByDepartment } from '@/features/student-unit-registration/actions';
import { getDepartmentRegistrationEditor } from '@/features/student-unit-registration/queries';
import { StudentUnitRegistrationLines } from '@/features/student-unit-registration/student-unit-registration-lines';

interface PageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string; stage_updated?: string; cohort?: string | string[] }>;
}

export default async function DepartmentStudentUnitRegistrationPage({
  params,
  searchParams,
}: PageProps) {
  await requireHodAccess();
  const { studentId } = await params;
  const query = await searchParams;
  const context = await getDepartmentRegistrationEditor(studentId);
  const cohort = typeof query.cohort === 'string' ? query.cohort : null;
  const studentListHref = `/students/unit-registration${cohort ? `?cohort=${encodeURIComponent(cohort)}` : ''}`;

  if (!context) notFound();

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Unit registration"
        title={context.student.fullName}
        description={`${context.student.admissionNumber} · ${context.student.programmeCode} · ${context.student.cohortName}`}
        icon={BookOpenCheck}
        context={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="institutional">{context.period.name}</Badge>
            <Badge variant={context.existingStatus === 'verified' ? 'success' : 'neutral'}>
              {context.existingStatus === 'verified' ? 'Verified' : 'Pending Verification'}
            </Badge>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/students/registry/${studentId}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle transition"
            >
              <span>Student Profile</span>
            </Link>
            <Link
              href={studentListHref}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle transition"
            >
              <ArrowLeft className="size-4" />
              <span>Back to Student List</span>
            </Link>
          </div>
        }
      />

      {query.saved === '1' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50/90 px-4 py-3 text-emerald-900 shadow-2xs dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-xs font-bold">Unit registration saved &amp; verified successfully!</p>
              <p className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                The student&apos;s unit registrations are active and verified. You can review or adjust selections below, or return to the student list when finished.
              </p>
            </div>
          </div>
          <Link
            href={studentListHref}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-bold text-emerald-900 shadow-2xs hover:bg-emerald-100/50 transition active:scale-95"
          >
            <ArrowLeft className="size-3.5" />
            Back to Student List
          </Link>
        </div>
      ) : null}

      {query.deleted === '1' ? (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">Unit registration deleted.</p>
      ) : null}

      {query.stage_updated === '1' ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50/90 p-3 text-blue-900 shadow-2xs dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
          <CheckCircle2 className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-xs font-semibold">Academic stage updated. Expected stage units refreshed below.</p>
        </div>
      ) : null}

      {query.error ? (
        <p className="rounded-lg bg-danger-subtle px-3 py-2 text-xs font-semibold text-danger">
          {query.error === 'units' ? 'Select at least one unit.' : decodeURIComponent(query.error)}
        </p>
      ) : null}

      <Card className="p-4">
        <h2 className="text-sm font-medium text-text-primary">Manage unit registrations</h2>
        <p className="mb-4 mt-1 text-xs text-text-muted">Review the student&apos;s registered units across academic periods, then add units for the active period.</p>
        <form action={registerStudentUnitsByDepartment} className="space-y-4">
          <input type="hidden" name="studentId" value={context.student.id} />
          {cohort ? <input type="hidden" name="returnCohort" value={cohort} /> : null}
          <StudentUnitRegistrationLines context={context} />
          <div className="flex justify-end"><Button type="submit"><CheckCircle2 className="size-4" />Register selected units</Button></div>
        </form>
      </Card>
    </div>
  );
}
