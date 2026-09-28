'use client';

import {
  useActionState,
} from 'react';

import {
  Button,
} from '@/components/ui/button';
import {
  Select,
} from '@/components/ui/select';

import {
  setAcademicPeriodStatusAction,
} from './actions';
import type {
  AcademicPeriod,
  AcademicPeriodStatus,
} from './types';

interface AcademicPeriodLifecycleActionProps {
  academicPeriod: AcademicPeriod;
}

const statusOptions: ReadonlyArray<{
  value: AcademicPeriodStatus;
  label: string;
}> = [
  {
    value: 'planned',
    label: 'Planned',
  },
  {
    value: 'active',
    label: 'Active',
  },
  {
    value: 'closed',
    label: 'Closed',
  },
  {
    value: 'archived',
    label: 'Archived',
  },
];

interface StatusActionState {
  status:
    | 'idle'
    | 'success'
    | 'error';
  message: string | null;
}

const initialState:
StatusActionState = {
  status: 'idle',
  message: null,
};

export function AcademicPeriodLifecycleAction({
  academicPeriod,
}: AcademicPeriodLifecycleActionProps) {
  async function changeStatus(
    _previousState: StatusActionState,
    formData: FormData,
  ): Promise<StatusActionState> {
    try {
      await setAcademicPeriodStatusAction(
        formData,
      );

      return {
        status: 'success',
        message: 'Status updated.',
      };
    }
    catch (error) {
      return {
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to update status.',
      };
    }
  }

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    changeStatus,
    initialState,
  );

  return (
    <div className="min-w-0 max-w-full">
      <form
        action={formAction}
        className="flex min-w-0 flex-wrap items-center gap-2"
      >
        <input
          type="hidden"
          name="id"
          value={academicPeriod.id}
        />

        <Select
          name="status"
          defaultValue={
            academicPeriod.status
          }
          disabled={pending}
          aria-label={`Status for ${academicPeriod.name}`}
          className="min-h-9 max-w-full text-xs"
        >
          {statusOptions.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ),
          )}
        </Select>

        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={pending}
        >
          {pending
            ? 'Saving...'
            : 'Set'}
        </Button>
      </form>

      {state.status === 'error' ? (
        <p className="mt-1 text-xs text-danger">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

export function getAcademicPeriodLifecycleActions() {
  return [];
}