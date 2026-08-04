'use client';

import {
  CalendarCheck2,
  LoaderCircle,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';
import {
  useActionState,
} from 'react';

import {
  Button,
} from '@/components/ui/button';
import {
  FormStatusMessage,
} from '@/components/ui/form-status-message';

import {
  generateTimetablePreviewAction,
  saveGeneratedTimetableDraftAction,
} from './actions';
import {
  GeneratorConflictList,
  GeneratorUnscheduledList,
} from './generator-issues';
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
  initialGeneratorPersistActionState,
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

  const preview = state.preview;

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

          <GeneratorUnscheduledList
            sessions={
              preview.unscheduled
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
                Generated timetable preview
              </h2>

              <p className="mt-1 text-sm text-text-muted">
                Generated{' '}
                {new Date(
                  preview.generatedAt,
                ).toLocaleString()}.
                No session has been saved yet.
              </p>
            </div>

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