import { notFound, redirect } from 'next/navigation';

import { PageHeader } from '@/components/ui/page-header';
import { getAssessmentPopulationWorkspace } from '@/features/assessment/population-workspace';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { OnlineMarksEditor } from '@/features/staff-assessment/online-marks-editor';
import {
  getStaffOnlineMarkComponentSubmissions,
  getStaffOnlineMarkState,
} from '@/features/staff-assessment/online-marks-query';
import {
  requireStaffAllocation,
  requireStaffAssessment,
} from '@/features/staff-assessment/queries';

interface PageProps {
  params: Promise<{ allocationId: string; assessmentId: string }>;
}

export default async function ExternalTrainerMarksPage({ params }: PageProps) {
  const profile = await requireTrainerAccess();
  const { allocationId, assessmentId } = await params;
  const allocationContext = await requireStaffAllocation({ profileId: profile.id, allocationId });

  if (!allocationContext) notFound();

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assessmentId);
  const targetAssessmentId = isUUID ? assessmentId : `alloc-${allocationId}`;

  const [access, population, markState, componentSubmissions] = await Promise.all([
    requireStaffAssessment({ profileId: profile.id, allocationId, assessmentId }),
    getAssessmentPopulationWorkspace(targetAssessmentId),
    getStaffOnlineMarkState(targetAssessmentId),
    getStaffOnlineMarkComponentSubmissions(targetAssessmentId),
  ]);

  if (!isUUID && population.assessmentId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(population.assessmentId)) {
    redirect(`/external-trainer/units/${allocationId}/assessment/${population.assessmentId}/marks`);
  }

  if (!access || access.assessment.type !== 'exam') notFound();

  const marksByStudent = new Map(markState.map((item) => [item.studentId, item]));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${access.allocation.unitCode} · ${population.cohort?.name || access.allocation.cohortName}`}
        title="Enter marks"
        description={access.allocation.unitName}
        backHref="/external-trainer/units"
        backLabel="My Units"
      />
      {access.assessment.maximumMark !== 100 ? (
        <section className="rounded-xl border border-warning-border bg-warning-surface px-4 py-3">
          <p className="text-xs leading-5 text-warning-ink">
            The final Exam assessment rule must use maximum 100 before online marks can be saved or submitted. Current maximum: {access.assessment.maximumMark ?? 'not configured'}.
          </p>
        </section>
      ) : null}
      <OnlineMarksEditor
        assessmentId={population.assessmentId}
        trainerEntryOpen={population.trainerEntryOpen}
        workflowStatus={population.workflowStatus}
        componentSubmissions={componentSubmissions}
        showStudentCohort={false}
        students={population.students.map((student) => {
          const state = marksByStudent.get(student.studentId);
          return {
            studentId: student.studentId,
            admissionNumber: student.admissionNumber,
            fullName: student.fullName,
            cohortName: student.cohortName,
            cohortId: student.cohortId ?? null,
            attendanceStatus: student.attendanceStatus,
            catAbsent: state?.catAbsent ?? false,
            initialMarks: {
              assignment: state?.assignment ?? null,
              presentation: state?.presentation ?? null,
              rat: state?.rat ?? null,
              cat: state?.cat ?? null,
              exam: student.attendanceStatus === 'absent' ? null : state?.exam ?? null,
            },
          };
        })}
      />
    </div>
  );
}
