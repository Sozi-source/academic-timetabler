import {
  ArrowLeft,
  Keyboard,
} from 'lucide-react';
import Link from 'next/link';
import {
  notFound,
} from 'next/navigation';

import {
  Badge,
} from '@/components/ui/badge';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  getAssessmentPopulationWorkspace,
} from '@/features/assessment/population-workspace';
import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  OnlineMarksEditor,
} from '@/features/staff-assessment/online-marks-editor';
import {
  getStaffOnlineMarkState,
} from '@/features/staff-assessment/online-marks-query';
import {
  requireStaffAssessment,
} from '@/features/staff-assessment/queries';

interface PageProps {
  params:
    Promise<{
      allocationId:
        string;
      assessmentId:
        string;
    }>;
}

export default async function StaffOnlineMarksPage({
  params,
}: PageProps) {
  const profile =
    await requireTrainerAccess();

  const {
    allocationId,
    assessmentId,
  } =
    await params;

  const [
    access,
    population,
    markState,
  ] =
    await Promise.all([
      requireStaffAssessment({
        profileId:
          profile.id,
        allocationId,
        assessmentId,
      }),

      getAssessmentPopulationWorkspace(
        assessmentId,
      ),

      getStaffOnlineMarkState(
        assessmentId,
      ),
    ]);

  if (
    !access ||
    access.assessment.type !==
      'exam'
  ) {
    notFound();
  }

  const byStudent =
    new Map(
      markState.map(
        (item) => [
          item.studentId,
          item,
        ],
      ),
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="My Units · Final marks"
        title="Online marks"
        description={`${access.allocation.unitName} · ${access.allocation.cohortName}`}
        icon={Keyboard}
        actions={
          <Link
            href={`/staff/units/${allocationId}/assessment/${assessmentId}`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle"
          >
            <ArrowLeft
              className="size-3.5"
              aria-hidden="true"
            />
            Assessment
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">
          Assignment /5
        </Badge>

        <Badge variant="neutral">
          Presentation /10
        </Badge>

        <Badge variant="neutral">
          RAT /15
        </Badge>

        <Badge variant="neutral">
          CAT /15
        </Badge>

        <Badge variant="neutral">
          Exam /70
        </Badge>

        <Badge variant="institutional">
          Final /100
        </Badge>

        <Badge
          variant={
            population.populationLockedAt
              ? 'success'
              : 'warning'
          }
        >
          {population.populationLockedAt
            ? 'Roster locked'
            : 'Roster not locked'}
        </Badge>
      </div>

      {access.assessment.maximumMark !==
      100 ? (
        <section className="rounded-xl border border-warning-border bg-warning-surface px-4 py-3">
          <p className="text-[11px] leading-5 text-text-secondary">
            The final Exam assessment rule
            must use maximum 100 before
            online marks can be saved or
            submitted. Current maximum:{' '}
            {
              access.assessment.maximumMark ??
              'not configured'
            }.
          </p>
        </section>
      ) : null}

      <OnlineMarksEditor
        assessmentId={
          assessmentId
        }
        workflowStatus={
          population.workflowStatus
        }
        students={
          population.students.map(
            (student) => {
              const state =
                byStudent.get(
                  student.studentId,
                );

              return {
                studentId:
                  student.studentId,
                admissionNumber:
                  student.admissionNumber,
                fullName:
                  student.fullName,
                attendanceStatus:
                  student.attendanceStatus,
                initialMarks: {
                  assignment:
                    state?.assignment ??
                    null,
                  presentation:
                    state?.presentation ??
                    null,
                  rat:
                    state?.rat ??
                    null,
                  cat:
                    state?.cat ??
                    null,
                  exam:
                    student.attendanceStatus ===
                    'absent'
                      ? null
                      : state?.exam ??
                        null,
                },
              };
            },
          )
        }
      />
    </div>
  );
}
