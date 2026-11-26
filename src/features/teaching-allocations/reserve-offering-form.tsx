'use client';

import { LoaderCircle } from 'lucide-react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';

import {
  initialInlineAllocationState,
  type InlineAllocationMutationState,
} from './inline-allocation-state';
import { reserveOfferingWithoutTrainerInlineAction } from './simple-allocation-actions';
import { useScrollPreservingRefresh } from './use-scroll-preserving-refresh';

function ReserveButton({ reserved }: { reserved: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={reserved || pending}
      variant="outline"
      leadingIcon={
        pending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : undefined
      }
      className="w-full border-warning-border bg-warning-surface text-warning hover:bg-warning-surface"
    >
      {reserved
        ? 'Included unassigned'
        : pending
          ? 'Including…'
          : 'Include unassigned'}
    </Button>
  );
}

export function ReserveOfferingForm({
  offeringId,
  academicPeriodId,
  isProvisionallyReserved,
}: {
  offeringId: string;
  academicPeriodId: string;
  isProvisionallyReserved: boolean;
}) {
  const [state, formAction] = useActionState<
    InlineAllocationMutationState,
    FormData
  >(reserveOfferingWithoutTrainerInlineAction, initialInlineAllocationState);

  const { captureScrollPosition } = useScrollPreservingRefresh(state);

  return (
    <div className="space-y-1">
      <form action={formAction} onSubmit={captureScrollPosition}>
        <input type="hidden" name="offeringId" value={offeringId} />
        <input type="hidden" name="academicPeriodId" value={academicPeriodId} />
        <ReserveButton reserved={isProvisionallyReserved} />
      </form>
      {state.status === 'error' && state.message ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
