'use client';

import {
  CalendarCheck2,
  LoaderCircle,
  LockOpen,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  useActionState,
  useEffect,
  useRef,
} from 'react';

import {
  Button,
} from '@/components/ui/button';
import {
  FormStatusMessage,
} from '@/components/ui/form-status-message';

import {
  applyTrainerExchangeAction,
  clearTimetableHistoryAction,
  generateTimetablePreviewAction,
  returnTimetableToEditableDraftAction,
  saveGeneratedTimetableDraftAction,
} from './actions';
import {
  GeneratorConflictList,
  GeneratorUnscheduledList,
} from './generator-issues';
import {
  GeneratorMasterGrid,
} from './generator-master-grid';
import {
  GeneratorReadiness,
} from './generator-readiness';
import {
  GeneratorSessionTable,
} from './generator-session-table';
import {
  GeneratorStatistics,
} from './generator-statistics';
import {
  initialGeneratorActionState,
  initialGeneratorDraftLifecycleActionState,
  initialGeneratorExchangeActionState,
  initialGeneratorPersistActionState,
  initialGeneratorResetActionState,
  type TimetableGenerationRunSummary,
} from './server-types';

export interface GeneratorAcademicPeriodOption {
  id: string;
  code: string;
  name: string;
  status: string;
}

export function GeneratorWorkspace({
  academicPeriods,
  defaultAcademicPeriodId,
  latestRun = null,
}: {
  academicPeriods:
    GeneratorAcademicPeriodOption[];
  defaultAcademicPeriodId:
    string | null;
  latestRun?: TimetableGenerationRunSummary | null;
}) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    generateTimetablePreviewAction,
    initialGeneratorActionState,
  );

  const [
    persistState,
    persistAction,
    persistPending,
  ] = useActionState(
    saveGeneratedTimetableDraftAction,
    initialGeneratorPersistActionState,
  );

  const [
    resetState,
    resetAction,
    resetPending,
  ] = useActionState(
    clearTimetableHistoryAction,
    initialGeneratorResetActionState,
  );

  const [
    exchangeState,
    exchangeAction,
    exchangePending,
  ] = useActionState(
    applyTrainerExchangeAction,
    initialGeneratorExchangeActionState,
  );

  const [
    draftLifecycleState,
    draftLifecycleAction,
    draftLifecyclePending,
  ] = useActionState(
    returnTimetableToEditableDraftAction,
    initialGeneratorDraftLifecycleActionState,
  );

  const preview = exchangeState.preview &&
    (
      !state.preview ||
      exchangeState.preview.generatedAt >= state.preview.generatedAt
    )
    ? exchangeState.preview
    : state.preview;
  const draftLifecycleAppliesToPreview =
    draftLifecycleState.academicPeriodId ===
      preview?.academicPeriod.id;
  const draftLifecycleStatus = draftLifecycleAppliesToPreview
    ? draftLifecycleState.status
    : 'idle';
  const draftLifecycleMessage = draftLifecycleAppliesToPreview
    ? draftLifecycleState.message
    : null;
  const exchangeStateAppliesToPreview =
    exchangeState.academicPeriodId ===
      preview?.academicPeriod.id;
  const exchangeRequiresTimetableReopen =
    exchangeStateAppliesToPreview &&
      exchangeState.requiresTimetableReopen === true;
  const exchangeMessage = exchangeStateAppliesToPreview
    ? exchangeState.message
    : null;
  const exchangeStatusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exchangeState.message) {
      return;
    }

    exchangeStatusRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    exchangeStatusRef.current?.focus({
      preventScroll: true,
    });
  }, [
    exchangeState.message,
    exchangeState.partnerTeachingAllocationId,
    exchangeState.status,
    exchangeState.targetSessionNumber,
    exchangeState.targetTeachingAllocationId,
  ]);

  return (
    <div className="space-y-8">
      {latestRun ? (
        <section className="rounded-2xl border border-border bg-surface px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Latest saved generation</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">
                {latestRun.scheduledSessionCount} sessions · {latestRun.lockedSessionCount} locked · {latestRun.unscheduledSessionCount} unresolved
              </p>
            </div>
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold capitalize text-primary">
              {latestRun.status.replaceAll('_', ' ')}
            </span>
          </div>
          <p className="mt-2 text-xs text-text-muted">Saved {new Date(latestRun.createdAt).toLocaleString()}.</p>
        </section>
      ) : null}

      <form
        action={formAction}
        className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-2">
            <label
              htmlFor="academicPeriodId"
              className="text-sm font-semibold text-text-primary"
            >
              Academic Period
            </label>

            <select
              id="academicPeriodId"
              name="academicPeriodId"
              required
              defaultValue={
                defaultAcademicPeriodId ??
                ''
              }
              disabled={pending}
              className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-soft"
            >
              <option value="">
                Select Academic Period
              </option>

              {academicPeriods.map(
                (period) => (
                  <option
                    key={period.id}
                    value={period.id}
                  >
                    {period.code} —{' '}
                    {period.name}
                    {period.status
                      ? ` (${period.status})`
                      : ''}
                  </option>
                ),
              )}
            </select>

            {state.fieldErrors
              ?.academicPeriodId?.map(
                (error) => (
                  <p
                    key={error}
                    className="text-sm text-danger"
                  >
                    {error}
                  </p>
                ),
              )}
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={
              pending ||
              academicPeriods.length === 0
            }
            leadingIcon={
              pending ? (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : preview ? (
                <RefreshCw
                  className="size-4"
                  aria-hidden="true"
                />
              ) : (
                <Sparkles
                  className="size-4"
                  aria-hidden="true"
                />
              )
            }
          >
            {pending
              ? 'Generating preview'
              : preview
                ? 'Regenerate preview'
                : 'Generate preview'}
          </Button>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3">
          <input
            type="checkbox"
            name="overwriteExisting"
            defaultChecked
            disabled={pending}
            className="mt-1 size-4 rounded border-border-strong"
          />

          <span>
            <span className="block text-sm font-semibold text-text-primary">
              Replace existing editable sessions
            </span>

            <span className="mt-1 block text-xs leading-5 text-text-muted">
              Draft and confirmed sessions may be
              regenerated. Locked sessions will always
              remain protected.
            </span>
          </span>
        </label>
      </form>

      <section className="rounded-2xl border border-danger/30 bg-danger-surface p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-danger">Clean timetable reset</p>
            <h2 className="mt-1 font-semibold text-text-primary">Remove saved timetable and previous history</h2>
            <p className="mt-1 max-w-2xl text-sm text-text-secondary">
              Clears sessions, generation history, editor changes, conflict reviews, exchanges and publication versions for the selected period. Allocations and master setup remain unchanged.
            </p>
          </div>
          <form action={resetAction} className="space-y-3">
            <input type="hidden" name="academicPeriodId" value={preview?.academicPeriod.id ?? defaultAcademicPeriodId ?? ''} />
            <label className="flex items-center gap-2 text-xs font-medium text-danger">
              <input type="checkbox" name="confirmReset" value="CLEAR" required />
              I understand previous timetable history will be deleted
            </label>
            <Button type="submit" variant="outline" className="border-danger/40 text-danger hover:bg-danger-surface" disabled={resetPending || !(preview?.academicPeriod.id ?? defaultAcademicPeriodId)} leadingIcon={<Trash2 className="size-4" />}>
              {resetPending ? 'Clearing timetable' : 'Clear timetable history'}
            </Button>
          </form>
        </div>
        {resetState.message ? (
          <div className="mt-4">
            <FormStatusMessage status={resetState.status === 'success' ? 'success' : 'error'} title={resetState.status === 'success' ? 'Timetable cleared' : 'Timetable not cleared'} message={resetState.message} />
          </div>
        ) : null}
      </section>

      {state.message ? (
        <FormStatusMessage
          status={
            state.status === 'success'
              ? 'success'
              : 'error'
          }
          message={state.message}
        />
      ) : null}


      {persistState.message ? (
        <FormStatusMessage
          status={persistState.status === 'success' ? 'success' : 'error'}
          message={persistState.message}
        />
      ) : null}

      {!preview ? (
        <section className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-14 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <CalendarCheck2
              className="size-6"
              aria-hidden="true"
            />
          </div>

          <h2 className="mt-4 font-semibold text-text-primary">
            Generate the first timetable preview
          </h2>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-muted">
            Select an Academic Period to evaluate
            teaching allocations, working days, time
            slots, trainer workload and room
            availability.
          </p>
        </section>
      ) : (
        <div className="space-y-8">
          <GeneratorReadiness
            preview={preview}
          />

          <GeneratorStatistics
            preview={preview}
          />

          {preview.protectedTimetable ||
          exchangeRequiresTimetableReopen ||
          draftLifecycleMessage ? (
            <section className="rounded-2xl border border-warning-border bg-warning-surface p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-warning">
                    Timetable editing status
                  </p>
                  <h2 className="mt-1 font-semibold text-text-primary">
                    {draftLifecycleStatus === 'success'
                      ? 'Timetable is editable'
                      : 'Return timetable to draft before making changes'}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
                    {draftLifecycleStatus === 'success'
                      ? 'The lifecycle step is complete. You can now apply the recommended trainer exchange.'
                      : preview.protectedTimetable
                        ? `Version ${preview.protectedTimetable.versionNumber} is ${preview.protectedTimetable.status.replaceAll('_', ' ')}. Return it to an editable state before applying trainer exchanges.`
                        : 'This timetable is protected by its publication workflow. Return it to an editable state before applying trainer exchanges.'}
                  </p>
                </div>

                {draftLifecycleStatus !== 'success' ? (
                  <form action={draftLifecycleAction}>
                    <input type="hidden" name="academicPeriodId" value={preview.academicPeriod.id} />
                    <Button
                      type="submit"
                      disabled={draftLifecyclePending}
                      leadingIcon={draftLifecyclePending ? (
                        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <LockOpen className="size-4" aria-hidden="true" />
                      )}
                    >
                      {draftLifecyclePending
                        ? 'Returning to draft'
                        : 'Return timetable to draft'}
                    </Button>
                  </form>
                ) : null}
              </div>

              {draftLifecycleMessage ? (
                <div className="mt-4" aria-live="polite">
                  <FormStatusMessage
                    status={draftLifecycleStatus === 'success' ? 'success' : 'error'}
                    title={draftLifecycleStatus === 'success' ? 'Ready for editing' : 'Timetable not changed'}
                    message={draftLifecycleMessage}
                  />
                </div>
              ) : null}
            </section>
          ) : null}

          {exchangeMessage &&
          draftLifecycleStatus !== 'success' ? (
            <div
              ref={exchangeStatusRef}
              tabIndex={-1}
              aria-live="polite"
              className="outline-none"
            >
              <FormStatusMessage
                status={exchangeState.status === 'success' ? 'success' : 'error'}
                title={exchangeState.status === 'success'
                  ? 'Exchange applied'
                  : exchangeRequiresTimetableReopen
                    ? 'Draft required'
                    : 'Exchange not applied'}
                message={exchangeMessage}
              />
            </div>
          ) : null}

          {preview.exchangeSuggestionsEvaluated === false &&
          preview.unscheduled.length > 0 ? (
            <form
              action={formAction}
              className="flex flex-col gap-3 rounded-2xl border border-primary-soft bg-primary-subtle p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Check for another repair
                </p>
                <p className="mt-1 text-xs leading-5 text-text-muted">
                  The timetable has been updated quickly. Run the full smart scan only if unresolved sessions remain.
                </p>
              </div>
              <input type="hidden" name="academicPeriodId" value={preview.academicPeriod.id} />
              <input type="hidden" name="overwriteExisting" value="true" />
              <Button
                type="submit"
                variant="outline"
                disabled={pending}
                leadingIcon={pending ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
              >
                {pending ? 'Scanning repairs' : 'Scan remaining smart repairs'}
              </Button>
            </form>
          ) : null}

          <GeneratorUnscheduledList
            sessions={
              preview.unscheduled
            }
            academicPeriodId={preview.academicPeriod.id}
            exchangeAction={exchangeAction}
            exchangePending={exchangePending}
            exchangeSuggestionsEvaluated={
              preview.exchangeSuggestionsEvaluated ?? true
            }
          />

          <GeneratorConflictList
            conflicts={
              preview.conflicts
            }
          />

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Master timetable preview
              </h2>

              <p className="mt-1 text-sm text-text-muted">
                Generated{' '}
                {new Date(
                  preview.generatedAt,
                ).toLocaleString()}.
                No session has been saved yet.
                {preview.unscheduled.length > 0
                  ? ` ${preview.unscheduled.length} unresolved session${preview.unscheduled.length === 1 ? ' is' : 's are'} omitted from this grid.`
                  : ''}
              </p>
            </div>

            <GeneratorMasterGrid preview={preview} />

            <GeneratorSessionTable
              sessions={preview.sessions}
            />
          </section>

          <section className="rounded-2xl border border-primary-soft bg-primary-subtle p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold text-text-primary">Save enterprise draft</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
                  Saving regenerates from current authoritative data, replaces editable draft sessions, preserves locked sessions and records an auditable generation run.
                </p>
              </div>
              <form action={persistAction}>
                <input type="hidden" name="academicPeriodId" value={preview.academicPeriod.id} />
                <input type="hidden" name="overwriteExisting" value="true" />
                <Button
                  type="submit"
                  size="lg"
                  disabled={
                    persistPending ||
                    !preview.readiness.isReady ||
                    preview.statistics.unscheduledSessionCount > 0 ||
                    preview.statistics.blockedConflictCount > 0
                  }
                  leadingIcon={persistPending ? (
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="size-4" aria-hidden="true" />
                  )}
                >
                  {persistPending ? 'Saving draft' : 'Save draft timetable'}
                </Button>
              </form>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
