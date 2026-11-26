import type { ReactNode } from 'react';
import { Ban, CheckCircle2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import {
  createCalendarEventAction,
  deleteCalendarEventAction,
  deleteSchedulingConstraintAction,
  toggleCalendarEventAction,
  toggleSchedulingConstraintAction,
} from './actions';
import { ConstraintForm } from './constraint-form';
import type {
  CalendarEventType,
  ConstraintType,
  SchedulingConstraint,
  SchedulingConstraintData,
  TimeSlotOption,
} from './types';

const subjectLabels = {
  trainer: 'Trainer',
  room: 'Room',
  cohort: 'Class / cohort',
  institution: 'Institution',
} as const;

const constraintTypeLabels: Record<ConstraintType, string> = {
  unavailable: 'Unavailable',
  protected_day: 'Protected day',
  preferred: 'Preferred',
  required: 'Required',
};

const eventTypeLabels: Record<CalendarEventType, string> = {
  holiday: 'Public holiday',
  cat_exam: 'CAT / Exam window',
  seminar: 'Seminar / Guest talk',
  field_trip: 'Field trip / Outreach',
  custom: 'Unique event',
};

export function ConstraintWorkspace({
  academicPeriodId,
  data,
}: {
  academicPeriodId: string;
  data: SchedulingConstraintData;
}) {
  return (
    <div className="space-y-4">
      <Card className="p-4 xl:p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-text-primary xl:text-base">
            Add rule or preference
          </h2>
        </div>

        <ConstraintForm
          academicPeriodId={academicPeriodId}
          trainers={data.trainers}
          rooms={data.rooms}
          cohorts={data.cohorts}
          workingDays={data.workingDays}
          timeSlots={data.timeSlots}
        />
      </Card>

      <Card>
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary xl:text-base">
            Constraint register
          </h2>
        </div>

        {data.constraints.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">
            No constraints configured for this Academic Period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs xl:text-sm">
              <thead className="bg-surface-subtle text-text-secondary">
                <tr>
                  <Th>Subject</Th>
                  <Th>Rule</Th>
                  <Th>When</Th>
                  <Th>Reason</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>

              <tbody>
                {data.constraints.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <Td>
                      <div className="font-medium text-text-primary">
                        {item.subjectLabel}
                      </div>
                      <div className="mt-0.5 text-[11px] text-text-muted xl:text-xs">
                        {subjectLabels[item.subjectType]}
                      </div>
                    </Td>

                    <Td>
                      <div className="font-medium text-text-primary">
                        {constraintTypeLabels[item.constraintType]}
                      </div>
                      <div className="mt-0.5 text-[11px] text-text-muted xl:text-xs capitalize">
                        {item.priority}
                      </div>
                    </Td>

                    <Td>{formatWhen(item, data.timeSlots)}</Td>

                    <Td className="max-w-[18rem] text-text-secondary">
                      {formatReason(item)}
                    </Td>

                    <Td>
                      <span className="text-[11px] font-medium text-text-muted xl:text-xs">
                        {item.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </Td>

                    <Td>
                      <div className="flex items-center gap-1.5">
                        <form action={toggleSchedulingConstraintAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input
                            type="hidden"
                            name="isActive"
                            value={String(!item.isActive)}
                          />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            leadingIcon={
                              item.isActive ? (
                                <Ban className="size-3.5" />
                              ) : (
                                <CheckCircle2 className="size-3.5" />
                              )
                            }
                          >
                            {item.isActive ? 'Disable' : 'Enable'}
                          </Button>
                        </form>

                        <form action={deleteSchedulingConstraintAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            aria-label="Delete constraint"
                            title="Delete constraint"
                            className="size-9 text-danger"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </form>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4 xl:p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-text-primary xl:text-base">
            Add unique event or date exception
          </h2>
        </div>

        <form action={createCalendarEventAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input type="hidden" name="academicPeriodId" value={academicPeriodId} />
          <label className="text-xs font-semibold text-text-primary xl:text-sm">
            Event title
            <input
              name="title"
              required
              maxLength={160}
              placeholder="e.g. CAT 1 Week / Public Holiday / Field Visit"
              className="mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-text-primary outline-none transition hover:border-focus-border focus:border-focus-border"
            />
          </label>
          <label className="text-xs font-semibold text-text-primary xl:text-sm">
            Event type
            <select
              name="eventType"
              defaultValue="custom"
              className="mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-text-primary"
            >
              <option value="holiday">Public holiday</option>
              <option value="cat_exam">CAT / Exam window</option>
              <option value="seminar">Seminar / Guest talk</option>
              <option value="field_trip">Field trip / Outreach</option>
              <option value="custom">Unique event</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-text-primary xl:text-sm">
            Date
            <input
              type="date"
              name="eventDate"
              required
              className="mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-text-primary"
            />
          </label>
          <label className="text-xs font-semibold text-text-primary xl:text-sm">
            Session (optional)
            <select
              name="timeSlotId"
              defaultValue=""
              className="mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-text-primary"
            >
              <option value="">All day</option>
              {data.timeSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.label} ({slot.startsAt}-{slot.endsAt})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-text-primary xl:text-sm">
            Scope
            <select
              name="scopeType"
              defaultValue="institution"
              className="mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-text-primary"
            >
              <option value="institution">Institution-wide</option>
              <option value="cohort">Specific cohort</option>
              <option value="room">Specific room</option>
              <option value="trainer">Specific trainer</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-text-primary xl:text-sm">
            Affected record (if scoped)
            <select
              name="scopeId"
              defaultValue=""
              className="mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-text-primary"
            >
              <option value="">None (Institution-wide)</option>
              <optgroup label="Cohorts">
                {data.cohorts.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </optgroup>
              <optgroup label="Rooms">
                {data.rooms.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </optgroup>
              <optgroup label="Trainers">
                {data.trainers.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </optgroup>
            </select>
          </label>
          <label className="text-xs font-semibold text-text-primary xl:text-sm">
            Regular classes
            <select
              name="suspendsRegularClasses"
              defaultValue="true"
              className="mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-text-primary"
            >
              <option value="true">Suspends regular classes</option>
              <option value="false">Advisory only (keeps classes)</option>
            </select>
          </label>
          <div className="flex items-end md:justify-end">
            <Button type="submit" className="w-full md:w-auto">
              Save event
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary xl:text-base">
            Unique events &amp; exceptions
          </h2>
        </div>

        {data.calendarEvents.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">
            No unique date events configured for this Academic Period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs xl:text-sm">
              <thead className="bg-surface-subtle text-text-secondary">
                <tr>
                  <Th>Event</Th>
                  <Th>Date &amp; time</Th>
                  <Th>Scope</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data.calendarEvents.map((ev) => (
                  <tr key={ev.id} className="border-t border-border">
                    <Td>
                      <div className="font-medium text-text-primary">{ev.title}</div>
                      <div className="mt-0.5 text-[11px] text-text-muted xl:text-xs">
                        {eventTypeLabels[ev.eventType]} · {ev.suspendsRegularClasses ? 'Suspends classes' : 'Advisory'}
                      </div>
                    </Td>
                    <Td>
                      <div className="font-medium text-text-primary">{ev.eventDate}</div>
                      <div className="mt-0.5 text-[11px] text-text-muted xl:text-xs">
                        {ev.startsAt && ev.endsAt ? `${ev.startsAt.slice(0, 5)}-${ev.endsAt.slice(0, 5)}` : 'All day'}
                      </div>
                    </Td>
                    <Td>{ev.scopeLabel}</Td>
                    <Td>
                      <span className="text-[11px] font-medium text-text-muted xl:text-xs">
                        {ev.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <form action={toggleCalendarEventAction}>
                          <input type="hidden" name="id" value={ev.id} />
                          <input type="hidden" name="isActive" value={String(!ev.isActive)} />
                          <Button type="submit" variant="outline" size="sm">
                            {ev.isActive ? 'Disable' : 'Enable'}
                          </Button>
                        </form>
                        <form action={deleteCalendarEventAction}>
                          <input type="hidden" name="id" value={ev.id} />
                          <Button type="submit" variant="ghost" size="icon" aria-label="Delete event" className="size-9 text-danger">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </form>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function formatReason(item: SchedulingConstraint) {
  const reason = item.reason?.trim();

  if (!reason || reason === 'Scheduling restriction') {
    return '-';
  }

  return reason;
}

function formatWhen(
  item: SchedulingConstraint,
  timeSlots: TimeSlotOption[],
) {
  const day = item.workingDayLabel ?? 'Any day';

  if (!item.startsAt || !item.endsAt) {
    return (
      <div>
        <div className="font-medium text-text-primary">{day}</div>
        <div className="mt-0.5 text-[11px] text-text-muted xl:text-xs">
          All day
        </div>
      </div>
    );
  }

  const startsAt = item.startsAt.slice(0, 5);
  const endsAt = item.endsAt.slice(0, 5);
  const session = timeSlots.find(
    (slot) => slot.startsAt === startsAt && slot.endsAt === endsAt,
  );

  return (
    <div>
      <div className="font-medium text-text-primary">{day}</div>
      <div className="mt-0.5 text-[11px] text-text-muted xl:text-xs">
        {session?.label ?? `${startsAt}-${endsAt}`}
      </div>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2.5 font-semibold">{children}</th>;
}

function Td({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-3 py-2.5 align-middle ${className}`}>
      {children}
    </td>
  );
}
