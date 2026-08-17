'use client';

import { useActionState } from 'react';
import { Send } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { submitStudentUnitRegistration, type StudentRegistrationState } from './actions';
import type { StudentPortalUnit } from './types';

const initialState: StudentRegistrationState = { error: null, success: null };

export function StudentUnitRegistrationForm({
  academicPeriodId,
  units,
}: {
  academicPeriodId: string;
  units: StudentPortalUnit[];
}) {
  const [state, action, pending] = useActionState(submitStudentUnitRegistration, initialState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="academicPeriodId" value={academicPeriodId} />
      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="grid grid-cols-[2rem_7rem_1fr_5rem] gap-2 border-b border-border bg-surface-subtle px-4 py-2 text-[0.6875rem] font-bold uppercase tracking-wide text-text-muted">
          <span />
          <span>Code</span>
          <span>Unit</span>
          <span>Type</span>
        </div>
        <div className="divide-y divide-border">
          {units.map((unit) => (
            <label key={unit.unitId} className="grid cursor-pointer grid-cols-[2rem_7rem_1fr_5rem] items-center gap-2 px-4 py-2.5 text-xs hover:bg-surface-subtle/60">
              <input
                type="checkbox"
                name="unitIds"
                value={unit.unitId}
                defaultChecked={unit.selected}
                className="size-4 accent-[var(--primary)]"
              />
              <span className="font-semibold text-text-primary">{unit.unitCode}</span>
              <span className="text-text-primary">{unit.unitName}</span>
              <span className="text-[0.6875rem] text-text-muted">{unit.expected ? 'Expected' : 'Other'}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-text-primary" htmlFor="exceptionReason">Reason for any unit change</label>
        <textarea
          id="exceptionReason"
          name="exceptionReason"
          rows={2}
          className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-xs text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          placeholder="Required only if you add or remove an expected unit."
        />
      </div>

      {state.error ? <p className="text-xs font-medium text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-xs font-medium text-success">{state.success}</p> : null}

      <Button type="submit" disabled={pending || units.length === 0}>
        <Send className="size-4" />
        {pending ? 'Submitting…' : 'Submit registration'}
      </Button>
    </form>
  );
}
