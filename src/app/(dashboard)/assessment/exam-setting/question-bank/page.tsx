import { BookOpenCheck, Tags } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { saveHistoricalQuestionTagAction } from '@/features/exam-setting/question-bank-actions';
import { getQuestionBankWorkspace } from '@/features/exam-setting/question-bank';
import { ExamSettingSteps } from '@/features/exam-setting/workflow-steps';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ERROR_MESSAGES: Record<string, string> = {
  department: 'Select an active department before tagging questions.',
  invalid: 'The question tags are invalid. Check the topic and selected values.',
  question: 'That parsed question has no usable mark total. Review the original parser output before tagging it.',
  save: 'The question tags could not be saved. Apply the question bank migration and refresh.',
  source: 'That historical paper is unavailable in the active department.',
};

export default async function ExamQuestionBankPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireHodAccess();
  const params = await searchParams;
  const paperId = typeof params.paperId === 'string' ? params.paperId : undefined;
  const errorCode = typeof params.error === 'string' ? params.error : '';
  const workspace = await getQuestionBankWorkspace(paperId);
  const selectedPaper = workspace.selectedPaper;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Exam setting · Step 3 of 5"
        title="Historical question bank"
        description="Tag reviewed past-paper questions against the unit curriculum. Historical questions remain reference material and are never inserted verbatim into a new paper."
        icon={BookOpenCheck}
        backHref="/assessment/exam-setting/past-papers"
        backLabel="Past papers"
        context={<Badge variant="info">{workspace.departmentName}</Badge>}
      />

      <ExamSettingSteps currentStep={3} />

      {workspace.migrationRequired ? (
        <p role="status" className="rounded-lg border border-warning-border bg-warning-surface px-4 py-3 text-xs text-warning">
          Apply <code>20261018064000_exam_question_source_keys.sql</code> with <code>npx supabase db push</code> before tagging questions.
        </p>
      ) : null}
      {!profile.activeDepartmentId ? (
        <p role="alert" className="rounded-lg border border-warning-border bg-warning-surface px-4 py-3 text-xs text-warning">Select an active department before tagging questions.</p>
      ) : null}
      {errorCode && ERROR_MESSAGES[errorCode] ? (
        <p role="alert" className="rounded-lg border border-danger-border bg-danger-surface px-4 py-3 text-xs text-danger">{ERROR_MESSAGES[errorCode]}</p>
      ) : null}
      {typeof params.saved === 'string' ? (
        <p role="status" className="rounded-lg border border-success-border bg-success-surface px-4 py-3 text-xs font-medium text-success">Question tags saved. The historical question remains a draft reference and cannot be approved for reuse.</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle>Imported historical papers</CardTitle></CardHeader>
          <div className="divide-y divide-border">
            {workspace.papers.map((paper) => (
              <Link key={paper.id} href={`/assessment/exam-setting/question-bank?paperId=${paper.id}`} className={`block px-4 py-3 hover:bg-surface-subtle ${selectedPaper?.id === paper.id ? 'bg-primary/5' : ''}`}>
                <p className="text-xs font-semibold text-text-primary">{paper.unitCode} · {paper.examYear ?? 'Undated'} {paper.paperKind ?? 'paper'}</p>
                <p className="mt-1 truncate text-[11px] text-text-muted">{paper.label}</p>
                <p className="mt-1 text-[11px] text-text-muted">{paper.questions.filter((question) => question.topic).length} / {paper.questions.length} tagged</p>
              </Link>
            ))}
            {workspace.papers.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-text-muted">
                <p>No parsed historical papers with readable questions yet.</p>
                <Link className="mt-2 inline-block font-semibold text-primary hover:underline" href="/assessment/exam-setting/past-papers">Review past-paper imports</Link>
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Tags className="size-4 text-primary" aria-hidden="true" />
              <CardTitle>{selectedPaper?.label ?? 'Question tags'}</CardTitle>
            </div>
          </CardHeader>
          {selectedPaper ? (
            <CardContent className="space-y-4">
              {workspace.topics.length === 0 ? (
                <p role="status" className="rounded-lg border border-warning-border bg-warning-surface px-3 py-2 text-xs text-warning">
                  No published curriculum topics are mapped to {selectedPaper.unitCode}. Enter a topic manually; it will be retained as text for later curriculum alignment.
                </p>
              ) : null}
              {selectedPaper.questions.map((question) => (
                <form key={question.key} action={saveHistoricalQuestionTagAction} className="rounded-lg border border-border p-3">
                  <input type="hidden" name="paperId" value={selectedPaper.id} />
                  <input type="hidden" name="questionKey" value={question.key} />
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-text-primary">Section {question.section} · Question {question.number}</p>
                      <p className="mt-1 whitespace-pre-line text-xs leading-5 text-text-secondary">{question.bodyText}</p>
                    </div>
                    <Badge variant={question.topic ? 'success' : 'neutral'}>{question.marks ? `${question.marks} marks` : 'Marks unresolved'}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <label className="space-y-1 text-[11px] font-semibold text-text-secondary sm:col-span-2">
                      Curriculum topic
                      <input name="topic" list={`topics-${selectedPaper.id}`} required minLength={2} maxLength={240} defaultValue={question.topic} placeholder="Choose or enter topic" className="h-9 w-full rounded-md border border-border bg-surface px-2 text-xs text-text-primary" />
                      <datalist id={`topics-${selectedPaper.id}`}>{workspace.topics.map((topic) => <option key={topic} value={topic} />)}</datalist>
                    </label>
                    <label className="space-y-1 text-[11px] font-semibold text-text-secondary sm:col-span-2">
                      Learning outcome (optional)
                      <input name="learningOutcome" list={`outcomes-${selectedPaper.id}`} maxLength={1000} defaultValue={question.learningOutcome} placeholder="Choose or enter learning outcome" className="h-9 w-full rounded-md border border-border bg-surface px-2 text-xs text-text-primary" />
                      <datalist id={`outcomes-${selectedPaper.id}`}>{workspace.learningOutcomes.map((outcome, index) => <option key={`${index}-${outcome}`} value={outcome} />)}</datalist>
                    </label>
                    <label className="space-y-1 text-[11px] font-semibold text-text-secondary">Difficulty
                      <select name="difficulty" defaultValue={question.difficulty} className="h-9 w-full rounded-md border border-border bg-surface px-2 text-xs text-text-primary"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
                    </label>
                    <label className="space-y-1 text-[11px] font-semibold text-text-secondary">Cognitive level
                      <select name="cognitiveLevel" defaultValue={question.cognitiveLevel} className="h-9 w-full rounded-md border border-border bg-surface px-2 text-xs text-text-primary"><option value="">Not set</option><option value="recall">Recall</option><option value="comprehension">Comprehension</option><option value="application">Application</option><option value="analysis">Analysis</option></select>
                    </label>
                    <div className="flex items-end sm:col-span-2 xl:col-span-2">
                      <button type="submit" disabled={!question.marks || workspace.migrationRequired} className="h-9 rounded-md bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
                        {question.topic ? 'Update tags' : 'Save to question bank'}
                      </button>
                      <span className="ml-2 self-center text-[11px] text-text-muted">{question.questionType.replace('_', ' ')} · historical reference</span>
                    </div>
                  </div>
                </form>
              ))}
            </CardContent>
          ) : (
            <CardContent className="py-12 text-center text-xs text-text-muted">Import and review a usable past paper to begin building the question bank.</CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
