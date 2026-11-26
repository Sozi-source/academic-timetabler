'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  initialInlineAllocationState,
  type InlineAllocationMutationState,
} from './inline-allocation-state';
import { unassignTeachingAllocationInlineAction } from './simple-allocation-actions';
import { useScrollPreservingRefresh } from './use-scroll-preserving-refresh';

export function UnassignAllocationForm({
  allocationId,
  academicPeriodId,
  allocationTrainer,
  allocationQuery,
  unitLabel,
}: {
  allocationId: string;
  academicPeriodId: string;
  allocationTrainer: string;
  allocationQuery: string;
  unitLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<InlineAllocationMutationState>(
    initialInlineAllocationState,
  );
  const [isPending, startTransition] = useTransition();

  const { captureScrollPosition } = useScrollPreservingRefresh(state);

  function handleConfirm(formData: FormData) {
    captureScrollPosition();
    startTransition(async () => {
      const next = await unassignTeachingAllocationInlineAction(state, formData);
      setState(next);
      if (next.status === 'success') {
        setIsOpen(false);
      }
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="h-9 rounded-xl border border-danger-border bg-surface px-3 text-xs font-semibold text-danger hover:bg-danger-surface transition-colors cursor-pointer"
        >
          Unassign
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Unassignment</DialogTitle>
        </DialogHeader>
        <DialogBody className="text-sm text-text-secondary leading-relaxed space-y-2">
          <p>
            Are you sure you want to unassign <span className="font-semibold text-text-primary">{unitLabel}</span> from the live draft?
          </p>
          {state.status === 'error' && state.message ? (
            <p role="alert" className="text-xs font-medium text-danger">
              {state.message}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setIsOpen(false)}
            className="text-xs font-semibold h-9 rounded-xl"
          >
            Cancel
          </Button>
          <form action={handleConfirm}>
            <input type="hidden" name="allocationId" value={allocationId} />
            <input type="hidden" name="academicPeriodId" value={academicPeriodId} />
            <input type="hidden" name="allocationTrainer" value={allocationTrainer} />
            <input type="hidden" name="allocationQuery" value={allocationQuery} />
            <Button
              type="submit"
              disabled={isPending}
              variant="outline"
              className="border-danger-border bg-danger-surface text-danger hover:bg-danger-surface hover:border-danger/40 text-xs font-semibold h-9 rounded-xl transition-colors disabled:cursor-wait"
            >
              {isPending ? 'Unassigning…' : 'Unassign trainer'}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
