'use client';

import { LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import {
  initialInlineAllocationState,
  type InlineAllocationMutationState,
} from './inline-allocation-state';
import { assignOfferingInlineAction } from './simple-allocation-actions';
import { useScrollPreservingRefresh } from './use-scroll-preserving-refresh';

interface TrainerOption {
  id: string;
  label: string;
}

function AssignButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      leadingIcon={pending ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : undefined}
    >
      {pending ? 'Assigning' : 'Assign'}
    </Button>
  );
}

export function AssignOfferingForm({
  offeringId,
  academicPeriodId,
  searchQuery,
  trainers,
}: {
  offeringId: string;
  academicPeriodId: string;
  searchQuery: string;
  trainers: TrainerOption[];
}) {
  const [state, formAction] = useActionState<
    InlineAllocationMutationState,
    FormData
  >(assignOfferingInlineAction, initialInlineAllocationState);

  const { captureScrollPosition } = useScrollPreservingRefresh(state);

  const returnParams = new URLSearchParams();
  if (academicPeriodId) returnParams.set('period', academicPeriodId);
  if (searchQuery) returnParams.set('q', searchQuery);
  const returnTo = `/timetable/teaching-allocations${returnParams.size > 0 ? `?${returnParams.toString()}` : ''}`;

  return (
    <div className="space-y-1.5">
      <form
        action={formAction}
        onSubmit={captureScrollPosition}
        className="flex min-w-0 flex-wrap gap-2 sm:flex-nowrap"
      >
        <input type="hidden" name="offeringId" value={offeringId} />
        <input type="hidden" name="academicPeriodId" value={academicPeriodId} />
        <input type="hidden" name="searchQuery" value={searchQuery} />
        <Select name="trainerId" className="min-w-0 flex-1" required>
          <option value="">Select trainer</option>
          {trainers.map((trainer) => (
            <option key={trainer.id} value={trainer.id}>
              {trainer.label}
            </option>
          ))}
        </Select>
        <AssignButton />
      </form>
      {state.status === 'error' && state.message ? (
        <div role="alert" className="space-y-1 rounded-lg border border-danger-border bg-danger-surface px-2.5 py-1.5 text-xs text-danger">
          <p className="font-medium">{state.message}</p>
          {state.availabilityRequired ? (
            <Link
              href={`/timetable/trainers/availability?trainer=${encodeURIComponent(state.availabilityRequired.trainerId)}&period=${encodeURIComponent(state.availabilityRequired.periodId)}&returnTo=${encodeURIComponent(returnTo)}`}
              className="inline-flex font-semibold underline"
            >
              Set trainer availability
            </Link>
          ) : null}
        </div>
      ) : null}
      {state.status === 'success' && state.rescheduleNeeded ? (
        <p className="text-xs font-medium text-warning">
          Trainer assigned; temporary placeholder slot cleared. Re-run generator without overwriting existing sessions.
        </p>
      ) : null}
    </div>
  );
}
