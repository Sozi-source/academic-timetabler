'use client';

import {
  CalendarCheck2,
  LoaderCircle,
  RefreshCw,
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
}: {
  academicPeriods:
    GeneratorAcademicPeriodOption[];
  defaultAcademicPeriodId:
    string | null;
}) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    generateTimetablePreviewAction,
    initialGeneratorActionState,
  );

  const preview = state.preview;

  return (
    <div className="space-y-8">
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

          <div className="rounded-2xl border border-primary-soft bg-primary-subtle px-5 py-4 text-sm leading-6 text-text-secondary">
            This is a read-only preview. Publishing to
            the scheduled sessions register will be
            added in the next phase after the preview
            workflow is verified.
          </div>
        </div>
      )}
    </div>
  );
}