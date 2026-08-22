'use client';

import {
  LoaderCircle,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';
import {
  useRouter,
} from 'next/navigation';
import {
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
} from './domain';
import type {
  DepartmentAttendanceSession,
} from './admin-types';

export function AttendanceAdminTable({
  items,
}: {
  items:
    DepartmentAttendanceSession[];
}) {
  const router =
    useRouter();

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

  async function reopen(
    sessionId:
      string,
  ) {
    setBusy(
      sessionId,
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/attendance/${sessionId}/reopen`,
          {
            method:
              'POST',
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
          'Attendance could not be reopened.',
        );
        return;
      }

      router.refresh();
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
          No attendance recorded
        </p>

        <p className="mt-1 text-xs text-text-muted">
          Trainer attendance will appear here.
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

      <section className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="hidden border-b border-border bg-surface-subtle px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-text-muted lg:grid lg:grid-cols-[minmax(0,1.3fr)_9rem_8rem_8rem_8rem_auto] lg:items-center lg:gap-3">
          <span>Class</span>
          <span>Date</span>
          <span>Status</span>
          <span>Present</span>
          <span>Absent</span>
          <span />
        </div>

        <div className="divide-y divide-border">
          {items.map(
            (
              item,
            ) => (
              <article
                key={
                  item.classSessionId
                }
                className="grid gap-3 px-4 py-3.5 lg:grid-cols-[minmax(0,1.3fr)_9rem_8rem_8rem_8rem_auto] lg:items-center lg:gap-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/attendance/${item.classSessionId}`}
                    className="truncate text-xs font-semibold text-text-primary hover:text-primary"
                  >
                    {
                      item.unitName
                    }
                  </Link>

                  <p className="mt-0.5 text-[10px] text-text-muted">
                    {
                      item.cohortNames
                    }
                    {' · '}
                    {
                      item.trainerName
                    }
                    {' · '}
                    {shortTime(
                      item.startsAt,
                    )}
                    –
                    {shortTime(
                      item.endsAt,
                    )}
                  </p>
                </div>

                <p className="text-[11px] text-text-secondary">
                  {
                    item.sessionDate
                  }
                </p>

                <Badge
                  variant={
                    item.sessionStatus ===
                    'completed'
                      ? 'success'
                      : 'warning'
                  }
                >
                  {item.sessionStatus ===
                  'completed'
                    ? 'Completed'
                    : 'Open'}
                </Badge>

                <p className="text-xs font-semibold text-text-primary">
                  {
                    item.presentCount
                  }
                  <span className="ml-1 text-[10px] font-normal text-text-muted">
                    / {
                      item.studentCount
                    }
                  </span>
                </p>

                <p className="text-xs font-semibold text-text-primary">
                  {
                    item.absentCount
                  }
                  {item.unmarkedCount >
                  0 ? (
                    <span className="ml-1 text-[9px] font-normal text-warning">
                      · {
                        item.unmarkedCount
                      } unmarked
                    </span>
                  ) : null}
                </p>

                <div className="flex justify-end gap-1.5">
                  <Link
                    href={`/attendance/${item.classSessionId}`}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-border-strong bg-white px-2.5 text-[10px] font-semibold text-text-secondary transition hover:bg-surface-subtle"
                  >
                    View
                  </Link>

                  {item.sessionStatus ===
                  'completed' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        busy !==
                        null
                      }
                      onClick={() =>
                        void reopen(
                          item.classSessionId,
                        )
                      }
                      leadingIcon={
                        busy ===
                        item.classSessionId ? (
                          <LoaderCircle
                            className="size-3 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <RotateCcw
                            className="size-3"
                            aria-hidden="true"
                          />
                        )
                      }
                    >
                      Reopen
                    </Button>
                  ) : null}
                </div>
              </article>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
