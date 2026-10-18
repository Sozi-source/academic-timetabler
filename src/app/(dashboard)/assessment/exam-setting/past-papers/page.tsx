import { Archive, FileUp, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import {
  commitExamImportBatchAction,
  importParsedPapersAction,
  reviewExamImportItemAction,
} from '@/features/exam-setting/import-actions';
import { getExamImportWorkspace } from '@/features/exam-setting/import-queries';
import { ExamSettingSteps } from '@/features/exam-setting/workflow-steps';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ERROR_MESSAGES: Record<string, string> = {
  closed: 'This import batch is already closed.',
  commit: 'The ready papers could not be imported. Check their unit matches and try again.',
  department: 'Select an active department before importing papers.',
  file: 'Choose a .jsonl parser output file under 45 MB.',
  format: 'The file is not valid exam-engine papers.jsonl output. Check each line and keep the file under 1,000 records.',
  invalid: 'The review request was invalid. Refresh the page and try again.',
  missing: 'That paper is no longer available in this batch.',
  save: 'The import could not be saved. The uploaded artifact was removed; please retry.',
  storage: 'The private exam-import storage bucket is unavailable. Apply the exam import review migration first.',
  unit: 'Select an active unit from the current department before marking this paper ready.',
  unusable: 'Only usable papers can be marked ready. Re-import a corrected parser output for papers with structural issues.',
};

function badgeVariant(status: string) {
  if (status === 'usable' || status === 'ready' || status === 'imported') return 'success' as const;
  if (status === 'usable_with_notes') return 'warning' as const;
  if (status === 'unreadable' || status === 'unread_parts' || status.startsWith('ignored:')) return 'danger' as const;
  return 'neutral' as const;
}

function guessUnitId(unitCode: string | null, units: Array<{ id: string; code: string }>) {
  if (!unitCode) return '';
  const normalized = unitCode.replace(/\s+/g, '').toLowerCase();
  return units.find((unit) => unit.code.replace(/\s+/g, '').toLowerCase() === normalized)?.id ?? '';
}

export default async function PastPaperImportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireHodAccess();
  const params = await searchParams;
  const requestedBatchId = typeof params.batchId === 'string' ? params.batchId : undefined;
  const workspace = await getExamImportWorkspace(requestedBatchId);
  const errorCode = typeof params.error === 'string' ? params.error : '';
  const importedCount = typeof params.imported === 'string' ? params.imported : null;
  const committedCount = typeof params.committed === 'string' ? params.committed : null;
  const itemStatus = typeof params.item === 'string' ? params.item : null;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Exam setting · Step 2 of 5"
        title="Past-paper import and review"
        description="Review parser results, match papers to department units, and register accepted source papers."
        icon={Archive}
        backHref="/assessment/exam-setting"
        backLabel="Blueprints"
        context={<Badge variant="info">{workspace.departmentName}</Badge>}
      />

      <ExamSettingSteps currentStep={2} />

      {workspace.migrationRequired ? (
        <p role="status" className="rounded-lg border border-warning-border bg-warning-surface px-4 py-3 text-xs text-warning">
          Apply <code>20261017220000_exam_paper_import_review.sql</code> with
          {' '}<code>npx supabase db push</code> before importing parser output.
        </p>
      ) : null}
      {!profile.activeDepartmentId ? (
        <p role="alert" className="rounded-lg border border-warning-border bg-warning-surface px-4 py-3 text-xs text-warning">
          Select an active department before importing papers.
        </p>
      ) : null}
      {errorCode && ERROR_MESSAGES[errorCode] ? (
        <p role="alert" className="rounded-lg border border-danger-border bg-danger-surface px-4 py-3 text-xs font-medium text-danger">
          {ERROR_MESSAGES[errorCode]}
        </p>
      ) : null}
      {importedCount ? (
        <p role="status" className="rounded-lg border border-success-border bg-success-surface px-4 py-3 text-xs font-medium text-success">
          Imported {importedCount} parser record(s) into a review batch. Papers have not entered the source registry yet.
        </p>
      ) : null}
      {committedCount ? (
        <p role="status" className="rounded-lg border border-success-border bg-success-surface px-4 py-3 text-xs font-medium text-success">
          Added {committedCount} reviewed paper(s) to the department source registry.
        </p>
      ) : null}
      {itemStatus ? (
        <p role="status" className="rounded-lg border border-success-border bg-success-surface px-4 py-3 text-xs font-medium text-success">
          Paper review updated.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="size-4 text-primary" aria-hidden="true" />
            Upload parsed paper records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)] lg:items-center">
            <form action={importParsedPapersAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 space-y-1 text-xs font-semibold text-text-secondary">
                exam-engine papers.jsonl
                <input
                  name="papersFile"
                  type="file"
                  accept=".jsonl,application/x-ndjson"
                  required
                  disabled={workspace.migrationRequired || !profile.activeDepartmentId}
                  className="block min-h-10 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:font-semibold file:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>
              <button
                type="submit"
                disabled={workspace.migrationRequired || !profile.activeDepartmentId}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileUp className="size-4" aria-hidden="true" /> Upload for review
              </button>
            </form>
            <div className="rounded-lg border border-border bg-surface-subtle p-3 text-xs leading-5 text-text-secondary">
              <p className="font-semibold text-text-primary">Prepare the file with the supplied importer</p>
              <code className="mt-1 block overflow-x-auto whitespace-nowrap text-[10px]">python -m exam_engine.ingest &lt;papers-folder&gt; --out ./out</code>
              <p className="mt-1">Run from <code>scripts/exam-engine</code>, then upload <code>out/papers.jsonl</code>. The matching <code>report.csv</code> is useful for local review; the JSONL carries each record&apos;s status and notes.</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-text-muted">Private department storage · maximum 45 MB and 1,000 paper records per batch. Original source documents are not modified by the importer.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle>Recent import batches</CardTitle></CardHeader>
          <div className="divide-y divide-border">
            {workspace.batches.map((batch) => (
              <Link
                key={batch.id}
                href={`/assessment/exam-setting/past-papers?batchId=${batch.id}`}
                className={`block px-4 py-3 transition hover:bg-surface-subtle ${workspace.selectedBatch?.id === batch.id ? 'bg-primary/5' : ''}`}
              >
                <p className="truncate text-xs font-semibold text-text-primary">{batch.sourceFilename}</p>
                <p className="mt-1 flex items-center justify-between gap-2 text-[11px] text-text-muted">
                  <span>{batch.totalRecords} records</span>
                  <Badge variant={batch.status === 'imported' ? 'success' : 'neutral'}>{batch.status}</Badge>
                </p>
              </Link>
            ))}
            {workspace.batches.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-text-muted">No import batches yet.</p>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{workspace.selectedBatch?.sourceFilename ?? 'Paper review queue'}</CardTitle>
              {workspace.selectedBatch ? <Badge>{workspace.selectedBatch.totalRecords} parser records</Badge> : null}
              {workspace.selectedBatch?.status === 'reviewing' ? (
                <form action={commitExamImportBatchAction} className="ml-auto">
                  <input type="hidden" name="batchId" value={workspace.selectedBatch.id} />
                  <button
                    type="submit"
                    disabled={workspace.readyCount === 0}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Archive className="size-3.5" aria-hidden="true" /> Import {workspace.readyCount} ready
                  </button>
                </form>
              ) : null}
            </div>
          </CardHeader>
          {!workspace.selectedBatch ? (
            <div className="px-4 py-12 text-center">
              <Archive className="mx-auto size-8 text-text-muted" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-text-primary">Choose a batch to review</p>
              <p className="mt-1 text-xs text-text-muted">Import a parser output file or select a recent batch.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {workspace.items.map((item) => {
                const canReady = item.importStatus === 'usable' || item.importStatus === 'usable_with_notes';
                const guessedUnitId = item.unitId ?? guessUnitId(item.unitCode, workspace.units);
                return (
                  <div key={item.id} className="space-y-2.5 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-xs font-semibold text-text-primary" title={item.sourcePath}>{item.sourcePath}</p>
                      <Badge variant={badgeVariant(item.importStatus)}>{item.importStatus}</Badge>
                      <Badge variant={badgeVariant(item.reviewStatus)}>{item.reviewStatus}</Badge>
                    </div>
                    <p className="text-[11px] text-text-muted">
                      {[item.unitCode, item.examYear, item.series, item.paperKind, item.trainerName].filter(Boolean).join(' · ') || 'Paper metadata incomplete'}
                    </p>
                    {item.paperPreview.length > 0 ? (
                      <details className="rounded-md border border-border bg-surface-subtle px-2.5 py-2">
                        <summary className="cursor-pointer text-[11px] font-semibold text-text-secondary">
                          Preview parsed questions
                        </summary>
                        <div className="mt-2 space-y-2">
                          {item.paperPreview.map((section) => (
                            <div key={section.label}>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Section {section.label}</p>
                              <ol className="mt-1 list-decimal space-y-1 pl-4 text-[11px] text-text-secondary">
                                {section.questions.map((question) => (
                                  <li key={`${section.label}-${question.number}`}>
                                    <span className="font-semibold">Q{question.number}.</span>{' '}{question.text || 'Question begins in its parts'}
                                  </li>
                                ))}
                              </ol>
                              {section.questions.length === 8 ? <p className="mt-1 text-[10px] text-text-muted">Showing the first 8 questions in this section.</p> : null}
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                    {item.parseError || item.parseNotes.length > 0 ? (
                      <p className="rounded-md bg-warning-surface px-2.5 py-2 text-[11px] text-warning">
                        {[item.parseError, ...item.parseNotes].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                    {item.reviewStatus === 'imported' ? (
                      <p className="text-[11px] font-medium text-success">Registered as a past-paper source file.</p>
                    ) : workspace.selectedBatch.status === 'reviewing' ? (
                      <form action={reviewExamImportItemAction} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                        <input type="hidden" name="batchId" value={workspace.selectedBatch.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <label className="space-y-1 text-[11px] font-semibold text-text-secondary">
                          Match to department unit
                          <select
                            name="unitId"
                            defaultValue={guessedUnitId}
                            className="h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-xs text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <option value="">Select a unit</option>
                            {workspace.units.map((unit) => (
                              <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          name="reviewStatus"
                          value="ready"
                          type="submit"
                          disabled={!canReady}
                          className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Mark ready
                        </button>
                        <button
                          name="reviewStatus"
                          value="rejected"
                          type="submit"
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-secondary hover:border-danger hover:text-danger"
                        >
                          <RefreshCw className="size-3" aria-hidden="true" /> Reject
                        </button>
                      </form>
                    ) : (
                      <p className="text-[11px] text-text-muted">This batch has been closed.</p>
                    )}
                  </div>
                );
              })}
              {workspace.items.length === 0 ? (
                <p className="px-4 py-10 text-center text-xs text-text-muted">No paper records were found in this batch.</p>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
