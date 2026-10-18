import { WandSparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import { generateExamPaperAction } from '@/features/exam-setting/generation-actions';
import { GenerateSubmitButton } from '@/features/exam-setting/generate-submit-button';
import { getExamGenerationWorkspace, getGeneratedPaperPreview } from '@/features/exam-setting/generation-queries';
import { ExamSettingSteps } from '@/features/exam-setting/workflow-steps';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ERROR_MESSAGES: Record<string, string> = {
  department: 'Select an active department before generating a paper.',
  invalid: 'Choose a unit, active blueprint, academic period, and paper type.',
  provider: 'Gemini is not configured. Set GEMINI_API_KEY on the server and restart the app.',
  unit: 'The selected unit is unavailable in this department.',
  blueprint: 'Activate a department blueprint before generating papers.',
  period: 'Choose an active or planned academic period.',
  source: 'Past-paper records could not be loaded. Refresh and try again.',
  database: 'Historical questions could not be prepared. Refresh and try again.',
  duplicate: 'A paper of this type already exists for that unit and academic period.',
  'no-sources': 'There are no parsed past papers for this unit. Import and review past papers first.',
  'no-questions': 'No parsed historical questions with usable marks were found for this unit.',
  'blueprint-layout': 'The active blueprint does not contain a supported paper layout.',
  'not-enough-questions': 'The archive has fewer distinct marked questions than this blueprint needs. Import more past papers for this unit, then try again.',
  'generation-format': 'Gemini returned a question that did not meet the blueprint format. No paper draft was created; try again.',
  generation: 'Gemini could not generate this paper. No paper draft was created; try again.',
  commit: 'The generated paper could not be saved. No paper draft was created; refresh and try again.',
};

export default async function ExamGeneratePage({ searchParams }: { searchParams: SearchParams }) {
  await requireHodAccess();
  const params = await searchParams;
  const errorCode = typeof params.error === 'string' ? params.error : '';
  const createdPaperId = typeof params.created === 'string' ? params.created : '';
  const [workspace, preview] = await Promise.all([
    getExamGenerationWorkspace(),
    createdPaperId ? getGeneratedPaperPreview(createdPaperId) : Promise.resolve(null),
  ]);
  const canGenerate = !workspace.migrationRequired && workspace.units.length > 0
    && workspace.blueprints.length > 0 && workspace.periods.length > 0
    && workspace.units.some((unit) => unit.sourcePaperCount > 0);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Exam setting · Step 4 of 5"
        title="Generate a new examination"
        description="Build a complete draft from the full reviewed past-paper archive for one unit. Every generated question keeps its historical source link and is checked for wording overlap."
        icon={WandSparkles}
        backHref="/assessment/exam-setting/question-bank"
        backLabel="Question bank"
        context={<Badge variant="info">{workspace.departmentName}</Badge>}
      />

      <ExamSettingSteps currentStep={4} />

      {workspace.migrationRequired ? (
        <p role="status" className="rounded-lg border border-warning-border bg-warning-surface px-4 py-3 text-xs text-warning">
          Apply the exam-setting migrations with <code>npx supabase db push</code> to enable generation.
        </p>
      ) : null}
      {errorCode && ERROR_MESSAGES[errorCode] ? (
        <p role="alert" className="rounded-lg border border-danger-border bg-danger-surface px-4 py-3 text-xs text-danger">{ERROR_MESSAGES[errorCode]}</p>
      ) : null}
      {typeof params.error === 'string' && !ERROR_MESSAGES[params.error] ? (
        <p role="alert" className="rounded-lg border border-danger-border bg-danger-surface px-4 py-3 text-xs text-danger">Generation failed. No paper draft was created; review your selections and try again.</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader><CardTitle>Set up the new draft</CardTitle></CardHeader>
          <CardContent>
            <form action={generateExamPaperAction} className="space-y-4">
              <label className="block space-y-1 text-xs font-semibold text-text-secondary">
                Unit
                <select name="unitId" required defaultValue="" className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary">
                  <option value="" disabled>Select a unit</option>
                  {workspace.units.map((unit) => <option key={unit.id} value={unit.id} disabled={unit.sourcePaperCount === 0}>{unit.code} · {unit.name} ({unit.sourcePaperCount} past papers)</option>)}
                </select>
              </label>
              <label className="block space-y-1 text-xs font-semibold text-text-secondary">
                Active blueprint
                <select name="blueprintId" required defaultValue="" className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary">
                  <option value="" disabled>Select a blueprint</option>
                  {workspace.blueprints.map((blueprint) => <option key={blueprint.id} value={blueprint.id}>{blueprint.name} · v{blueprint.versionNumber} · {blueprint.totalMarks} marks · {blueprint.durationMinutes} min</option>)}
                </select>
              </label>
              <label className="block space-y-1 text-xs font-semibold text-text-secondary">
                Academic period
                <select name="periodId" required defaultValue="" className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary">
                  <option value="" disabled>Select an academic period</option>
                  {workspace.periods.map((period) => <option key={period.id} value={period.id}>{period.yearName} · {period.name} ({period.code})</option>)}
                </select>
              </label>
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-text-secondary">Paper type</legend>
                <div className="flex flex-wrap gap-4 text-sm text-text-primary">
                  <label className="flex items-center gap-2"><input type="radio" name="paperKind" value="main" defaultChecked className="accent-primary" />Main</label>
                  <label className="flex items-center gap-2"><input type="radio" name="paperKind" value="supplementary" className="accent-primary" />Supplementary</label>
                </div>
              </fieldset>
              <GenerateSubmitButton disabled={!canGenerate} />
              <p aria-live="polite" className="text-[11px] text-text-muted">Generation may take up to a minute. Keep this page open until the draft appears.</p>
              {!workspace.blueprints.length ? <p className="text-xs text-warning">No active blueprint. Activate a blueprint in Step 1 first.</p> : null}
              {!workspace.periods.length ? <p className="text-xs text-warning">Create an active or planned academic period before generating a paper.</p> : null}
              {!workspace.units.some((unit) => unit.sourcePaperCount > 0) ? <p className="text-xs text-warning">Import usable past papers for a unit before generating a paper.</p> : null}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>How this draft is built</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-xs leading-5 text-text-secondary">
            <p>All readable historical questions for the selected unit are eligible as source material. The system favors questions used less often and does not repeat a source question within one paper.</p>
            <p>Gemini reworks each selected question into written short-answer or structured form, preserving its topic and learning intent. This college format does not allow multiple-choice questions. Scientific facts and mark allocation still need academic moderation.</p>
            <p>Generated questions remain drafts. Each one links to its source question; high wording overlap is flagged for review. No paper is approved or exported automatically.</p>
          </CardContent>
        </Card>
      </div>

      {preview ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Generated draft · {preview.unitName} · {preview.periodName}</CardTitle>
              <Badge variant="warning">{preview.status} · {preview.totalMarks} marks</Badge>
            </div>
          </CardHeader>
          <div className="divide-y divide-border">
            {preview.questions.map((question) => (
              <div key={`${question.section}-${question.number}`} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-text-primary">Section {question.section} · Question {question.number} · {question.marks} marks</p>
                  <Badge variant={question.status === 'needs_review' ? 'warning' : 'neutral'}>{question.status} · {Math.round(question.similarity * 100)}% wording overlap</Badge>
                </div>
                <p className="mt-2 whitespace-pre-line text-xs leading-5 text-text-secondary">{question.bodyText}</p>
                <p className="mt-1 text-[11px] text-text-muted">Topic: {question.topic}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Recent drafts</CardTitle></CardHeader>
        <div className="divide-y divide-border">
          {workspace.recentPapers.map((paper) => (
            <div key={paper.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs">
              <p className="font-semibold text-text-primary">{paper.unitName} · {paper.periodName} · {paper.paperKind}</p>
              <Badge variant="warning">{paper.status}</Badge>
            </div>
          ))}
          {workspace.recentPapers.length === 0 ? <p className="px-4 py-6 text-center text-xs text-text-muted">No generated drafts yet.</p> : null}
        </div>
      </Card>
    </div>
  );
}
