'use client';

import Link from 'next/link';
import { useState } from 'react';

import { addStudentClassAssignment } from './class-assignment-actions';

export interface StudentClassAssignmentOption {
  id: string;
  label: string;
  disabled?: boolean;
}

interface StudentClassAssignmentFormProps {
  studentId: string;
  registrations: StudentClassAssignmentOption[];
  allocationsByRegistration: Record<string, StudentClassAssignmentOption[]>;
}

export function StudentClassAssignmentForm({
  studentId,
  registrations,
  allocationsByRegistration,
}: StudentClassAssignmentFormProps) {
  const [registrationId, setRegistrationId] = useState(registrations[0]?.id ?? '');
  const allocations = allocationsByRegistration[registrationId] ?? [];
  const availableAllocations = allocations.filter((allocation) => !allocation.disabled);

  return (
    <form action={addStudentClassAssignment} className="mt-4 grid gap-3 md:grid-cols-2">
      <input type="hidden" name="studentId" value={studentId} />
      <label className="grid gap-1 text-sm font-medium text-text-secondary">Student&apos;s registered unit
        <select
          required
          name="registrationId"
          value={registrationId}
          onChange={(event) => setRegistrationId(event.target.value)}
          className="h-10 rounded-lg border border-border bg-surface px-3 text-text-primary"
        >
          {registrations.map((registration) => <option key={registration.id} value={registration.id}>{registration.label}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium text-text-secondary">Equivalent target class
        <select
          required
          name="allocationId"
          disabled={availableAllocations.length === 0}
          defaultValue={availableAllocations[0]?.id ?? ''}
          key={registrationId}
          className="h-10 rounded-lg border border-border bg-surface px-3 text-text-primary disabled:cursor-not-allowed disabled:bg-surface-subtle"
        >
          {allocations.length === 0 ? <option value="">No active equivalent classes available</option> : null}
          {allocations.map((allocation) => <option key={allocation.id} value={allocation.id} disabled={allocation.disabled}>{allocation.label}</option>)}
        </select>
      </label>
      {allocations.length === 0 ? (
        <p className="text-xs text-text-muted md:col-span-2">There is no active class for this unit or an approved equivalent in the current academic period. <Link href="/timetable/unit-equivalence" className="font-medium text-primary underline underline-offset-2">Review unit equivalence</Link>.</p>
      ) : availableAllocations.length === 0 ? (
        <p className="text-xs text-text-muted md:col-span-2">All matching classes already have active assignments. Remove an assignment below before adding it again.</p>
      ) : null}
      <label className="grid gap-1 text-sm font-medium text-text-secondary md:col-span-2">Reason
        <input required minLength={3} maxLength={500} name="reason" placeholder="For example: resuming deferred units with the current delivery cohort" className="h-10 rounded-lg border border-border bg-surface px-3 text-text-primary" />
      </label>
      <button disabled={availableAllocations.length === 0} className="h-10 w-fit rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">Add student to class</button>
    </form>
  );
}
