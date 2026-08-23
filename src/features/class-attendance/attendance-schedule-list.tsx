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
  items: ClassAttendanceScheduleItem[];
}) {
  const router = useRouter();
  const today = useMemo(localDateValue, []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [viewAll, setViewAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedWeekday = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        timeZone: 'UTC',
      }).format(new Date(`${selectedDate}T00:00:00Z`));
    } catch {
      return '';
    }
  }, [selectedDate]);

  const formattedSelectedDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${selectedDate}T00:00:00Z`));
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Filter items matching the selected day of the week
  const displayedItems = useMemo(() => {
    if (viewAll) return items;
    return items.filter(
      (item) => item.dayOfWeek.toLowerCase() === selectedWeekday.toLowerCase()
    );
  }, [items, selectedWeekday, viewAll]);

  async function open(item: ClassAttendanceScheduleItem) {
    const sessionDate = selectedDate || today;

    setBusy(item.scheduledSessionId);
    setError(null);

    try {
      const response = await fetch('/api/staff/attendance/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scheduledSessionId: item.scheduledSessionId,
          sessionDate,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? 'Attendance could not be opened.');
        return;
      }

      router.push(`/staff/attendance/${payload.classSessionId}`);
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-white px-5 py-9 text-center">
        <p className="text-sm font-semibold text-text-primary">
          No published classes
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Published timetable sessions assigned to you will appear here.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date Filter & Day Header */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-text-primary">
              {viewAll ? 'All Weekly Classes' : formattedSelectedDate}
            </h3>
            {!viewAll && selectedDate === today ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                Today
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            {viewAll
              ? `Showing all ${items.length} sessions across the week`
              : `${displayedItems.length} class${displayedItems.length === 1 ? '' : 'es'} scheduled for this day`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
            <span>Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setViewAll(false);
              }}
              className="h-8.5 rounded-lg border border-border-strong bg-white px-2.5 text-xs font-medium text-text-primary shadow-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>

          {selectedDate !== today && !viewAll ? (
            <button
              type="button"
              onClick={() => {
                setSelectedDate(today);
                setViewAll(false);
              }}
              className="h-8.5 rounded-lg border border-border bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Today
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setViewAll(!viewAll)}
            className="h-8.5 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {viewAll ? 'Show Today Only' : 'View All Week'}
          </button>
        </div>
      </section>

      {error ? (
        <p className="rounded-lg border border-danger-border bg-danger-surface px-3 py-2.5 text-[11px] text-danger">
          {error}
        </p>
      ) : null}

      {displayedItems.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border bg-white px-5 py-8 text-center">
          <p className="text-sm font-semibold text-text-primary">
            No classes scheduled for {formattedSelectedDate}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            You don't have any timetable sessions scheduled on {selectedWeekday}s.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setViewAll(true)}
            >
              View All Weekly Classes ({items.length})
            </Button>
          </div>
        </section>
      ) : (
        <section className="grid gap-3 lg:grid-cols-2">
          {displayedItems.map((item) => (
            <article
              key={item.scheduledSessionId}
              className="flex flex-col justify-between rounded-xl border border-border bg-white p-4 shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-text-primary">
                      {item.unitName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {item.cohortName} · {item.academicPeriodName}
                    </p>
                  </div>

                  <Badge variant="neutral">
                    {weekdayLabel(item.dayOfWeek)} {shortTime(item.startsAt)}–{shortTime(item.endsAt)}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                <div className="text-[11px] text-text-muted">
                  Session date: <strong className="text-slate-800">{selectedDate}</strong>
                </div>

                <Button
                  type="button"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void open(item)}
                  leadingIcon={
                    busy === item.scheduledSessionId ? (
                      <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <CalendarCheck2 className="size-3.5" aria-hidden="true" />
                    )
                  }
                >
                  Take attendance
                </Button>
              </div>

              {item.latestClassSessionId && item.latestSessionDate ? (
                <button
                  type="button"
                  onClick={() => router.push(`/staff/attendance/${item.latestClassSessionId}`)}
                  className="mt-2 text-left text-[10px] font-semibold text-primary hover:underline"
                >
                  Latest record: {item.latestSessionDate} · {item.latestStatus === 'completed' ? 'Completed' : 'Open'}
                </button>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
