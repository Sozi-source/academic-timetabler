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
                key={item.classSessionId}
                className="flex flex-col gap-2.5 px-4 py-3.5 lg:grid lg:grid-cols-[minmax(0,1.3fr)_9rem_8rem_8rem_8rem_auto] lg:items-center lg:gap-3 hover:bg-surface-subtle/50 transition-colors"
              >
                {/* Mobile Header / Desktop Col 1: Unit Name + Mobile Status Badge */}
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2 lg:block">
                    <Link
                      href={`/attendance/${item.classSessionId}`}
                      className="text-xs font-bold text-text-primary hover:text-primary"
                    >
                      {item.unitName}
                    </Link>
                    <div className="shrink-0 lg:hidden">
                      <Badge
                        variant={item.sessionStatus === 'completed' ? 'success' : 'warning'}
                      >
                        {item.sessionStatus === 'completed' ? 'Completed' : 'Open'}
                      </Badge>
                    </div>
                  </div>

                  <p className="mt-0.5 text-[11px] text-text-muted">
                    {item.cohortNames} · {item.trainerName} · {shortTime(item.startsAt)}–{shortTime(item.endsAt)}
                  </p>
                </div>

                {/* Desktop Col 2: Date */}
                <p className="hidden text-[11px] text-text-secondary lg:block">
                  {item.sessionDate}
                </p>

                {/* Desktop Col 3: Status Badge */}
                <div className="hidden lg:block">
                  <Badge
                    variant={item.sessionStatus === 'completed' ? 'success' : 'warning'}
                  >
                    {item.sessionStatus === 'completed' ? 'Completed' : 'Open'}
                  </Badge>
                </div>

                {/* Desktop Col 4: Present */}
                <p className="hidden text-xs font-semibold text-text-primary lg:block">
                  {item.presentCount}
                  <span className="ml-1 text-[10px] font-normal text-text-muted">
                    / {item.studentCount}
                  </span>
                </p>

                {/* Desktop Col 5: Absent */}
                <p className="hidden text-xs font-semibold text-text-primary lg:block">
                  {item.absentCount}
                  {item.unmarkedCount > 0 ? (
                    <span className="ml-1 text-[9px] font-normal text-warning">
                      · {item.unmarkedCount} unmarked
                    </span>
                  ) : null}
                </p>

                {/* Mobile Metadata & Attendance Stat Pill */}
                <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2 lg:hidden">
                  <span className="text-[11px] font-medium text-text-secondary">
                    {item.sessionDate}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                    <span className="text-success">{item.presentCount}/{item.studentCount} present</span>
                    <span className="text-text-muted">·</span>
                    <span className={item.absentCount > 0 ? 'text-text-secondary' : 'text-text-muted'}>
                      {item.absentCount} absent
                    </span>
                    {item.unmarkedCount > 0 ? (
                      <>
                        <span className="text-text-muted">·</span>
                        <span className="text-warning">{item.unmarkedCount} unmarked</span>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1.5 pt-0.5 lg:pt-0">
                  <Link
                    href={`/attendance/${item.classSessionId}`}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-border-strong bg-white px-3 text-[11px] font-semibold text-text-secondary transition hover:bg-surface-subtle active:scale-95"
                  >
                    View
                  </Link>

                  {item.sessionStatus === 'completed' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void reopen(item.classSessionId)}
                      leadingIcon={
                        busy === item.classSessionId ? (
                          <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
                        ) : (
                          <RotateCcw className="size-3" aria-hidden="true" />
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
