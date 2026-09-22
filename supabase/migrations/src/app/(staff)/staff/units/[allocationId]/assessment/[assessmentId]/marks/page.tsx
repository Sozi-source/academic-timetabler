import { Keyboard } from 'lucide-react';
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

  const isUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      assessmentId,
    );
  const targetAssessmentId =
    isUUID
      ? assessmentId
      : `alloc-${allocationId}`;

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
        targetAssessmentId,
      ),

      getStaffOnlineMarkState(
        targetAssessmentId,
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
        title="Enter marks"
        description={`${access.allocation.unitName} · ${access.allocation.cohortName}`}
      />



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
          population.assessmentId
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
