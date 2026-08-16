'use client';

import Link from 'next/link';
import {
  Archive,
  CheckCircle2,
  LoaderCircle,
  Send,
} from 'lucide-react';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';

import {
  createTimetableVersionAction,
  transitionTimetableVersionAction,
} from './actions';
import {
  initialPublicationActionState,
  type TimetableVersionStatus,
} from './types';
import { getTransitionLabel } from './workflow';

function ActionFeedback({
  state,
}: {
  state: typeof initialPublicationActionState;
}) {
  if (!state.message || state.status === 'idle') return null;

  return (
    <div className="space-y-2 md:col-span-full" aria-live="polite">
      <FormStatusMessage
        status={state.status === 'success' ? 'success' : 'error'}
        title={state.title}
        message={state.message}
      />
      {state.actionHref && state.actionLabel ? (
        <Link
          href={state.actionHref}
          className="inline-flex h-9 items-center rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-text-primary hover:bg-surface-subtle"
        >
          {state.actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function CreateTimetableVersionForm({
  academicPeriodId,
}: {
  academicPeriodId: string;
}) {
  const [state, action, pending] = useActionState(
    createTimetableVersionAction,
    initialPublicationActionState,
  );

  return (
    <form action={action} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <input type="hidden" name="academicPeriodId" value={academicPeriodId} />
      <h2 className="font-semibold text-text-primary">Create a controlled timetable version</h2>
      <p className="mt-1 text-sm text-text-muted">
        Capture the current timetable as an immutable working snapshot. A version may be published with a few unassigned sessions; they remain clearly marked for follow-up.
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.4fr_auto]">
        <input
          name="title"
          required
          minLength={3}
          placeholder="e.g. September–December 2026 master timetable"
          className="h-11 rounded-xl border border-border-strong bg-surface px-3 text-sm"
        />
        <input
          name="changeSummary"
          placeholder="What changed in this version?"
          className="h-11 rounded-xl border border-border-strong bg-surface px-3 text-sm"
        />
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          leadingIcon={pending ? <LoaderCircle className="size-4 animate-spin" /> : undefined}
        >
          {pending ? 'Creating version' : 'Create version'}
        </Button>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}

export function TimetableTransitionForm({
  academicPeriodId,
  versionId,
  currentStatus,
  transitions,
}: {
  academicPeriodId: string;
  versionId: string;
  currentStatus: TimetableVersionStatus;
  transitions: TimetableVersionStatus[];
}) {
  const [state, action, pending] = useActionState(
    transitionTimetableVersionAction,
    initialPublicationActionState,
  );

  return (
    <form action={action} className="mt-5 grid gap-3 border-t border-border pt-4 md:grid-cols-[1fr_auto]">
      <input type="hidden" name="academicPeriodId" value={academicPeriodId} />
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="currentStatus" value={currentStatus} />
      <input
        name="note"
        placeholder="Review, approval or publication note"
        className="h-10 rounded-xl border border-border-strong bg-surface px-3 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        {transitions.map((target) => (
          <Button
            key={target}
            type="submit"
            name="targetStatus"
            value={target}
            variant="outline"
            disabled={pending}
            leadingIcon={pending
              ? <LoaderCircle className="size-4 animate-spin" />
              : target === 'published'
                ? <Send className="size-4" />
                : target === 'archived'
                  ? <Archive className="size-4" />
                  : <CheckCircle2 className="size-4" />}
          >
            {pending ? 'Checking timetable' : getTransitionLabel(target)}
          </Button>
        ))}
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
