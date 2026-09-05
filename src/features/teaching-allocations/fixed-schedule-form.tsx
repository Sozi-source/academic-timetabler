'use client';

import { useState } from 'react';
import {
  clearFixedScheduleAction,
  setFixedScheduleAction,
} from './simple-allocation-actions';

interface FixedScheduleDay {
  id: string;
  day_of_week: string;
}

interface FixedScheduleSlot {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  sequence_number: number;
}

interface FixedScheduleFormProps {
  offeringId: string;
  academicPeriodId: string;
  searchQuery: string;
  weeklySessions: number;
  days: FixedScheduleDay[];
  slots: FixedScheduleSlot[];
  fixedDayId: string | null;
  fixedWorkingDayIds: string[];
  fixedSlotIds: string[];
  isFullDaySession: boolean;
  disabled?: boolean;
}

function formatClock(value: string) {
  const [hours = '00', minutes = '00'] = value.split(':');
  return `${hours}:${minutes}`;
}

function formatDay(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function FixedScheduleForm({
  offeringId,
  academicPeriodId,
  searchQuery,
  weeklySessions,
  days,
  slots,
  fixedDayId,
  fixedWorkingDayIds,
  fixedSlotIds,
  isFullDaySession,
  disabled = false,
}: FixedScheduleFormProps) {
  const [scheduleMode, setScheduleMode] = useState<'standard' | 'full_day'>(
    isFullDaySession ? 'full_day' : 'standard',
  );

  const secondSessionAvailable = weeklySessions >= 2;
  const orderedSlots = [...slots].sort(
    (first, second) => first.sequence_number - second.sequence_number,
  );
  const firstTeachingSlot = orderedSlots[0];
  const lastTeachingSlot = orderedSlots.at(-1);
  const fullDayLabel =
    firstTeachingSlot && lastTeachingSlot
      ? `${formatClock(firstTeachingSlot.starts_at)}–${formatClock(lastTeachingSlot.ends_at)}`
      : '08:00–16:00';

  const firstSavedDayId = fixedWorkingDayIds[0] ?? fixedDayId ?? '';
  const secondSavedDayId =
    fixedWorkingDayIds[1] ?? (fixedSlotIds[1] ? fixedDayId ?? '' : '');

  const savedPatterns = fixedSlotIds
    .map((slotId, index) => {
      const slot = slots.find((item) => item.id === slotId);
      const dayId = fixedWorkingDayIds[index] ?? fixedDayId;
      const day = days.find((item) => item.id === dayId);
      return slot && day ? `${formatDay(day.day_of_week)} · ${slot.name}` : null;
    })
    .filter((value): value is string => Boolean(value));

  const fullDay = days.find((day) => day.id === fixedDayId);

  return (
    <form
      action={setFixedScheduleAction}
      className="space-y-2 rounded-xl border border-border bg-surface-subtle p-3"
    >
      <input type="hidden" name="offeringId" value={offeringId} />
      <input type="hidden" name="academicPeriodId" value={academicPeriodId} />
      <input type="hidden" name="searchQuery" value={searchQuery} />
      <input type="hidden" name="scheduleMode" value={scheduleMode} />

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Schedule format
        </span>
        <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setScheduleMode('standard')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              scheduleMode === 'standard'
                ? 'bg-primary text-primary-contrast shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Morning / Fixed (120 min)
          </button>
          <button
            type="button"
            onClick={() => setScheduleMode('full_day')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              scheduleMode === 'full_day'
                ? 'bg-primary text-primary-contrast shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Full day block ({fullDayLabel})
          </button>
        </div>
      </div>

      {scheduleMode === 'full_day' ? (
        <div className="grid gap-2 sm:grid-cols-[repeat(2,minmax(0,1fr))_auto]">
          <label className="text-xs font-medium text-text-muted">
            Day
            <select
              name="workingDayId"
              defaultValue={fixedDayId ?? ''}
              className="mt-1 h-8 w-full rounded-xl border border-border bg-surface px-2 text-xs text-text-primary"
              required
              disabled={disabled}
            >
              <option value="">Select</option>
              {days.map((day) => (
                <option key={day.id} value={day.id}>
                  {formatDay(day.day_of_week)}
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs font-medium text-text-muted">
            Schedule
            <div className="mt-1 flex h-8 items-center rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-text-primary">
              Full day · {fullDayLabel} (2.0h supervision load)
            </div>
          </div>
          <button
            disabled={disabled}
            className="h-8 self-end whitespace-nowrap rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-text-primary hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save full day
          </button>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
          <label className="text-xs font-medium text-text-muted">
            First day
            <select
              name="firstWorkingDayId"
              defaultValue={firstSavedDayId}
              className="mt-1 h-8 w-full rounded-xl border border-border bg-surface px-2 text-xs text-text-primary"
              required
              disabled={disabled}
            >
              <option value="">Select</option>
              {days.map((day) => (
                <option key={day.id} value={day.id}>
                  {formatDay(day.day_of_week)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-text-muted">
            First session
            <select
              name="firstTimeSlotId"
              defaultValue={fixedSlotIds[0] ?? ''}
              className="mt-1 h-8 w-full rounded-xl border border-border bg-surface px-2 text-xs text-text-primary"
              required
              disabled={disabled}
            >
              <option value="">Select</option>
              {slots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.name} ({formatClock(slot.starts_at)}–{formatClock(slot.ends_at)})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-text-muted">
            Second day
            <select
              name="secondWorkingDayId"
              defaultValue={secondSavedDayId}
              className="mt-1 h-8 w-full rounded-xl border border-border bg-surface px-2 text-xs text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled || !secondSessionAvailable}
            >
              <option value="">Not fixed</option>
              {days.map((day) => (
                <option key={day.id} value={day.id}>
                  {formatDay(day.day_of_week)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-text-muted">
            Second session
            <select
              name="secondTimeSlotId"
              defaultValue={fixedSlotIds[1] ?? ''}
              className="mt-1 h-8 w-full rounded-xl border border-border bg-surface px-2 text-xs text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled || !secondSessionAvailable}
            >
              <option value="">Not fixed</option>
              {slots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.name} ({formatClock(slot.starts_at)}–{formatClock(slot.ends_at)})
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={disabled}
            className="h-8 self-end whitespace-nowrap rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-text-primary hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save fixed session
          </button>
        </div>
      )}

      {isFullDaySession && fullDay ? (
        <p className="text-xs font-medium text-primary">
          Saved: {formatDay(fullDay.day_of_week)} · Full day ({fullDayLabel})
        </p>
      ) : savedPatterns.length > 0 ? (
        <p className="text-xs font-medium text-primary">
          Saved: {savedPatterns.join(' + ')} (2.0h workload)
        </p>
      ) : (
        <p className="text-xs text-text-muted">
          {scheduleMode === 'full_day'
            ? `Hospital full-day block (${fullDayLabel}, 8.0h trainer allocation).`
            : 'Morning supervision check-in (120 min, 2.0h trainer allocation).'}
        </p>
      )}

      {fullDay || savedPatterns.length > 0 ? (
        <div className="flex justify-end border-t border-border pt-2">
          <button
            type="submit"
            formAction={clearFixedScheduleAction}
            formNoValidate
            disabled={disabled}
            className="text-xs font-semibold text-danger hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            Undo fixed time
          </button>
        </div>
      ) : null}
    </form>
  );
}
