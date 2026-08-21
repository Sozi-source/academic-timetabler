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
  calculateOnlineFinalTotal,
  calculateRatCatAverage,
  canEditOnlineMarks,
  missingOnlineComponentCount,
  onlineMarkComponents,
  parseOnlineMarkInput,
  type OnlineMarkValues,
} from './online-marks-domain';

interface StudentRow {
  studentId:
    string;
  admissionNumber:
    string;
  fullName:
    string;
  attendanceStatus:
    | 'expected'
    | 'absent';
  initialMarks:
    OnlineMarkValues;
}

type InputValues =
  Record<
    string,
    Record<
      'assignment'
      | 'presentation'
      | 'rat'
      | 'cat'
      | 'exam',
      string
    >
  >;

function toInput(
  value:
    number |
    null,
): string {
  return value ===
    null
    ? ''
    : String(
        value,
      );
}

export function OnlineMarksEditor({
  assessmentId,
  workflowStatus,
  students,
}: {
  assessmentId:
    string;
  workflowStatus:
    string | null;
  students:
    StudentRow[];
}) {
  const router =
    useRouter();

  const [
    values,
    setValues,
  ] =
    useState<InputValues>(
      Object.fromEntries(
        students.map(
          (student) => [
            student.studentId,
            {
              assignment:
                toInput(
                  student.initialMarks.assignment,
                ),
              presentation:
                toInput(
                  student.initialMarks.presentation,
                ),
              rat:
                toInput(
                  student.initialMarks.rat,
                ),
              cat:
                toInput(
                  student.initialMarks.cat,
                ),
              exam:
                student.attendanceStatus ===
                'absent'
                  ? ''
                  : toInput(
                      student.initialMarks.exam,
                    ),
            },
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
      | 'submit'
      | null
    >(
      null,
    );

  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const editable =
    canEditOnlineMarks(
      workflowStatus,
    );

  const parsedRows =
    useMemo(
      () =>
        students.map(
          (student) => {
            const studentValues =
              values[
                student.studentId
              ];

            const assignment =
              parseOnlineMarkInput(
                studentValues?.assignment ??
                  '',
                5,
              );

            const presentation =
              parseOnlineMarkInput(
                studentValues?.presentation ??
                  '',
                10,
              );

            const rat =
              parseOnlineMarkInput(
                studentValues?.rat ??
                  '',
                15,
              );

            const cat =
              parseOnlineMarkInput(
                studentValues?.cat ??
                  '',
                15,
              );

            const exam =
              student.attendanceStatus ===
              'absent'
                ? {
                    valid:
                      true,
                    mark:
                      null,
                    message:
                      null,
                  }
                : parseOnlineMarkInput(
                    studentValues?.exam ??
                      '',
                    70,
                  );

            const marks:
              OnlineMarkValues = {
                assignment:
                  assignment.mark,
                presentation:
                  presentation.mark,
                rat:
                  rat.mark,
                cat:
                  cat.mark,
                exam:
                  exam.mark,
              };

            return {
              student,
              marks,
              fields: {
                assignment,
                presentation,
                rat,
                cat,
                exam,
              },
              missing:
                missingOnlineComponentCount({
                  values:
                    marks,
                  absent:
                    student.attendanceStatus ===
                    'absent',
                }),
              ratCatAverage:
                calculateRatCatAverage({
                  rat:
                    marks.rat,
                  cat:
                    marks.cat,
                }),
              total:
                calculateOnlineFinalTotal(
                  marks,
                  student.attendanceStatus ===
                    'absent',
                ),
            };
          },
        ),
      [
        students,
        values,
      ],
    );

  const invalid =
    parsedRows
      .flatMap(
        (row) =>
          Object.entries(
            row.fields,
          ).map(
            ([
              key,
              value,
            ]) => ({
              student:
                row.student,
              key,
              value,
            }),
          ),
      )
      .find(
        (entry) =>
          !entry.value.valid,
      );

  const missing =
    parsedRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        row.missing,
      0,
    );

  const absent =
    students.filter(
      (student) =>
        student.attendanceStatus ===
        'absent',
    ).length;

  async function saveDraft(
    silent =
      false,
  ): Promise<boolean> {
    if (invalid) {
      setError(
        `${invalid.student.fullName}: ${invalid.value.message ?? 'Invalid mark.'}`,
      );
      return false;
    }

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
          `/api/staff/assessment/${assessmentId}/online/save`,
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
                  parsedRows.map(
                    (row) => ({
                      studentId:
                        row.student.studentId,
                      assignment:
                        row.marks.assignment,
                      presentation:
                        row.marks.presentation,
                      rat:
                        row.marks.rat,
                      cat:
                        row.marks.cat,
                      exam:
                        row.student.attendanceStatus ===
                        'absent'
                          ? null
                          : row.marks.exam,
                    }),
                  ),
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
          'Draft marks could not be saved.',
        );
        return false;
      }

      if (!silent) {
        setMessage(
          'Draft saved.',
        );
      }

      return true;
    } finally {
      setBusy(
        null,
      );
    }
  }

  async function submitMarks() {
    if (invalid) {
      setError(
        `${invalid.student.fullName}: ${invalid.value.message ?? 'Invalid mark.'}`,
      );
      return;
    }

    if (
      missing >
      0
    ) {
      setError(
        `${missing} required mark${missing === 1 ? '' : 's'} remain blank.`,
      );
      return;
    }

    setBusy(
      'submit',
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
          `/api/staff/assessment/${assessmentId}/online/save`,
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
                  parsedRows.map(
                    (row) => ({
                      studentId:
                        row.student.studentId,
                      assignment:
                        row.marks.assignment,
                      presentation:
                        row.marks.presentation,
                      rat:
                        row.marks.rat,
                      cat:
                        row.marks.cat,
                      exam:
                        row.student.attendanceStatus ===
                        'absent'
                          ? null
                          : row.marks.exam,
                    }),
                  ),
              }),
          },
        );

      if (!saveResponse.ok) {
        const payload =
          await saveResponse
            .json()
            .catch(
              () => null,
            );

        setError(
          payload?.message ??
          'Latest marks could not be saved.',
        );
        return;
      }

      const response =
        await fetch(
          `/api/staff/assessment/${assessmentId}/online/submit`,
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
          'Marks could not be submitted.',
        );
        return;
      }

      setMessage(
        'Marks submitted.',
      );

      router.refresh();
    } finally {
      setBusy(
        null,
      );
    }
  }

  function setField(
    studentId:
      string,
    key:
      'assignment'
      | 'presentation'
      | 'rat'
      | 'cat'
      | 'exam',
    value:
      string,
  ) {
    setValues(
      (current) => ({
        ...current,
        [studentId]: {
          ...current[
            studentId
          ],
          [key]:
            value,
        },
      }),
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-white px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
            Students
          </p>
          <p className="mt-1 text-lg font-bold text-text-primary">
            {
              students.length
            }
          </p>
        </div>

        <div className="rounded-xl border border-border bg-white px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
            Absent
          </p>
          <p className="mt-1 text-lg font-bold text-text-primary">
            {
              absent
            }
          </p>
        </div>

        <div className="rounded-xl border border-border bg-white px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
            Missing
          </p>
          <p className="mt-1 text-lg font-bold text-text-primary">
            {
              missing
            }
          </p>
        </div>

        <div className="rounded-xl border border-border bg-white px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
            Final
          </p>
          <p className="mt-1 text-lg font-bold text-text-primary">
            /100
          </p>
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[930px] border-collapse text-left">
          <thead className="bg-surface-subtle">
            <tr className="border-b border-border text-[10px] font-bold uppercase tracking-wide text-text-muted">
              <th className="px-3 py-2.5">
                Student
              </th>

              {onlineMarkComponents.map(
                (component) => (
                  <th
                    key={
                      component.key
                    }
                    className="px-2 py-2.5 text-center"
                  >
                    {
                      component.label
                    }
                    {' /'}
                    {
                      component.maximum
                    }
                  </th>
                ),
              )}

              <th className="px-2 py-2.5 text-center">
                RAT/CAT /15
              </th>

              <th className="px-3 py-2.5 text-center">
                Total /100
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {parsedRows.map(
              (row) => (
                <tr
                  key={
                    row.student.studentId
                  }
                  className="align-middle"
                >
                  <td className="px-3 py-3">
                    <p className="text-xs font-semibold text-text-primary">
                      {
                        row.student.fullName
                      }
                    </p>

                    <p className="mt-0.5 text-[10px] text-text-muted">
                      {
                        row.student.admissionNumber
                      }
                    </p>

                    {row.student.attendanceStatus ===
                    'absent' ? (
                      <Badge
                        variant="warning"
                        className="mt-1"
                      >
                        Exam absent
                      </Badge>
                    ) : null}
                  </td>

                  {(
                    [
                      [
                        'assignment',
                        5,
                      ],
                      [
                        'presentation',
                        10,
                      ],
                      [
                        'rat',
                        15,
                      ],
                      [
                        'cat',
                        15,
                      ],
                      [
                        'exam',
                        70,
                      ],
                    ] as const
                  ).map(
                    ([
                      key,
                      maximum,
                    ]) => {
                      const field =
                        row.fields[
                          key
                        ];

                      const examAbsent =
                        key ===
                          'exam' &&
                        row.student.attendanceStatus ===
                          'absent';

                      return (
                        <td
                          key={
                            key
                          }
                          className="px-2 py-3"
                        >
                          {examAbsent ? (
                            <div className="mx-auto flex h-9 w-20 items-center justify-center rounded-lg bg-surface-subtle text-xs font-bold text-text-secondary">
                              AB
                            </div>
                          ) : (
                            <div className="mx-auto w-20">
                              <input
                                value={
                                  values[
                                    row.student.studentId
                                  ]?.[
                                    key
                                  ] ??
                                  ''
                                }
                                type="number"
                                min={
                                  0
                                }
                                max={
                                  maximum
                                }
                                step="0.01"
                                inputMode="decimal"
                                disabled={
                                  !editable ||
                                  busy !==
                                    null
                                }
                                onChange={(
                                  event,
                                ) =>
                                  setField(
                                    row.student.studentId,
                                    key,
                                    event.target.value,
                                  )
                                }
                                aria-label={`${key} mark for ${row.student.fullName}`}
                                className={
                                  field.valid
                                    ? 'h-9 w-full rounded-lg border border-border-strong bg-white px-2 text-center text-xs font-semibold text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-surface-subtle'
                                    : 'h-9 w-full rounded-lg border border-danger bg-white px-2 text-center text-xs font-semibold text-text-primary outline-none focus:ring-2 focus:ring-danger/20'
                                }
                              />

                              {!field.valid ? (
                                <p className="mt-1 text-center text-[9px] text-danger">
                                  {
                                    field.message
                                  }
                                </p>
                              ) : null}
                            </div>
                          )}
                        </td>
                      );
                    },
                  )}

                  <td className="px-2 py-3 text-center text-xs font-semibold text-text-secondary">
                    {row.ratCatAverage ===
                    null
                      ? '—'
                      : row.ratCatAverage.toFixed(
                          2,
                        )}
                  </td>

                  <td className="px-3 py-3 text-center text-sm font-bold text-text-primary">
                    {row.student.attendanceStatus ===
                    'absent'
                      ? 'AB'
                      : row.total ===
                          null
                        ? '—'
                        : row.total.toFixed(
                            2,
                          )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </section>

      <p className="text-[10px] leading-4 text-text-muted">
        RAT and CAT remain separate /15
        fields. Their average contributes
        one /15 component to the final
        /100 total, matching the existing
        Excel mark sheet.
      </p>

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
              void saveDraft()
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
            Save draft
          </Button>

          <Button
            type="button"
            disabled={
              busy !==
                null ||
              missing >
                0 ||
              Boolean(
                invalid,
              )
            }
            onClick={() =>
              void submitMarks()
            }
            leadingIcon={
              busy ===
              'submit' ? (
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
            Submit marks
          </Button>
        </div>
      ) : (
        <p className="text-right text-[10px] text-text-muted">
          Results are read only after submission.
        </p>
      )}
    </div>
  );
}
