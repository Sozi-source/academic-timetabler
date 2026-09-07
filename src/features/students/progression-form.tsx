'use client';

import { LoaderCircle, Save } from 'lucide-react';
import { useActionState, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { recordStudentProgressionAction } from './actions';
import {
  initialStudentProgressionActionState,
  type StudentCohortOption,
  type StudentLifecycleStatus,
} from './types';

interface ProgressionFormProps {
  studentId: string;
  status: StudentLifecycleStatus;
  currentCohortId: string | null;
  cohorts: StudentCohortOption[];
}

const labels = {
  deferral: 'Defer studies',
  resumption: 'Resume studies / Return to active cohort',
  programme_completion: 'Mark completed',
  graduation: 'Mark graduated',
} as const;

type Transition = keyof typeof labels;

function availableTransitions(status: StudentLifecycleStatus): Transition[] {
  if (status === 'admitted' || status === 'active') {
    return ['deferral', 'programme_completion'];
  }
  if (status === 'deferred') return ['resumption'];
  if (status === 'completed') return ['graduation', 'resumption'];
  return [];
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-[0.6875rem] font-medium text-danger">{message}</p>;
}

export function ProgressionForm({ studentId, status, currentCohortId, cohorts }: ProgressionFormProps) {
  const transitions = useMemo(() => availableTransitions(status), [status]);
  const [eventType, setEventType] = useState<Transition | ''>(transitions[0] ?? '');
  const [state, formAction, pending] = useActionState(
    recordStudentProgressionAction,
    initialStudentProgressionActionState,
  );

  if (transitions.length === 0) {
    return <p className="text-xs text-text-muted">No progression action is available for this status.</p>;
  }

  const needsReturnDate = eventType === 'deferral';
  const needsCohort = eventType === 'resumption';
  const needsReason = eventType === 'deferral';

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="studentId" value={studentId} />

      {state.message ? (
        <FormStatusMessage status={state.status === 'success' ? 'success' : 'error'} message={state.message} />
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-semibold text-text-primary">
          Action
          <Select
            name="eventType"
            value={eventType}
            onChange={(event) => setEventType(event.target.value as Transition)}
            className="mt-1 h-9 rounded-lg text-xs"
            hasError={Boolean(state.fieldErrors?.eventType?.[0])}
          >
            {transitions.map((transition) => (
              <option key={transition} value={transition}>{labels[transition]}</option>
            ))}
          </Select>
          <FieldError message={state.fieldErrors?.eventType?.[0]} />
        </label>

        <label className="text-xs font-semibold text-text-primary">
          Effective date
          <Input
            type="date"
            name="effectiveDate"
            className="mt-1 h-9 rounded-lg text-xs"
            hasError={Boolean(state.fieldErrors?.effectiveDate?.[0])}
          />
          <FieldError message={state.fieldErrors?.effectiveDate?.[0]} />
        </label>
      </div>

      {needsCohort ? (
        <label className="block text-xs font-semibold text-text-primary">
          Study cohort
          <Select
            name="targetCohortId"
            defaultValue={currentCohortId ?? ''}
            className="mt-1 h-9 rounded-lg text-xs"
            hasError={Boolean(state.fieldErrors?.targetCohortId?.[0])}
          >
            <option value="">Select cohort</option>
            {cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
            ))}
          </Select>
          <FieldError message={state.fieldErrors?.targetCohortId?.[0]} />
        </label>
      ) : null}

      {needsReturnDate ? (
        <label className="block text-xs font-semibold text-text-primary">
          Expected return
          <Input
            type="date"
            name="expectedResumeDate"
            className="mt-1 h-9 rounded-lg text-xs"
            hasError={Boolean(state.fieldErrors?.expectedResumeDate?.[0])}
          />
          <FieldError message={state.fieldErrors?.expectedResumeDate?.[0]} />
        </label>
      ) : null}

      {needsReason ? (
        <label className="block text-xs font-semibold text-text-primary">
          Reason
          <Input
            name="reason"
            placeholder="Brief reason"
            className="mt-1 h-9 rounded-lg text-xs"
            hasError={Boolean(state.fieldErrors?.reason?.[0])}
          />
          <FieldError message={state.fieldErrors?.reason?.[0]} />
        </label>
      ) : null}

      <label className="block text-xs font-semibold text-text-primary">
        Note <span className="font-normal text-text-muted">(optional)</span>
        <textarea
          name="notes"
          rows={2}
          className="mt-1 w-full resize-none rounded-lg border border-border-strong bg-surface px-3 py-2 text-xs text-text-primary outline-none transition focus:border-focus-border focus:ring-4 focus:ring-focus-ring/25"
          placeholder="Short administrative note"
        />
        <FieldError message={state.fieldErrors?.notes?.[0]} />
      </label>

      <div className="flex justify-end border-t border-border pt-3">
        <Button type="submit" disabled={pending} size="sm" leadingIcon={pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}>
          {pending ? 'Saving' : 'Save progression'}
        </Button>
      </div>
    </form>
  );
}
