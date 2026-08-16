'use client';

import Link from 'next/link';
import {
  LoaderCircle,
  Send,
} from 'lucide-react';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';

import {
  publishCurrentTimetableAction,
} from './actions';
import {
  initialPublicationActionState,
} from './types';

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

export function PublishCurrentTimetableForm({
  academicPeriodId,
  nextVersionTitle,
}: {
  academicPeriodId: string;
  nextVersionTitle: string;
}) {
  const [state, action, pending] = useActionState(
    publishCurrentTimetableAction,
    initialPublicationActionState,
  );

  return (
    <form action={action} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <input type="hidden" name="academicPeriodId" value={academicPeriodId} />
      <h2 className="font-semibold text-text-primary">Publish the current timetable</h2>
      <p className="mt-1 text-sm text-text-muted">
        The system will run every final check, publish the timetable as <strong>{nextVersionTitle}</strong>, and archive the former published version automatically.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-text-muted">
          No title, comment, review or separate approval step is required.
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          leadingIcon={pending
            ? <LoaderCircle className="size-4 animate-spin" />
            : <Send className="size-4" />}
        >
          {pending ? 'Checking and publishing' : 'Publish current timetable'}
        </Button>
      </div>
      <div className="mt-4">
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}
