import { BookOpenCheck, KeyRound, Pencil, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RecordShell } from '@/components/ui/record-shell';
import { requireHodAccess } from '@/features/auth/authorization';
import { EditAdmissionNumberDialog } from '@/features/students/edit-admission-number-dialog';
import {
  getRegistryCohortOptions,
  getStudentActiveReportingStatus,
  getStudentById,
} from '@/features/students/queries';
import { ReassignCohortDialog } from '@/features/students/reassign-cohort-dialog';
import { ResetStudentPasswordDialog } from '@/features/students/reset-student-password-dialog';
import {
  getStatusBadgeVariant,
  getStudentStatusLabel,
} from '@/features/students/student-status-stage';

export default async function StudentRecordLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ studentId: string }>;
}) {
  await requireHodAccess();
  const { studentId } = await params;
  const student = await getStudentById(studentId);
  if (!student) notFound();

  const [reportingStatus, cohorts] = await Promise.all([
    getStudentActiveReportingStatus(student.id),
    getRegistryCohortOptions(),
  ]);

  const base = `/students/registry/${student.id}`;
  const cohortName =
    student.current_cohort?.name ??
    student.admission_cohort?.name ??
    'No cohort';

  return (
    <RecordShell
      title={student.full_name}
      subtitle={`${student.admission_number} · ${student.programme?.code ?? 'Programme'} · ${cohortName}`}
      status={{
        label: getStudentStatusLabel(
          student.lifecycle_status,
          student.academic_phase,
        ),
        variant: getStatusBadgeVariant(
          student.lifecycle_status,
          student.academic_phase,
        ),
      }}
      tabs={[
        { key: 'overview', label: 'Overview', href: base },
        {
          key: 'classes',
          label: 'Class assignments',
          href: `${base}/class-assignments`,
        },
        { key: 'results', label: 'Results', href: `${base}/results` },
        { key: 'portal', label: 'Student view', href: `${base}/portal-view` },
      ]}
      actions={
        <>
          {reportingStatus === 'reported' ? (
            <Badge variant="success">Reported</Badge>
          ) : null}
          <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:items-center sm:gap-2">
            {student.academic_phase !== 'attachment' ? (
              <Link
                href={`/students/unit-registration/register/${student.id}`}
                className="inline-flex h-8 w-full items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold text-text-secondary shadow-2xs transition hover:bg-surface-subtle active:scale-95 sm:w-auto"
              >
                <BookOpenCheck className="size-3.5 text-primary" />
                <span>Unit Reg</span>
              </Link>
            ) : null}
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
                  className="h-8 w-full cursor-pointer justify-center whitespace-nowrap px-2.5 text-xs font-semibold shadow-2xs sm:w-auto"
                >
                  <UsersRound className="mr-1 size-3.5" />
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
                  className="h-8 w-full cursor-pointer justify-center whitespace-nowrap px-2.5 text-xs font-semibold shadow-2xs sm:w-auto"
                >
                  <Pencil className="mr-1 size-3.5" />
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
                  className="h-8 w-full cursor-pointer justify-center whitespace-nowrap px-2.5 text-xs font-semibold shadow-2xs sm:w-auto"
                >
                  <KeyRound className="mr-1 size-3.5" />
                  <span>Reset Pwd</span>
                </Button>
              }
            />
          </div>
        </>
      }
    >
      {children}
    </RecordShell>
  );
}
