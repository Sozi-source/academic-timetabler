'use client';

import { useFormStatus } from 'react-dom';
import { unassignTeachingAllocationAction } from './simple-allocation-actions';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 rounded-xl border border-danger-border bg-surface px-3 text-xs font-semibold text-danger hover:bg-danger-surface disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? 'Unassigning…' : 'Unassign'}
    </button>
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
  return (
    <form
      action={unassignTeachingAllocationAction}
      onSubmit={(event) => {
        if (!window.confirm(`Unassign ${unitLabel} from the live draft? Its current draft sessions will be removed and it will return to the allocation queue. The published timetable will not change.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="allocationId" value={allocationId} />
      <input type="hidden" name="academicPeriodId" value={academicPeriodId} />
      <input type="hidden" name="allocationTrainer" value={allocationTrainer} />
      <input type="hidden" name="allocationQuery" value={allocationQuery} />
      <SubmitButton />
    </form>
  );
}
