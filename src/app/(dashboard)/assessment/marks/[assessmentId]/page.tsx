import { CheckCircle2, ClipboardCheck, Download, FileSpreadsheet } from 'lucide-react';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { getAssessmentById, getAssessmentPopulation } from '@/features/assessment/queries';
import { saveAssessmentAttendanceAction } from '@/features/assessment/marks/actions';
import { MarkUploadForm } from '@/features/assessment/marks/mark-upload-form';
import { getAssessmentResultCount } from '@/features/assessment/marks/queries';
import { getUnitMarkbookStage, unitMarkbookStageLabel } from '@/features/assessment/marks/workflow';
import { requireHodAccess } from '@/features/auth/authorization';

export default async function AssessmentMarkWorkflowPage({ params, searchParams }: { params: Promise<{ assessmentId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireHodAccess();
  const [{ assessmentId }, query] = await Promise.all([params, searchParams]);
  const [assessment, population, resultCount] = await Promise.all([getAssessmentById(assessmentId), getAssessmentPopulation(assessmentId), getAssessmentResultCount(assessmentId)]);
  if (!assessment) notFound();
  const absentCount = population.filter((row) => row.attendance_status === 'absent').length;
  const attendanceRecorded = Boolean(assessment.attendance_finalized_at);
  const catComplete = Boolean(assessment.cat_marks_finalized_at);
  const examComplete = Boolean(assessment.exam_marks_finalized_at);
  const stage = getUnitMarkbookStage({
    populationCount: population.length,
    catFinalizedAt: assessment.cat_marks_finalized_at,
    attendanceFinalizedAt: assessment.attendance_finalized_at,
    examFinalizedAt: assessment.exam_marks_finalized_at,
  });
  const stageLabel = unitMarkbookStageLabel(stage);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Unit markbook" title={`${assessment.unit?.code ?? 'Unit'} · ${assessment.unit?.name ?? ''}`} description={assessment.academic_period?.name ?? 'Academic period'} icon={FileSpreadsheet} context={<div className="flex gap-2"><Badge variant="neutral">{population.length} students</Badge><Badge variant={examComplete ? 'success' : catComplete ? 'institutional' : 'neutral'}>{stageLabel}</Badge></div>} />
      {query.attendance === 'saved' ? <p className="rounded-lg bg-success-subtle px-3 py-2 text-xs font-semibold text-success">Exam attendance saved. Download the refreshed workbook to get AB applied automatically.</p> : null}
      {query.imported ? <p className="rounded-lg bg-success-subtle px-3 py-2 text-xs font-semibold text-success">Workbook results saved successfully.</p> : null}
      {query.error ? <p className="rounded-lg bg-danger-subtle px-3 py-2 text-xs font-semibold text-danger">{query.error === 'locked' ? 'This unit markbook is complete and locked.' : query.error === 'cat-required' ? 'Commit the coursework/CAT workbook before recording final examination attendance.' : query.error === 'population' ? 'Build the unit population before continuing.' : query.error === 'batch' ? 'That upload preview is no longer valid. Upload the current workbook again.' : 'The requested action could not be completed.'}</p> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-sm font-bold text-text-primary">1. CAT marks</h2>
          <p className="mt-1 text-xs text-text-muted">Download one unit workbook. Each cohort has its own worksheet. Enter the available CAT/coursework marks, then upload the same workbook progressively through the semester.</p>
          <a href={`/api/assessment/${assessment.id}/marks-workbook`} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-institutional-yellow px-3 text-xs font-semibold text-institutional-yellow-ink hover:brightness-95"><Download className="size-3.5" />Download unit workbook</a>
          {!attendanceRecorded && !examComplete ? <div className="mt-4"><MarkUploadForm assessmentId={assessment.id} /></div> : null}
          {catComplete ? <p className="mt-2 flex items-center gap-1.5 text-[0.6875rem] font-semibold text-success"><CheckCircle2 className="size-3.5" />CAT marks stored. The same workbook structure will be used for the final exam.</p> : null}
        </Card>

        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-sm font-bold text-text-primary">2. Final exam attendance</h2><p className="mt-1 text-xs text-text-muted">Use the physical signing sheet. Tick only students who did not sign.</p></div>
            <a href={`/api/assessment/${assessment.id}/attendance-sheet`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary"><Download className="size-3.5" />Attendance sheet</a>
          </div>
          {catComplete ? <form action={saveAssessmentAttendanceAction} className="mt-4 space-y-3">
            <input type="hidden" name="assessmentId" value={assessment.id} />
            <div className="max-h-[330px] overflow-auto rounded-xl border border-border">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="sticky top-0 bg-surface-subtle text-text-muted"><tr><th className="px-3 py-2 font-semibold">Absent</th><th className="px-3 py-2 font-semibold">Student</th><th className="px-3 py-2 font-semibold">Admission no.</th><th className="px-3 py-2 font-semibold">Cohort</th></tr></thead>
                <tbody className="divide-y divide-border">{population.map((row) => <tr key={row.id}><td className="px-3 py-2"><input type="checkbox" name="absentStudentId" value={row.student?.id ?? ''} defaultChecked={row.attendance_status === 'absent'} disabled={!row.student || examComplete} className="size-4 rounded border-border text-primary" /></td><td className="px-3 py-2 font-semibold text-text-primary">{row.student?.full_name ?? 'Unknown'}</td><td className="px-3 py-2 text-text-secondary">{row.student?.admission_number ?? '—'}</td><td className="px-3 py-2 text-text-secondary">{row.cohort?.name ?? '—'}</td></tr>)}</tbody>
              </table>
            </div>
            {!examComplete ? <div className="flex justify-end"><button type="submit" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-xs font-semibold text-white hover:bg-primary-hover"><ClipboardCheck className="size-3.5" />Save exam attendance</button></div> : null}
          </form> : <div className="mt-4 rounded-lg bg-surface-subtle px-3 py-3 text-xs text-text-muted">Commit the coursework/CAT workbook first. Exam attendance will open automatically.</div>}
          {attendanceRecorded ? <p className="mt-2 text-[0.6875rem] text-text-muted">{absentCount} student(s) recorded absent.</p> : null}
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-sm font-bold text-text-primary">3. Final exam results</h2><p className="mt-1 text-xs text-text-muted">After attendance, download the refreshed workbook. CAT marks are retained and absent students are automatically marked AB. Fill the remaining columns and upload.</p></div>
          <a aria-disabled={!attendanceRecorded} href={attendanceRecorded ? `/api/assessment/${assessment.id}/marks-workbook` : undefined} className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold ${attendanceRecorded ? 'bg-institutional-yellow text-institutional-yellow-ink hover:brightness-95' : 'cursor-not-allowed bg-surface-subtle text-text-muted'}`}><Download className="size-3.5" />Download final workbook</a>
        </div>
        <div className="mt-4 max-w-xl">{attendanceRecorded && !examComplete ? <MarkUploadForm assessmentId={assessment.id} /> : examComplete ? <div className="rounded-lg bg-success-subtle px-3 py-3 text-xs font-semibold text-success">Final results completed for this unit.</div> : <div className="rounded-lg bg-surface-subtle px-3 py-3 text-xs text-text-muted">Save exam attendance before the final upload.</div>}</div>
        {resultCount ? <p className="mt-2 text-[0.6875rem] text-text-muted">{resultCount} student result record(s) currently stored.</p> : null}
      </Card>
    </div>
  );
}
