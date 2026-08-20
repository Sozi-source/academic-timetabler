'use client';

import { useMemo, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { createSchedulingConstraintAction } from './actions';
import type {
  ConstraintOption,
  ConstraintSubjectType,
  TimeSlotOption,
  WorkingDayOption,
} from './types';

interface ConstraintFormProps {
  academicPeriodId: string;
  trainers: ConstraintOption[];
  rooms: ConstraintOption[];
  cohorts: ConstraintOption[];
  workingDays: WorkingDayOption[];
  timeSlots: TimeSlotOption[];
}

const subjectLabels: Record<ConstraintSubjectType, string> = {
  trainer: 'Trainer',
  room: 'Room',
  cohort: 'Cohort',
  institution: 'Institution',
};

export function ConstraintForm({
  academicPeriodId,
  trainers,
  rooms,
  cohorts,
  workingDays,
  timeSlots,
}: ConstraintFormProps) {
  const [subjectType, setSubjectType] =
    useState<ConstraintSubjectType>('trainer');

  const records = useMemo(() => {
    if (subjectType === 'trainer') return trainers;
    if (subjectType === 'room') return rooms;
    if (subjectType === 'cohort') return cohorts;
    return [];
  }, [cohorts, rooms, subjectType, trainers]);

  const recordLabel = subjectLabels[subjectType];

  return (
    <form
      action={createSchedulingConstraintAction}
      className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
    >
      <input
        type="hidden"
        name="academicPeriodId"
        value={academicPeriodId}
      />
      <input type="hidden" name="constraintType" value="unavailable" />
      <input type="hidden" name="priority" value="hard" />

      <Field label="Applies to">
        <Select
          name="subjectType"
          value={subjectType}
          onChange={(event) =>
            setSubjectType(event.target.value as ConstraintSubjectType)
          }
        >
          <option value="trainer">Trainer</option>
          <option value="room">Room</option>
          <option value="cohort">Cohort</option>
          <option value="institution">Institution-wide</option>
        </Select>
      </Field>

      <Field label={subjectType === 'institution' ? 'Record' : recordLabel}>
        {subjectType === 'institution' ? (
          <>
            <input type="hidden" name="subjectId" value="" />
            <div className="flex h-11 items-center rounded-xl border border-border bg-surface-subtle px-3.5 text-sm text-text-muted">
              Institution-wide
            </div>
          </>
        ) : (
          <Select name="subjectId" defaultValue="" required>
            <option value="">Select {recordLabel.toLowerCase()}</option>
            {records.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Working day">
        <Select name="workingDayId" defaultValue="">
          <option value="">Any day</option>
          {workingDays.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Teaching session">
        <Select name="timeSlotId" defaultValue="">
          <option value="">All day</option>
          {timeSlots.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} ({item.startsAt}-{item.endsAt})
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Reason" optional>
        <input
          name="reason"
          maxLength={500}
          className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-text-primary shadow-sm outline-none transition hover:border-focus-border focus:border-focus-border focus:ring-4 focus:ring-focus-ring/25"
          placeholder="Optional note"
        />
      </Field>

      <div className="flex items-end md:justify-end xl:col-span-1">
        <Button type="submit" className="w-full md:w-auto">
          Save constraint
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  optional = false,
  children,
}: {
  label: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="text-xs font-semibold text-text-primary xl:text-sm">
      <span className="flex items-center gap-1.5">
        {label}
        {optional ? (
          <span className="font-normal text-text-muted">Optional</span>
        ) : null}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
