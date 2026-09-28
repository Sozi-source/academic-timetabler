'use client';

import { Plus, LoaderCircle } from 'lucide-react';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { FormStatusMessage } from '@/components/ui/form-status-message';
import { Select } from '@/components/ui/select';

import { createManualTrainerEntryAction } from './actions';
import { initialManualEntryState, type ManualEntryOptions } from './manual-entry';

const inputClass = 'h-10 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm outline-none focus:border-primary';

export function ManualTrainerEntryForm({ academicPeriodId, options }: { academicPeriodId: string; options: ManualEntryOptions }) {
  const [state, action, pending] = useActionState(createManualTrainerEntryAction, initialManualEntryState);
  return (
    <section className="rounded-2xl border border-primary/20 bg-primary-soft/20 p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="font-semibold text-text-primary">Add an external-department unit</h2>
        <p className="mt-1 text-xs text-text-muted">Add a unit directly to a trainer’s personal timetable when its owning department has not scheduled it in this system.</p>
      </div>
      <form action={action} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input type="hidden" name="academicPeriodId" value={academicPeriodId} />
        <label className="space-y-1 text-xs font-semibold text-text-secondary">Trainer
          <Select name="trainerId" required><option value="">Select trainer</option>{options.trainers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-text-secondary">Unit code
          <input className={inputClass} name="unitCode" placeholder="Optional" />
        </label>
        <label className="space-y-1 text-xs font-semibold text-text-secondary">Unit name
          <input className={inputClass} name="unitName" required placeholder="Unit title" />
        </label>
        <label className="space-y-1 text-xs font-semibold text-text-secondary">Cohort / class
          <input className={inputClass} name="cohortLabel" required placeholder="e.g. ICT Level 5" />
        </label>
        <label className="space-y-1 text-xs font-semibold text-text-secondary">Owning department
          <Select name="sourceDepartmentId" required><option value="">Select department</option>{options.departments.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-text-secondary">Day
          <Select name="workingDayId" required><option value="">Select day</option>{options.workingDays.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-text-secondary">Time
          <Select name="timeSlotId" required><option value="">Select time</option>{options.timeSlots.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-text-secondary">Venue
          <Select name="roomId"><option value="">No room assigned</option>{options.rooms.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-text-secondary md:col-span-2">Note
          <input className={inputClass} name="notes" placeholder="Why this unit was added manually" />
        </label>
        <div className="flex items-end"><Button type="submit" disabled={pending} leadingIcon={pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}>{pending ? 'Adding…' : 'Add to timetable'}</Button></div>
        {state.message ? <div className="md:col-span-2 xl:col-span-3"><FormStatusMessage status={state.status === 'success' ? 'success' : 'error'} message={state.message} /></div> : null}
      </form>
    </section>
  );
}
