'use client';

import {
  CheckCircle2,
  LoaderCircle,
  Save,
  Send,
} from 'lucide-react';
import {
  useMemo,
  useState,
} from 'react';
import {
  useRouter,
} from 'next/navigation';

import {
  Badge,
} from '@/components/ui/badge';
import {
  Button,
} from '@/components/ui/button';

import {
  canCompleteClassAttendance,
  classAttendanceOptions,
  classAttendanceStatusVariant,
  classAttendanceSummary,
} from './domain';
import type {
  ClassAttendanceStatus,
  ClassAttendanceStudent,
  ClassSessionStatus,
} from './types';

export function ClassAttendanceEditor({
  sessionId,
  sessionStatus,
  students,
}: {
  sessionId:
    string;
  sessionStatus:
    ClassSessionStatus;
  students:
    ClassAttendanceStudent[];
}) {
  const router =
    useRouter();

  const [
    statuses,
    setStatuses,
  ] =
    useState<
      Record<
        string,
        ClassAttendanceStatus
      >
    >(
      Object.fromEntries(
        students.map(
          (student) => [
            student.studentId,
            student.attendanceStatus,
          ],
        ),
      ),
    );

  const [
    notes,
    setNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >(
      Object.fromEntries(
        students.map(
          (student) => [
            student.studentId,
            student.note ??
              '',
          ],
        ),
      ),
    );

  const [
    busy,
    setBusy,
  ] =
    useState<
      'save'
      | 'complete'
      | null
    >(
      null,
    );

  const [
    message,
    setMessage,
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

  const editable =
    sessionStatus ===
    'open';

  const summary =
    useMemo(
      () =>
        classAttendanceSummary(
          students.map(
            (student) =>
              statuses[
                student.studentId
              ] ??
              'unmarked',
          ),
        ),
      [
        statuses,
        students,
      ],
    );

  const completeReady =
    canCompleteClassAttendance(
      students.map(
        (student) =>
          statuses[
            student.studentId
          ] ??
          'unmarked',
      ),
    );

  function payload() {
    return students.map(
      (student) => ({
        studentId:
          student.studentId,
        status:
          statuses[
            student.studentId
          ] ??
          'unmarked',
        note:
          notes[
            student.studentId
          ]?.trim() ??
          '',
      }),
    );
  }

  async function save(
    silent =
      false,
  ): Promise<boolean> {
    setBusy(
      'save',
    );

    setError(
      null,
    );

    if (!silent) {
      setMessage(
        null,
      );
    }

    try {
      const response =
        await fetch(
          `/api/staff/attendance/${sessionId}/save`,
          {
            method:
              'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({
                entries:
                  payload(),
              }),
          },
        );

      const result =
        await response
          .json()
          .catch(
            () => null,
          );

      if (!response.ok) {
        setError(
          result?.message ??
          'Attendance could not be saved.',
        );
        return false;
      }

      if (!silent) {
        setMessage(
          'Attendance saved.',
        );
      }

      return true;
    } finally {
      setBusy(
        null,
      );
    }
  }

  async function complete() {
    if (!completeReady) {
      setError(
        'Mark every student before completing attendance.',
      );
      return;
    }

    setBusy(
      'complete',
    );

    setError(
      null,
    );

    setMessage(
      null,
    );

    try {
      const saveResponse =
        await fetch(
          `/api/staff/attendance/${sessionId}/save`,
          {
            method:
              'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({
                entries:
                  payload(),
              }),
          },
        );

      if (!saveResponse.ok) {
        const result =
          await saveResponse
            .json()
            .catch(
              () => null,
            );

        setError(
          result?.message ??
          'Latest attendance could not be saved.',
        );
        return;
      }

      const response =
        await fetch(
          `/api/staff/attendance/${sessionId}/complete`,
          {
            method:
              'POST',
          },
        );

      const result =
        await response
          .json()
          .catch(
            () => null,
          );

      if (!response.ok) {
        setError(
          result?.message ??
          'Attendance could not be completed.',
        );
        return;
      }

      setMessage(
        'Attendance completed.',
      );

      router.refresh();
    } finally {
      setBusy(
        null,
      );
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          [
            'Students',
            summary.total,
            'neutral',
          ],
          [
            'Present',
            summary.present,
            'success',
          ],
          [
            'Absent',
            summary.absent,
            'danger',
          ],
          [
            'Unmarked',
            summary.unmarked,
            'neutral',
          ],
        ].map(
          ([
            label,
            value,
            variant,
          ]) => (
            <div
              key={
                label
              }
              className="rounded-xl border border-border bg-white px-3 py-3"
            >
              <p className="text-[9px] font-bold uppercase tracking-wide text-text-muted">
                {
                  label
                }
              </p>

              <div className="mt-1">
                <Badge
                  variant={
                    variant as
                      | 'neutral'
                      | 'success'
                      | 'danger'
                  }
                >
                  {
                    value
                  }
                </Badge>
              </div>
            </div>
          ),
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="hidden border-b border-border bg-surface-subtle px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-text-muted md:grid md:grid-cols-[minmax(0,1fr)_minmax(18rem,.9fr)_minmax(10rem,.7fr)] md:gap-3">
          <span>Student</span>
          <span>Attendance</span>
          <span>Note</span>
        </div>

        <div className="divide-y divide-border">
          {students.map(
            (
              student,
            ) => {
              const status =
                statuses[
                  student.studentId
                ] ??
                'unmarked';

              return (
                <article
                  key={
                    student.studentId
                  }
                  className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(18rem,.9fr)_minmax(10rem,.7fr)] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-text-primary">
                      {
                        student.fullName
                      }
                    </p>

                    <p className="mt-0.5 text-[10px] text-text-muted">
                      {
                        student.admissionNumber
                      }
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {classAttendanceOptions.map(
                      (
                        option,
                      ) => (
                        <button
                          key={
                            option.value
                          }
                          type="button"
                          disabled={
                            !editable ||
                            busy !==
                              null
                          }
                          onClick={() =>
                            setStatuses(
                              (
                                current,
                              ) => ({
                                ...current,
                                [student.studentId]:
                                  option.value,
                              }),
                            )
                          }
                          className={
                            status ===
                            option.value
                              ? 'inline-flex min-h-8 min-w-16 items-center justify-center rounded-lg border border-primary bg-primary px-2.5 text-[10px] font-bold text-white'
                              : 'inline-flex min-h-8 min-w-16 items-center justify-center rounded-lg border border-border-strong bg-white px-2.5 text-[10px] font-semibold text-text-secondary transition hover:bg-surface-subtle disabled:opacity-55'
                          }
                        >
                          {
                            option.label
                          }
                        </button>
                      ),
                    )}

                    {status !==
                    'unmarked' ? (
                      <Badge
                        variant={
                          classAttendanceStatusVariant(
                            status,
                          )
                        }
                        className="md:hidden"
                      >
                        {
                          status
                        }
                      </Badge>
                    ) : null}
                  </div>

                  <input
                    value={
                      notes[
                        student.studentId
                      ] ??
                      ''
                    }
                    type="text"
                    maxLength={
                      500
                    }
                    placeholder="Optional"
                    disabled={
                      !editable ||
                      busy !==
                        null
                    }
                    onChange={(
                      event,
                    ) =>
                      setNotes(
                        (
                          current,
                        ) => ({
                          ...current,
                          [student.studentId]:
                            event.target.value,
                        }),
                      )
                    }
                    className="h-9 w-full rounded-lg border border-border-strong bg-white px-2.5 text-[11px] text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-surface-subtle"
                  />
                </article>
              );
            },
          )}
        </div>
      </section>

      {error ? (
        <p className="rounded-lg border border-danger-border bg-danger-surface px-3 py-2.5 text-[11px] text-danger">
          {
            error
          }
        </p>
      ) : null}

      {message ? (
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-success">
          <CheckCircle2
            className="size-3.5"
            aria-hidden="true"
          />
          {
            message
          }
        </p>
      ) : null}

      {editable ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={
              busy !==
              null
            }
            onClick={() =>
              void save()
            }
            leadingIcon={
              busy ===
              'save' ? (
                <LoaderCircle
                  className="size-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Save
                  className="size-3.5"
                  aria-hidden="true"
                />
              )
            }
          >
            Save
          </Button>

          <Button
            type="button"
            disabled={
              busy !==
                null ||
              !completeReady
            }
            onClick={() =>
              void complete()
            }
            leadingIcon={
              busy ===
              'complete' ? (
                <LoaderCircle
                  className="size-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Send
                  className="size-3.5"
                  aria-hidden="true"
                />
              )
            }
          >
            Complete
          </Button>
        </div>
      ) : (
        <p className="text-right text-[10px] text-text-muted">
          Completed attendance is read only.
        </p>
      )}
    </div>
  );
}
