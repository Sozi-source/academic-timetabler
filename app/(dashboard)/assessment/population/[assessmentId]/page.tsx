import {
  UsersRound,
} from 'lucide-react';
import {
  notFound,
} from 'next/navigation';

import {
  Badge,
} from '@/components/ui/badge';
import {
  Card,
} from '@/components/ui/card';
import {
  PageHeader,
} from '@/components/ui/page-header';
import {
  requireHodAccess,
} from '@/features/auth/authorization';
import {
  AssessmentTypeControl,
  DownloadAssessmentMarkbookButton,
} from '@/features/assessment/markbook-controls';
import {
  AssessmentWorkbookValidationControl,
  DownloadAssessmentSigningSheetButton,
} from '@/features/assessment/assessment-document-controls';
import {
  StageAssessmentMarkbookControl,
} from '@/features/assessment/markbook-stage-control';
import {
  AssessmentAbsenceButton,
  GenerateAssessmentPopulationButton,
} from '@/features/assessment/population-workspace-controls';
import {
  getAssessmentPopulationWorkspace,
} from '@/features/assessment/population-workspace';

interface PageProps {
  params: Promise<{
    assessmentId: string;
  }>;
}

function formatAssessmentType(
  value:
    | 'cat'
    | 'exam'
    | null,
): string {
  if (value === 'cat') {
    return 'CAT';
  }

  if (value === 'exam') {
    return 'Exam';
  }

  return 'Assessment';
}

export default async function AssessmentPopulationPage({
  params,
}: PageProps) {
  await requireHodAccess();

  const {
    assessmentId,
  } = await params;

  let workspace;

  try {
    workspace =
      await getAssessmentPopulationWorkspace(
        assessmentId,
      );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        'Assessment was not found.'
    ) {
      notFound();
    }

    throw error;
  }

  const locked =
    Boolean(
      workspace.populationLockedAt,
    ) ||
    [
      'submitted',
      'finalised',
      'archived',
    ].includes(
      workspace.workflowStatus ??
        '',
    );

  const hasPopulation =
    workspace.registeredPopulation >
    0;

  const canDownload =
    hasPopulation &&
    workspace.assessmentType !==
      null;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Assessment"
        title="Assessment population"
        description="Confirm the registered roster, record assessment absences, then download the CAT or Exam markbook."
        icon={UsersRound}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-text-primary">
              {
                workspace.unit.name
              }
            </p>

            <p className="mt-1 text-xs text-text-muted">
              {formatAssessmentType(
                workspace.assessmentType,
              )}
              {' Â· '}
              {workspace.cohort
                ?.name ??
                'All participating cohorts'}
              {' Â· '}
              {
                workspace
                  .academicPeriod
                  .name
              }
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {
                workspace.registeredPopulation
              } registered
            </Badge>

            <Badge variant="success">
              {
                workspace.expectedToSit
              } expected
            </Badge>

            <Badge
              variant={
                workspace.markedAbsent >
                0
                  ? 'neutral'
                  : 'success'
              }
            >
              {
                workspace.markedAbsent
              } absent
            </Badge>

            {locked ? (
              <Badge variant="neutral">
                Roster locked
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-border bg-surface-subtle/40 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-text-muted">
              Type
            </span>

            <AssessmentTypeControl
              assessmentId={
                workspace.assessmentId
              }
              value={
                workspace.assessmentType
              }
              disabled={
                locked
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!locked ? (
              <GenerateAssessmentPopulationButton
                assessmentId={
                  workspace.assessmentId
                }
                hasPopulation={
                  hasPopulation
                }
              />
            ) : null}

            <DownloadAssessmentMarkbookButton
              assessmentId={
                workspace.assessmentId
              }
              unitName={
                workspace.unit.name
              }
              disabled={
                !canDownload
              }
            />

            <DownloadAssessmentSigningSheetButton
              assessmentId={
                workspace.assessmentId
              }
              unitName={
                workspace.unit.name
              }
              assessmentType={
                workspace.assessmentType
              }
              disabled={
                !canDownload
              }
            />

            <AssessmentWorkbookValidationControl
              assessmentId={
                workspace.assessmentId
              }
              disabled={
                !locked
              }
            />

            <StageAssessmentMarkbookControl
              assessmentId={
                workspace.assessmentId
              }
              disabled={
                !locked
              }
            />
          </div>
        </div>

        {!hasPopulation ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-text-primary">
              Population not generated
            </p>

            <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-text-muted">
              Generate the population from
              registered students for this
              unit and Academic Period.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-surface-subtle text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
                <tr>
                  <th className="px-4 py-2.5">
                    Student
                  </th>

                  <th className="px-4 py-2.5 whitespace-nowrap">
                    Admission No.
                  </th>

                  <th className="px-4 py-2.5">
                    Status
                  </th>

                  <th className="px-4 py-2.5 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {workspace.students.map(
                  (
                    student,
                  ) => (
                    <tr
                      key={
                        student.populationId
                      }
                      className="bg-white"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary">
                          {
                            student.fullName
                          }
                        </p>
                      </td>

                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap font-mono">
                        {
                          student.admissionNumber
                        }
                      </td>

                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            student
                              .attendanceStatus ===
                            'absent'
                              ? 'neutral'
                              : 'success'
                          }
                        >
                          {student
                            .attendanceStatus ===
                          'absent'
                            ? 'Absent'
                            : 'Expected'}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <AssessmentAbsenceButton
                          assessmentId={
                            workspace.assessmentId
                          }
                          studentId={
                            student.studentId
                          }
                          isAbsent={
                            student
                              .attendanceStatus ===
                            'absent'
                          }
                          disabled={
                            locked
                          }
                        />
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-[11px] leading-5 text-text-muted">
        Everyone is expected by default.
        Record only confirmed absences.
        The first markbook download locks
        this roster so later registration
        changes cannot silently alter the
        assessment record.
      </p>
    </div>
  );
}
