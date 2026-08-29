import { ArrowLeft, BarChart3, CheckCircle2, FileSpreadsheet, FileText, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { getAssessmentById, getAssessmentPopulation } from '@/features/assessment/queries';
import { getAssessmentResultCount } from '@/features/assessment/marks/queries';
import { requireHodAccess } from '@/features/auth/authorization';

export default async function AssessmentMarkWorkflowPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  await requireHodAccess();
  const { assessmentId } = await params;
  const [assessment, population, resultCount] = await Promise.all([
    getAssessmentById(assessmentId),
    getAssessmentPopulation(assessmentId),
    getAssessmentResultCount(assessmentId),
  ]);

  if (!assessment) notFound();

  const isComplete = Boolean(
    assessment.exam_marks_finalized_at || assessment.status === 'closed',
  );
  const isDraft = !isComplete && resultCount > 0;

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
          </div>
        }
      />

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
