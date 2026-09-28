'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
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
import { unassignTeachingAllocationAction } from './simple-allocation-actions';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      variant="outline"
      className="border-danger-border bg-danger-surface text-danger hover:bg-danger-surface hover:border-danger/40 text-xs font-semibold h-9 rounded-xl transition-colors disabled:cursor-wait"
    >
      {pending ? 'Unassigning…' : 'Unassign trainer'}
    </Button>
  );
}

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
          <p className="text-xs text-text-muted">
            Its current draft sessions will be removed and it will return to the allocation queue. The published timetable will not change.
          </p>
        </DialogBody>
        <DialogFooter className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            className="text-xs font-semibold h-9 rounded-xl"
          >
            Cancel
          </Button>
          <form
            action={unassignTeachingAllocationAction}
            onSubmit={() => setIsOpen(false)}
          >
            <input type="hidden" name="allocationId" value={allocationId} />
            <input type="hidden" name="academicPeriodId" value={academicPeriodId} />
            <input type="hidden" name="allocationTrainer" value={allocationTrainer} />
            <input type="hidden" name="allocationQuery" value={allocationQuery} />
            <SubmitButton />
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
