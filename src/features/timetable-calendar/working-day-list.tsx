import {
  CalendarDays,
  CheckCircle2,
  CircleOff,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  setWorkingDayEnabledAction,
} from './actions';
import {
  weekdayOptions,
  type WorkingDay,
} from './types';

interface WorkingDayListProps {
  workingDays: WorkingDay[];
}

function getDayLabel(value: string) {
  return (
    weekdayOptions.find(
      (day) => day.value === value,
    )?.label ?? value
  );
}

export function WorkingDayList({
  workingDays,
}: WorkingDayListProps) {
  if (workingDays.length === 0) {
    return (
      <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong bg-surface-subtle px-6 py-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-xl bg-surface text-primary shadow-sm">
          <CalendarDays
            className="size-5"
            aria-hidden="true"
          />
        </div>

        <h3 className="mt-3 text-sm font-semibold text-text-primary">
          No Working Days configured
        </h3>

        <p className="mt-1 max-w-md text-xs leading-5 text-text-muted">
          Set Monday to Friday automatically or add
          individual teaching days.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {workingDays.map((workingDay) => (
        <article
          key={workingDay.id}
          className="rounded-xl border border-border bg-surface px-4 py-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-semibold text-primary">
                {workingDay.sequenceNumber}
              </span>

              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-text-primary">
                  {getDayLabel(
                    workingDay.dayOfWeek,
                  )}
                </h3>

                <p className="mt-0.5 text-xs text-text-muted">
                  Teaching day
                </p>
              </div>
            </div>

            <Badge
              variant={
                workingDay.isEnabled
                  ? 'success'
                  : 'neutral'
              }
              dot={workingDay.isEnabled}
            >
              {workingDay.isEnabled
                ? 'Enabled'
                : 'Disabled'}
            </Badge>
          </div>

          {workingDay.notes ? (
            <p className="mt-3 line-clamp-2 text-xs leading-5 text-text-secondary">
              {workingDay.notes}
            </p>
          ) : null}

          <form
            action={setWorkingDayEnabledAction}
            className="mt-4 border-t border-border-soft pt-3"
          >
            <input
              type="hidden"
              name="id"
              value={workingDay.id}
            />

            <input
              type="hidden"
              name="isEnabled"
              value={
                workingDay.isEnabled
                  ? 'false'
                  : 'true'
              }
            />

            <Button
              type="submit"
              variant="ghost"
              size="sm"
              leadingIcon={
                workingDay.isEnabled ? (
                  <CircleOff
                    className="size-3.5"
                    aria-hidden="true"
                  />
                ) : (
                  <CheckCircle2
                    className="size-3.5"
                    aria-hidden="true"
                  />
                )
              }
            >
              {workingDay.isEnabled
                ? 'Disable day'
                : 'Enable day'}
            </Button>
          </form>
        </article>
      ))}
    </div>
  );
}