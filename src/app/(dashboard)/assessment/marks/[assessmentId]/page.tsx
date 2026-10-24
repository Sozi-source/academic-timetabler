import { ArrowLeft, BarChart3, CheckCircle2, FileSpreadsheet, FileText, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { DownloadAssessmentMarkbookButton } from '@/features/assessment/markbook-controls';
import { BulkUploadDialog } from '@/features/assessment/marks/bulk-upload-dialog';
import { TrainerMarkInvites } from '@/features/assessment/trainer-mark-invites';
import { getAssessmentById, getAssessmentPopulation } from '@/features/assessment/queries';
import { unlockAssessmentMarkComponentAction } from '@/features/assessment/marks/actions';
import { getAssessmentMarkComponentSubmissions, getAssessmentResultCount } from '@/features/assessment/marks/queries';
import { requireHodAccess } from '@/features/auth/authorization';

export default async function AssessmentMarkWorkflowPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  await requireHodAccess();
  const { assessmentId } = await params;
  const [assessment, population, resultCount, componentSubmissionState] = await Promise.all([
    getAssessmentById(assessmentId),
    getAssessmentPopulation(assessmentId),
    getAssessmentResultCount(assessmentId),
    getAssessmentMarkComponentSubmissions(assessmentId),
  ]);

  if (!assessment) notFound();

  const isComplete = Boolean(
    assessment.exam_marks_finalized_at || assessment.status === 'closed',
  );
  const marksSubmitted = Boolean(assessment.marks_submitted_at);
  const isDraft = !isComplete && !marksSubmitted && resultCount > 0;

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <PageHeader
        title={`${assessment.unit?.code ?? 'Unit'} · ${assessment.unit?.name ?? ''}`}
        description={`${assessment.academic_period?.name ?? 'Academic period'} · Unit Markbook`}
        icon={FileSpreadsheet}
        context={
          <div className="flex items-center gap-2">
            <Badge variant="neutral">{population.length} Candidates</Badge>
            {isComplete ? (
              <Badge variant="neutral" className="bg-slate-100 text-slate-800">
                Finalized
              </Badge>
            ) : marksSubmitted ? (
              <Badge variant="neutral" className="bg-green-50 text-green-800">
                Marks Submitted
              </Badge>
            ) : isDraft ? (
              <Badge variant="neutral" className="bg-slate-100 text-slate-700">
                In Progress ({resultCount})
              </Badge>
            ) : (
              <Badge variant="neutral" className="text-slate-400">
                Pending Marks
              </Badge>
            )}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/assessment"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <ArrowLeft className="size-3.5 text-slate-500" />
              <span>All Units</span>
            </Link>
            <Link
              href={`/assessment/analysis/${assessment.id}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <BarChart3 className="size-3.5 text-slate-500" />
              <span>Unit Analysis</span>
            </Link>
            <Link
              href={`/assessment/population/${assessment.id}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <UsersRound className="size-3.5 text-slate-500" />
              <span>Assessment Population</span>
            </Link>
            {!isComplete && !marksSubmitted ? (
              <BulkUploadDialog
                assessmentId={assessment.id}
                unitName={assessment.unit?.name ?? 'Unit Marksheet'}
                mode="admin"
              />
            ) : null}
            <DownloadAssessmentMarkbookButton
              assessmentId={assessment.id}
              unitName={assessment.unit?.name ?? 'Unit Marksheet'}
              disabled={population.length === 0}
              marksSubmitted={marksSubmitted || isComplete}
            />
          </div>
        }
      />

      {!isComplete ? <TrainerMarkInvites assessmentId={assessment.id} /> : null}

      {componentSubmissionState.submissions.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Submitted mark components</h2>
            <p className="mt-1 text-xs leading-5 text-text-muted">
              Unlock a submitted component for correction. Its saved marks remain in place and become editable again.
            </p>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {componentSubmissionState.submissions.map((submission) => {
              const cohort = Array.isArray(submission.cohort) ? submission.cohort[0] : submission.cohort;
              const componentLabel = submission.component_key.toUpperCase();
              const cohortLabel = cohort?.code || cohort?.name || 'All cohorts';
              return (
                <li key={submission.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                  <p className="text-xs text-text-primary">
                    <span className="font-semibold">{componentLabel}</span>
                    <span className="text-text-muted"> Â· {cohortLabel}</span>
                  </p>
                  <form action={unlockAssessmentMarkComponentAction}>
                    <input type="hidden" name="assessmentId" value={assessment.id} />
                    <input type="hidden" name="cohortId" value={submission.cohort_id ?? 'all'} />
                    <input type="hidden" name="component" value={submission.component_key} />
                    <button
                      type="submit"
                      disabled={!componentSubmissionState.canUnlock}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-warning-border bg-warning-surface px-3 text-xs font-semibold text-warning-ink transition hover:bg-warning-surface/70 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Unlock {componentLabel}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
          {!componentSubmissionState.canUnlock ? (
            <p className="text-[11px] text-text-muted">This markbook has been finalized and cannot be reopened from this control.</p>
          ) : null}
        </section>
      ) : null}

      {/* Summary Telemetry */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <UsersRound className="size-4" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Candidates
            </p>
            <p className="text-sm font-bold text-slate-900">
              {population.length} Registered
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <CheckCircle2 className="size-4" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Recorded Results
            </p>
            <p className="text-sm font-bold text-slate-900">
              {resultCount} / {population.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <FileText className="size-4" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Markbook Mode
            </p>
            <p className="text-sm font-bold text-slate-900">
              Live Online Entry
            </p>
          </div>
        </div>
      </div>

      {/* Candidates Roster */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Registered Candidates ({population.length})
          </h2>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
              <tr>
                <th className="w-12 px-3.5 py-2.5 text-center">No.</th>
                <th className="px-3 py-2.5">Admission No.</th>
                <th className="px-3 py-2.5">Student Full Name</th>
                <th className="px-3 py-2.5">Cohort</th>
                <th className="px-3 py-2.5 text-center">Exam Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {population.map((row, idx) => {
                const isAbsent = row.attendance_status === 'absent';
                return (
                  <tr key={row.id} className="transition hover:bg-slate-50/50">
                    <td className="px-3.5 py-2.5 text-center font-medium text-slate-400">
                      {idx + 1}.
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                      {row.student?.admission_number ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {row.student?.full_name ?? 'Unknown Student'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {row.cohort?.name ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {isAbsent ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          Absent (AB)
                        </span>
                      ) : (
                        <span className="rounded bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          Expected / Sat
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
