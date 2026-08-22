'use client';

import {
  CalendarCheck2,
  LoaderCircle,
} from 'lucide-react';
import {
  useRouter,
} from 'next/navigation';
import {
  useMemo,
  useState,
} from 'react';

import {
  Badge,
} from '@/components/ui/badge';
import {
  Button,
} from '@/components/ui/button';

import {
  shortTime,
  weekdayLabel,
} from './domain';
import type {
  ClassAttendanceScheduleItem,
} from './types';

function localDateValue() {
  const now =
    new Date();

  const offset =
    now.getTimezoneOffset() *
    60 *
    1000;

  return new Date(
    now.getTime() -
    offset,
  )
    .toISOString()
    .slice(
      0,
      10,
    );
}

export function AttendanceScheduleList({
  items,
}: {
  items:
    ClassAttendanceScheduleItem[];
}) {
  const router =
    useRouter();

  const [
    dates,
    setDates,
  ] =
    useState<
      Record<
        string,
        string
      >
    >(
      {},
    );

  const [
    busy,
    setBusy,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const today =
    useMemo(
      localDateValue,
      [],
    );

  async function open(
    item:
      ClassAttendanceScheduleItem,
  ) {
    const sessionDate =
      dates[
        item.scheduledSessionId
      ] ??
      today;

    if (!sessionDate) {
      setError(
        'Choose the class date.',
      );
      return;
    }

    setBusy(
      item.scheduledSessionId,
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          '/api/staff/attendance/sessions',
          {
            method:
              'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({
                scheduledSessionId:
                  item.scheduledSessionId,
                sessionDate,
              }),
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () => null,
          );

      if (!response.ok) {
        setError(
          payload?.message ??
          'Attendance could not be opened.',
        );
        return;
      }

      router.push(
        `/staff/attendance/${payload.classSessionId}`,
      );
    } finally {
      setBusy(
        null,
      );
    }
  }

  if (
    items.length ===
    0
  ) {
    return (
      <section className="rounded-xl border border-border bg-white px-5 py-9 text-center">
        <p className="text-sm font-semibold text-text-primary">
          No published classes
        </p>

        <p className="mt-1 text-xs text-text-muted">
          Published timetable sessions
          assigned to you will appear here.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-lg border border-danger-border bg-danger-surface px-3 py-2.5 text-[11px] text-danger">
          {
            error
          }
        </p>
      ) : null}

      <section className="grid gap-3 lg:grid-cols-2">
        {items.map(
          (
            item,
          ) => (
            <article
              key={
                item.scheduledSessionId
              }
              className="rounded-xl border border-border bg-white px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {
                      item.unitName
                    }
                  </p>

                  <p className="mt-1 text-[11px] text-text-muted">
                    {
                      item.cohortName
                    }
                    {' · '}
                    {
                      item.academicPeriodName
                    }
                  </p>
                </div>

                <Badge variant="neutral">
                  {weekdayLabel(
                    item.dayOfWeek,
                  )}
                  {' '}
                  {shortTime(
                    item.startsAt,
                  )}
                  –
                  {shortTime(
                    item.endsAt,
                  )}
                </Badge>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="min-w-0">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-text-muted">
                    Class date
                  </span>

                  <input
                    type="date"
                    min={
                      item.teachingStartsOn
                    }
                    max={
                      item.teachingEndsOn
                    }
                    value={
                      dates[
                        item.scheduledSessionId
                      ] ??
                      today
                    }
                    onChange={(
                      event,
                    ) =>
                      setDates(
                        (
                          current,
                        ) => ({
                          ...current,
                          [item.scheduledSessionId]:
                            event.target.value,
                        }),
                      )
                    }
                    disabled={
                      busy !==
                      null
                    }
                    className="h-9 w-full rounded-lg border border-border-strong bg-white px-2.5 text-xs font-medium text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </label>

                <Button
                  type="button"
                  size="sm"
                  disabled={
                    busy !==
                    null
                  }
                  onClick={() =>
                    void open(
                      item,
                    )
                  }
                  leadingIcon={
                    busy ===
                    item.scheduledSessionId ? (
                      <LoaderCircle
                        className="size-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <CalendarCheck2
                        className="size-3.5"
                        aria-hidden="true"
                      />
                    )
                  }
                >
                  Take attendance
                </Button>
              </div>

              {item.latestClassSessionId &&
              item.latestSessionDate ? (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/staff/attendance/${item.latestClassSessionId}`,
                    )
                  }
                  className="mt-3 text-left text-[10px] font-semibold text-primary hover:underline"
                >
                  Latest: {
                    item.latestSessionDate
                  } · {
                    item.latestStatus ===
                    'completed'
                      ? 'Completed'
                      : 'Open'
                  }
                </button>
              ) : null}
            </article>
          ),
        )}
      </section>
    </div>
  );
}
