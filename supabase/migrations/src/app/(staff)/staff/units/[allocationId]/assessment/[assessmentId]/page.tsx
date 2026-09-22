import { ClipboardCheck } from 'lucide-react';
import {
  notFound,
} from 'next/navigation';

import {
  Badge,
} from '@/components/ui/badge';
import {
  MetricCard,
} from '@/components/ui/metric-card';
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
  requireStaffAssessment,
} from '@/features/staff-assessment/queries';
import {
  StaffAssessmentWorkflow,
} from '@/features/staff-assessment/staff-assessment-workflow';

interface PageProps {
  params: Promise<{
    allocationId: string;
    assessmentId: string;
  }>;
}

export default async function StaffAssessmentPage({
  params,
}: PageProps) {
  const profile =
    await requireTrainerAccess();

  const {
    allocationId,
    assessmentId,
  } = await params;

  const access =
    await requireStaffAssessment({
      profileId:
        profile.id,
      allocationId,
      assessmentId,
    });

  if (!access) {
    notFound();
  }

  const population =
    await getAssessmentPopulationWorkspace(
      assessmentId,
    );

  const assessment =
    access.assessment;

  const typeLabel =
    assessment.type ===
    'cat'
      ? 'CAT'
      : 'Exam';

  return (
    <div className="space-y-5">
      <PageHeader
        title={access.allocation.unitName}
        description={access.allocation.cohortName}
      />

      <section className="portal-metric-grid" data-columns="4">
        <MetricCard
          label="Registered"
          value={String(
            population.registeredPopulation,
          )}
          icon={ClipboardCheck}
          status="Roster"
        />

        <MetricCard
          label="Expected"
          value={String(
            population.expectedToSit,
          )}
          icon={ClipboardCheck}
          status="Attendance"
        />

        <MetricCard
          label="Absent"
          value={String(
            population.markedAbsent,
          )}
          icon={ClipboardCheck}
          status="Attendance"
        />

        <MetricCard
          label="Maximum"
          value={
            assessment.maximumMark ===
            null
              ? '—'
              : String(
                  assessment.maximumMark,
                )
          }
          description={
            assessment.passMark ===
            null
              ? 'Rule not configured'
              : `Pass ${assessment.passMark}`
          }
          icon={ClipboardCheck}
          status="Rule"
        />
      </section>

      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">
          {
            assessment.workflowStatus
          }
        </Badge>

        {assessment.rosterLocked ? (
          <Badge variant="success">
            Roster locked
          </Badge>
        ) : null}

        {assessment.published ? (
          <Badge variant="success">
            Published
          </Badge>
        ) : null}
      </div>

      <StaffAssessmentWorkflow
        allocationId={
          allocationId
        }
        assessmentId={
          assessmentId
        }
        unitName={
          access.allocation.unitName
        }
        assessmentType={
          assessment.type
        }
        workflowStatus={
          population.workflowStatus
        }
        populationLocked={
          Boolean(
            population.populationLockedAt,
          )
        }
        maximumMark={
          assessment.maximumMark
        }
        passMark={
          assessment.passMark
        }
        students={
          population.students.map(
            (
              student,
            ) => ({
              studentId:
                student.studentId,
              admissionNumber:
                student.admissionNumber,
              fullName:
                student.fullName,
              attendanceStatus:
                student.attendanceStatus,
            }),
          )
        }
      />
    </div>
  );
}
