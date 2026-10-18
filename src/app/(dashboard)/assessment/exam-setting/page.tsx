import { BookOpenCheck, ClipboardList, Clock3, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireHodAccess } from '@/features/auth/authorization';
import {
  createExamBlueprintAction,
  setExamBlueprintStatusAction,
} from '@/features/exam-setting/actions';
import { getExamBlueprintWorkspace } from '@/features/exam-setting/queries';
import { ExamSettingSteps } from '@/features/exam-setting/workflow-steps';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ERROR_MESSAGES: Record<string, string> = {
  department: 'Select an active department before setting up an exam blueprint.',
  duplicate: 'That blueprint name and version already exist in this department.',
  invalid: 'Check the blueprint name, version, and exam duration.',
  programme: 'Choose an active programme in your current department.',
  save: 'The blueprint could not be saved. Check that the exam-setting migration has been applied.',
  status: 'Apply 20261017211000_exam_blueprint_lifecycle.sql, then refresh and try again.',
};

function statusVariant(status: string) {
  if (status === 'active') return 'success' as const;
  if (status === 'retired') return 'neutral' as const;
  return 'warning' as const;
}

export default async function ExamSettingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireHodAccess();
  const [params, workspace] = await Promise.all([
    searchParams,
    getExamBlueprintWorkspace(),
  ]);
  const errorCode = typeof params.error === 'string' ? params.error : '';
  const success = typeof params.created === 'string'
    ? 'Blueprint saved as a draft.'
    : params.status === 'active'
      ? 'Blueprint activated. Any active version with the same name and programme was retired.'
      : params.status === 'retired'
        ? 'Blueprint retired.'
        : '';

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Exam setting · Step 1 of 5"
        title="Exam blueprints"
        description="Set the paper structure before importing past papers or preparing a new examination."
        icon={BookOpenCheck}
        context={<Badge variant="info">{workspace.departmentName}</Badge>}
      />

      <ExamSettingSteps currentStep={1} />

      {workspace.migrationRequired ? (
        <div role="status" className="rounded-lg border border-warning-border bg-warning-surface px-4 py-3 text-xs text-warning">
          The exam-setting tables are not available yet. Apply
          {' '}<code>20261017120000_exam_setting_foundation.sql</code>{' '}
          through the normal Supabase migration process, then refresh this page.
        </div>
      ) : null}
      {!profile.activeDepartmentId ? (
        <p role="alert" className="rounded-lg border border-warning-border bg-warning-surface px-4 py-3 text-xs font-medium text-warning">
          Select an active department before creating or managing exam blueprints.
        </p>
      ) : null}
      {errorCode && ERROR_MESSAGES[errorCode] ? (
        <p role="alert" className="rounded-lg border border-danger-border bg-danger-surface px-4 py-3 text-xs font-medium text-danger">
          {ERROR_MESSAGES[errorCode]}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="rounded-lg border border-success-border bg-success-surface px-4 py-3 text-xs font-medium text-success">
          {success}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-4 text-primary" aria-hidden="true" />
              New blueprint version
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createExamBlueprintAction} className="space-y-3">
              <label className="block space-y-1 text-xs font-semibold text-text-secondary">
                Blueprint name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Standard Diploma Examination"
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-primary"
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold text-text-secondary">
                Programme <span className="font-normal text-text-muted">(optional; blank applies department-wide)</span>
                <select
                  name="programmeId"
                  defaultValue=""
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-primary"
                >
                  <option value="">All programmes</option>
                  {workspace.programmes.map((programme) => (
                    <option key={programme.id} value={programme.id}>
                      {programme.code} · {programme.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 text-xs font-semibold text-text-secondary">
                  Version
                  <input
                    name="versionNumber"
                    type="number"
                    min={1}
                    max={999}
                    defaultValue={1}
                    required
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-primary"
                  />
                </label>
                <label className="block space-y-1 text-xs font-semibold text-text-secondary">
                  Duration (minutes)
                  <input
                    name="durationMinutes"
                    type="number"
                    min={30}
                    max={360}
                    defaultValue={120}
                    required
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-primary"
                  />
                </label>
              </div>
              <div className="rounded-lg border border-border bg-surface-subtle p-3 text-xs text-text-secondary">
                <p className="font-semibold text-text-primary">College paper structure · 100 marks</p>
                <ul className="mt-2 space-y-1">
                  <li>Section A: 10 written short-answer questions · 4 marks each · answer all</li>
                  <li>Section B: 4 structured questions · answer any 3 at 20 marks each</li>
                  <li className="flex items-center gap-1.5"><Clock3 className="size-3.5" /> Duration is set above</li>
                </ul>
              </div>
              <button
                type="submit"
                disabled={workspace.migrationRequired || !profile.activeDepartmentId}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="size-4" aria-hidden="true" /> Save draft blueprint
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-4 text-primary" aria-hidden="true" />
              Department blueprints
              <Badge className="ml-auto">{workspace.blueprints.length} versions</Badge>
            </CardTitle>
          </CardHeader>
          <div className="divide-y divide-border">
            {workspace.blueprints.map((blueprint) => {
              const programme = workspace.programmes.find(
                (item) => item.id === blueprint.programmeId,
              );
              return (
                <div key={blueprint.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-text-primary">{blueprint.name}</p>
                      <Badge variant={statusVariant(blueprint.status)}>{blueprint.status}</Badge>
                      <Badge variant="neutral">v{blueprint.versionNumber}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      {programme ? `${programme.code} · ${programme.name}` : 'All programmes'}
                      {' · '}{blueprint.totalMarks} marks
                      {' · '}{blueprint.durationMinutes} minutes
                    </p>
                  </div>
                  {blueprint.status !== 'active' ? (
                    <form action={setExamBlueprintStatusAction}>
                      <input type="hidden" name="blueprintId" value={blueprint.id} />
                      <input type="hidden" name="status" value="active" />
                      <button type="submit" className="h-9 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary">
                        Activate version
                      </button>
                    </form>
                  ) : (
                    <form action={setExamBlueprintStatusAction}>
                      <input type="hidden" name="blueprintId" value={blueprint.id} />
                      <input type="hidden" name="status" value="retired" />
                      <button type="submit" className="h-9 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-muted hover:border-danger hover:text-danger">
                        Retire
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
            {workspace.blueprints.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <BookOpenCheck className="mx-auto size-8 text-text-muted" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-text-primary">No blueprints yet</p>
                <p className="mt-1 text-xs text-text-muted">Save a draft here to define the format used by the next workflow steps.</p>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
