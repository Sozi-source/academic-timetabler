'use client';

import { LoaderCircle } from 'lucide-react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { assignOfferingAction } from './simple-allocation-actions';

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
  return (
    <form
      action={assignOfferingAction}
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
  );
}
