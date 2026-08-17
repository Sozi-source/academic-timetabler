import { ArrowLeft, CheckCircle2, FileSpreadsheet, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { commitAssessmentMarksAction } from '@/features/assessment/marks/actions';
import { getAssessmentMarkImportBatch } from '@/features/assessment/marks/queries';
import { requireHodAccess } from '@/features/auth/authorization';

export default async function AssessmentMarkImportReviewPage({ params, searchParams }: { params: Promise<{ batchId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireHodAccess();
  const [{ batchId }, query] = await Promise.all([params, searchParams]);
  const result = await getAssessmentMarkImportBatch(batchId);
  if (!result) notFound();
  const completed = result.batch.status === 'completed';
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Excel marks" title={completed ? 'Import complete' : 'Review workbook'} description={`${result.batch.assessment?.unit?.code ?? 'Unit'} · ${result.batch.original_file_name}`} icon={FileSpreadsheet} context={<div className="flex gap-2"><Badge variant="success">{result.batch.valid_rows} ready</Badge>{result.batch.invalid_rows ? <Badge variant="danger">{result.batch.invalid_rows} invalid</Badge> : null}<Badge variant="neutral">{result.batch.sheet_count} sheets</Badge></div>} actions={<Link href={`/assessment/marks/${result.batch.assessment_event_id}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary"><ArrowLeft className="size-3.5" />Back</Link>} />
      {query.error ? <p className="rounded-lg bg-danger-subtle px-3 py-2 text-xs font-semibold text-danger">Marks could not be committed.</p> : null}
      {!completed ? <Card className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3">{result.batch.invalid_rows ? <TriangleAlert className="size-5 text-danger" /> : <CheckCircle2 className="size-5 text-success" />}<div><p className="text-sm font-bold text-text-primary">{result.batch.invalid_rows ? 'Fix workbook issues' : 'Workbook ready'}</p><p className="mt-0.5 text-xs text-text-muted">{result.batch.invalid_rows ? 'Download a fresh workbook or correct the listed cells, then upload again.' : 'All students and marks passed validation.'}</p></div></div>{result.batch.invalid_rows === 0 ? <form action={commitAssessmentMarksAction}><input type="hidden" name="batchId" value={result.batch.id} /><input type="hidden" name="assessmentId" value={result.batch.assessment_event_id} /><button type="submit" className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-xs font-semibold text-white hover:bg-primary-hover">Commit marks</button></form> : null}</div></Card> : null}
      <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs"><thead className="bg-surface-subtle text-text-muted"><tr><th className="px-4 py-2.5">Sheet</th><th className="px-3 py-2.5">Student</th><th className="px-3 py-2.5">Admission</th><th className="px-3 py-2.5">Total</th><th className="px-3 py-2.5">Grade</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Issue</th></tr></thead><tbody className="divide-y divide-border">{result.rows.map((row) => <tr key={row.id}><td className="px-4 py-2.5 text-text-secondary">{row.sheet_name}</td><td className="px-3 py-2.5 font-semibold text-text-primary">{row.student?.full_name ?? 'Unresolved'}</td><td className="px-3 py-2.5 text-text-secondary">{row.admission_number}</td><td className="px-3 py-2.5 font-semibold text-text-primary">{row.total_mark ?? '—'}</td><td className="px-3 py-2.5">{row.grade ?? '—'}</td><td className="px-3 py-2.5"><Badge variant={row.row_status === 'ready' ? 'success' : 'danger'}>{row.row_status}</Badge></td><td className="px-3 py-2.5 text-danger">{row.errors?.join(' ') || '—'}</td></tr>)}</tbody></table></div></Card>
    </div>
  );
}
