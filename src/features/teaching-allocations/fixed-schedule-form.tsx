import { setFixedScheduleAction } from './simple-allocation-actions';

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
  const secondSessionAvailable = weeklySessions >= 2;
  const orderedSlots = [...slots].sort(
    (first, second) => first.sequence_number - second.sequence_number,
  );
  const firstTeachingSlot = orderedSlots[0];
  const lastTeachingSlot = orderedSlots.at(-1);
  const fullDayLabel = firstTeachingSlot && lastTeachingSlot
    ? `${formatClock(firstTeachingSlot.starts_at)}–${formatClock(lastTeachingSlot.ends_at)}`
    : '08:00–16:00';
  const firstSavedDayId = fixedWorkingDayIds[0] ?? fixedDayId ?? '';
  const secondSavedDayId = fixedWorkingDayIds[1] ??
    (fixedSlotIds[1] ? fixedDayId ?? '' : '');
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
      <input
        type="hidden"
        name="scheduleMode"
        value={isFullDaySession ? 'full_day' : 'standard'}
      />

      {isFullDaySession ? (
        <div className="grid gap-2 sm:grid-cols-[repeat(2,minmax(0,1fr))_auto]">
          <label className="text-xs font-medium text-text-muted">
            Day
            <select
              name="workingDayId"
              defaultValue={fixedDayId ?? ''}
              className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-2 text-sm text-text-primary"
              required
              disabled={disabled}
            >
              <option value="">Select day</option>
              {days.map((day) => (
                <option key={day.id} value={day.id}>
                  {formatDay(day.day_of_week)}
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs font-medium text-text-muted">
            Schedule
            <div className="mt-1 flex h-10 items-center rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-text-primary">
              Full day · {fullDayLabel}
            </div>
          </div>
          <button disabled={disabled} className="h-10 self-end whitespace-nowrap rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-text-primary disabled:cursor-not-allowed disabled:opacity-60">
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
              className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-2 text-sm text-text-primary"
              required
              disabled={disabled}
            >
              <option value="">Select day</option>
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
              className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-2 text-sm text-text-primary"
              required
              disabled={disabled}
            >
              <option value="">Select session</option>
              {slots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-text-muted">
            Second day
            <select
              name="secondWorkingDayId"
              defaultValue={secondSavedDayId}
              className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-2 text-sm text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
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
              className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-2 text-sm text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled || !secondSessionAvailable}
            >
              <option value="">Not fixed</option>
              {slots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.name}
                </option>
              ))}
            </select>
          </label>
          <button disabled={disabled} className="h-10 self-end whitespace-nowrap rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-text-primary disabled:cursor-not-allowed disabled:opacity-60">
            Save fixed sessions
          </button>
        </div>
      )}

      {isFullDaySession && fullDay ? (
        <p className="text-xs font-medium text-primary">
          Saved: {formatDay(fullDay.day_of_week)} · Full day ({fullDayLabel})
        </p>
      ) : savedPatterns.length > 0 ? (
        <p className="text-xs font-medium text-primary">
          Saved: {savedPatterns.join(' + ')}
        </p>
      ) : (
        <p className="text-xs text-text-muted">
          {isFullDaySession
            ? `Clinical Rotation is scheduled as one full-day block (${fullDayLabel}).`
            : secondSessionAvailable
              ? 'Save each fixed weekly session before assigning. Selected-time trainers must be available in the same periods.'
              : 'This unit requires one session per week.'}
        </p>
      )}
    </form>
  );
}
