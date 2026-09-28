'use client';

import {
  useState,
} from 'react';
import {
  useRouter,
} from 'next/navigation';
import {
  CheckCircle2,
  Download,
  FileCheck2,
  Keyboard,
  LoaderCircle,
  UserX,
} from 'lucide-react';

import {
  Badge,
} from '@/components/ui/badge';

import {
  canDownloadStaffMarkbook,
  canDownloadStaffSigningSheet,
  canEditStaffAttendance,
  canGenerateStaffPopulation,
  canUseStaffOnlineMarks,
} from './workflow-domain';

interface StaffAssessmentStudent {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  attendanceStatus:
    | 'expected'
    | 'absent';
}

interface StaffAssessmentWorkflowProps {
  allocationId: string;
  assessmentId: string;
  unitName: string;
  assessmentType:
    | 'cat'
    | 'exam';
  workflowStatus: string | null;
  populationLocked: boolean;
  maximumMark: number | null;
  passMark: number | null;
  students: StaffAssessmentStudent[];
}

function filenameFromResponse(
  response: Response,
  fallback: string,
): string {
  const disposition =
    response.headers.get(
      'content-disposition',
    );

  if (!disposition) {
    return fallback;
  }

  const utf8 =
    disposition.match(
      /filename\*=UTF-8''([^;]+)/i,
    );

  if (
    utf8?.[1]
  ) {
    try {
      return decodeURIComponent(
        utf8[1],
      );
    } catch {
      return utf8[1];
    }
  }

  const basic =
    disposition.match(
      /filename="?([^";]+)"?/i,
    );

  return (
    basic?.[1] ??
    fallback
  );
}

async function messageFromResponse(
  response: Response,
  fallback: string,
): Promise<string> {
  const payload =
    await response
      .json()
      .catch(
        () => null,
      );

  return (
    payload?.message ??
    fallback
  );
}

export function StaffAssessmentWorkflow({
  allocationId,
  assessmentId,
  unitName,
  assessmentType,
  workflowStatus,
  populationLocked,
  maximumMark,
  passMark,
  students,
}: StaffAssessmentWorkflowProps) {
  const router =
    useRouter();

  const [
    busy,
    setBusy,
  ] =
    useState<string | null>(
      null,
    );

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(
      null,
    );

  const state = {
    workflowStatus,
    populationLocked,
    populationCount:
      students.length,
    ruleConfigured:
      maximumMark !==
        null &&
      passMark !==
        null,
  };

  const canGenerate =
    canGenerateStaffPopulation(
      state,
    );

  const canEditAttendance =
    canEditStaffAttendance(
      state,
    );

  const canDownload =
    canDownloadStaffMarkbook(
      state,
    );

  const canDownloadSigning =
    canDownloadStaffSigningSheet(
      state,
    );

  const canOnline =
    canUseStaffOnlineMarks({
      state,
      assessmentType,
      maximumMark,
    });

  async function generatePopulation() {
    setBusy(
      'population',
    );

    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/staff/assessment/${assessmentId}/population`,
          {
            method:
              'POST',
          },
        );

      if (!response.ok) {
        setMessage(
          await messageFromResponse(
            response,
            'Population could not be generated.',
          ),
        );

        return;
      }

      setMessage(
        'Population generated.',
      );

      router.refresh();
    } finally {
      setBusy(
        null,
      );
    }
  }

  async function setAbsence(
    studentId: string,
    absent: boolean,
  ) {
    setBusy(
      `attendance:${studentId}`,
    );

    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/staff/assessment/${assessmentId}/attendance`,
          {
            method:
              'PATCH',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({
                studentId,
                absent,
              }),
          },
        );

      if (!response.ok) {
        setMessage(
          await messageFromResponse(
            response,
            'Attendance could not be updated.',
          ),
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

  async function openOnlineMarks() {
    setBusy(
      'online',
    );

    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/staff/assessment/${assessmentId}/online/prepare`,
          {
            method:
              'POST',
          },
        );

      if (!response.ok) {
        setMessage(
          await messageFromResponse(
            response,
            'Online marks could not be opened.',
          ),
        );

        return;
      }

      router.push(
        `/staff/units/${allocationId}/assessment/${assessmentId}/marks`,
      );
    } finally {
      setBusy(
        null,
      );
    }
  }

  async function downloadWorkbook(
    kind:
      | 'markbook'
      | 'signing-sheet',
  ) {
    setBusy(
      kind,
    );

    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/staff/assessment/${assessmentId}/${kind}`,
          {
            method:
              'POST',
          },
        );

      if (!response.ok) {
        setMessage(
          await messageFromResponse(
            response,
            'Document could not be generated.',
          ),
        );

        return;
      }

      const blob =
        await response.blob();

      const fallback =
        kind ===
        'markbook'
          ? `${unitName}.xlsx`
          : `${unitName} ${assessmentType === 'cat' ? 'CAT' : 'Exam'} Signing Sheet.xlsx`;

      const filename =
        filenameFromResponse(
          response,
          fallback,
        );

      const url =
        URL.createObjectURL(
          blob,
        );

      const link =
        document.createElement(
          'a',
        );

      link.href =
        url;

      link.download =
        filename;

      document.body.appendChild(
        link,
      );

      link.click();
      link.remove();

      URL.revokeObjectURL(
        url,
      );

      router.refresh();
    } finally {
      setBusy(
        null,
      );
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border bg-white px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary">
                Marks
              </h2>

              <Badge variant="neutral">
                {
                  workflowStatus ??
                  'draft'
                }
              </Badge>

              {populationLocked ? (
                <Badge variant="success">
                  Roster locked
                </Badge>
              ) : null}
            </div>

            <p className="mt-1 text-[11px] leading-5 text-text-muted">
              Confirm the class list, enter marks, then submit.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canGenerate ? (
              <button
                type="button"
                disabled={
                  busy !==
                  null
                }
                onClick={() =>
                  void generatePopulation()
                }
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ===
                'population' ? (
                  <LoaderCircle
                    className="size-3.5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <CheckCircle2
                    className="size-3.5"
                    aria-hidden="true"
                  />
                )}

                {students.length >
                0
                  ? 'Refresh class list'
                  : 'Load class list'}
              </button>
            ) : null}

            {assessmentType === 'exam' ? (
              <button
                type="button"
                disabled={!canDownload || busy !== null}
                onClick={() => void downloadWorkbook('markbook')}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="size-3.5" aria-hidden="true" />
                Download Excel
              </button>
            ) : null}

            <button
              type="button"
              disabled={
                !canDownloadSigning ||
                busy !==
                  null
              }
              onClick={() =>
                void downloadWorkbook(
                  'signing-sheet',
                )
              }
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileCheck2
                className="size-3.5"
                aria-hidden="true"
              />
              Signing sheet
            </button>

            {assessmentType ===
            'exam' ? (
              <button
                type="button"
                disabled={
                  !canOnline ||
                  busy !==
                    null
                }
                onClick={() =>
                  void openOnlineMarks()
                }
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ===
                'online' ? (
                  <LoaderCircle
                    className="size-3.5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Keyboard
                    className="size-3.5"
                    aria-hidden="true"
                  />
                )}
                Enter marks
              </button>
            ) : null}

          </div>
        </div>

        {!state.ruleConfigured ? (
          <p className="mt-3 text-[11px] text-text-muted">
            Maximum and pass marks must
            be configured by the HOD
            before marks can be submitted.
          </p>
        ) : null}

        {message ? (
          <p
            className="mt-3 text-[11px] font-medium text-text-secondary"
            aria-live="polite"
          >
            {
              message
            }
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Class list
            </h2>

            <p className="mt-1 text-[11px] text-text-muted">
              Mark exam absences before entering marks.
            </p>
          </div>

          <Badge variant="neutral">
            {
              students.length
            } students
          </Badge>
        </div>

        {students.length ===
        0 ? (
          <div className="rounded-xl border border-border bg-white px-4 py-8 text-center">
            <p className="text-xs font-semibold text-text-primary">
              Class list not loaded
            </p>
          </div>
        ) : (
          students.map(
            (
              student,
            ) => {
              const rowBusy =
                busy ===
                `attendance:${student.studentId}`;

              return (
                <div
                  key={
                    student.studentId
                  }
                  className="grid gap-2 rounded-lg border border-border bg-white px-3.5 py-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(7rem,.7fr)_auto] sm:items-center"
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

                  <Badge
                    variant={
                      student.attendanceStatus ===
                      'absent'
                        ? 'neutral'
                        : 'success'
                    }
                  >
                    {student.attendanceStatus ===
                    'absent'
                      ? 'Absent'
                      : 'Expected'}
                  </Badge>

                  {canEditAttendance ? (
                    <button
                      type="button"
                      disabled={
                        busy !==
                        null
                      }
                      onClick={() =>
                        void setAbsence(
                          student.studentId,
                          student.attendanceStatus !==
                            'absent',
                        )
                      }
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-white px-2.5 text-[11px] font-semibold text-text-secondary transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {rowBusy ? (
                        <LoaderCircle
                          className="size-3 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <UserX
                          className="size-3"
                          aria-hidden="true"
                        />
                      )}

                      {student.attendanceStatus ===
                      'absent'
                        ? 'Restore'
                        : 'Absent'}
                    </button>
                  ) : (
                    <span className="text-[10px] text-text-muted">
                      {
                        populationLocked
                          ? 'Locked'
                          : 'Read only'
                      }
                    </span>
                  )}
                </div>
              );
            },
          )
        )}
      </div>
    </section>
  );
}
