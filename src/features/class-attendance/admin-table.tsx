'use client';

import { CalendarCheck2, LoaderCircle, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { shortTime } from './domain';
import type { DepartmentAttendanceSession } from './admin-types';

export function AttendanceAdminTable({ items }: { items: DepartmentAttendanceSession[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reopen(sessionId: string) {
    setBusy(sessionId);
    setError(null);

    try {
      const response = await fetch(`/api/attendance/${sessionId}/reopen`, { method: 'POST' });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? 'Attendance could not be reopened.');
        return;
      }

      router.refresh();
    } catch {
      setError('Attendance could not be reopened.');
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface px-5 py-10 text-center">
        <p className="text-sm font-semibold text-text-primary">No attendance sessions</p>
        <p className="mt-1 text-xs text-text-muted">Recorded class sessions will appear here.</p>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-lg border border-danger-border bg-danger-surface px-3 py-2.5 text-[11px] text-danger">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="hidden border-b border-border bg-surface-subtle px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-text-muted lg:grid lg:grid-cols-[minmax(0,1.5fr)_7.5rem_7rem_6rem_6rem_auto] lg:items-center lg:gap-3">
          <span>Unit / class</span>
          <span>Date</span>
          <span>Status</span>
          <span>Present</span>
          <span>Absent</span>
          <span />
        </div>

        <div className="divide-y divide-border">
          {items.map((item) => (
            <article
              key={item.classSessionId}
              className="flex flex-col gap-2.5 px-4 py-3.5 transition-colors hover:bg-surface-subtle/50 lg:grid lg:grid-cols-[minmax(0,1.5fr)_7.5rem_7rem_6rem_6rem_auto] lg:items-center lg:gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/attendance/${item.classSessionId}`}
                    className="truncate text-xs font-bold text-text-primary hover:text-primary"
                  >
                    {item.unitName}
                  </Link>
                  <Badge
                    variant={item.sessionStatus === 'completed' ? 'success' : 'warning'}
                    className="shrink-0 lg:hidden"
                  >
                    {item.sessionStatus === 'completed' ? 'Complete' : 'Open'}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-[10px] text-text-muted">
                  {item.cohortNames} · {item.trainerName} · {shortTime(item.startsAt)}–{shortTime(item.endsAt)}
                </p>
              </div>

              <p className="hidden text-[11px] text-text-secondary lg:block">{item.sessionDate}</p>

              <div className="hidden lg:block">
                <Badge variant={item.sessionStatus === 'completed' ? 'success' : 'warning'}>
                  {item.sessionStatus === 'completed' ? 'Complete' : 'Open'}
                </Badge>
              </div>

              <p className="hidden text-xs font-semibold text-text-primary lg:block">
                {item.presentCount}
                <span className="ml-1 text-[10px] font-normal text-text-muted">/ {item.studentCount}</span>
              </p>

              <p className="hidden text-xs font-semibold text-text-primary lg:block">
                {item.absentCount}
                {item.unmarkedCount > 0 ? (
                  <span className="ml-1 text-[9px] font-normal text-warning">
                    · {item.unmarkedCount} pending
                  </span>
                ) : null}
              </p>

              <div className="flex items-center justify-between border-t border-border pt-2 lg:border-0 lg:pt-0">
                <span className="text-[10px] text-text-muted lg:hidden">
                  {item.sessionDate} · {item.presentCount}/{item.studentCount} present
                </span>

                <div className="ml-auto flex items-center gap-1.5">
                  {item.sessionStatus === 'open' ? (
                    <Link
                      href={`/staff/attendance/${item.classSessionId}?returnTo=/attendance?view=sessions`}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground transition hover:bg-primary-hover shadow-2xs"
                    >
                      <CalendarCheck2 className="size-3" aria-hidden="true" />
                      <span>Input Attendance</span>
                    </Link>
                  ) : (
                    <Link
                      href={`/attendance/${item.classSessionId}`}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-border-strong bg-surface px-2.5 text-[11px] font-semibold text-text-secondary transition hover:bg-surface-subtle"
                    >
                      View
                    </Link>
                  )}

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
                      <span className="hidden sm:inline">Reopen</span>
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
