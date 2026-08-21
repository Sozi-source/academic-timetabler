'use client';

import {
  Check,
  Clipboard,
  Download,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Search,
  ShieldOff,
  ShieldCheck,
  X,
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
  Input,
} from '@/components/ui/input';

import {
  formatStudentPortalAccessTime,
  studentPortalAccessStatus,
  studentPortalAccessStatusLabel,
} from './domain';
import type {
  StudentPortalAccessRow,
  StudentPortalAccessStatus,
} from './types';

type FilterValue =
  | 'all'
  | StudentPortalAccessStatus;

function statusVariant(
  status:
    StudentPortalAccessStatus,
) {
  if (
    status ===
    'active'
  ) {
    return 'success' as const;
  }

  if (
    status ===
    'locked'
  ) {
    return 'warning' as const;
  }

  if (
    status ===
    'disabled'
  ) {
    return 'danger' as const;
  }

  return 'neutral' as const;
}

export function StudentPortalAccessManager({
  rows,
}: {
  rows:
    StudentPortalAccessRow[];
}) {
  const router =
    useRouter();

  const [
    query,
    setQuery,
  ] =
    useState(
      '',
    );

  const [
    filter,
    setFilter,
  ] =
    useState<
      FilterValue
    >(
      'all',
    );

  const [
    busy,
    setBusy,
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

  const [
    issuedPin,
    setIssuedPin,
  ] =
    useState<{
      studentId:
        string;
      admissionNumber:
        string;
      fullName:
        string;
      pin:
        string;
    } | null>(
      null,
    );

  const [
    copied,
    setCopied,
  ] =
    useState(
      false,
    );

  const visibleRows =
    useMemo(
      () => {
        const normalized =
          query
            .trim()
            .toLowerCase();

        return rows.filter(
          (row) => {
            const status =
              studentPortalAccessStatus(
                row,
              );

            if (
              filter !==
                'all' &&
              status !==
                filter
            ) {
              return false;
            }

            if (!normalized) {
              return true;
            }

            return [
              row.fullName,
              row.admissionNumber,
              row.programmeCode,
              row.cohortName,
            ]
              .join(
                ' ',
              )
              .toLowerCase()
              .includes(
                normalized,
              );
          },
        );
      },
      [
        filter,
        query,
        rows,
      ],
    );

  async function issuePin(
    row:
      StudentPortalAccessRow,
  ) {
    setBusy(
      `pin:${row.studentId}`,
    );

    setError(
      null,
    );

    setIssuedPin(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/students/portal-access/${row.studentId}/pin`,
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
          'PIN could not be issued.',
        );
        return;
      }

      setIssuedPin({
        studentId:
          row.studentId,
        admissionNumber:
          row.admissionNumber,
        fullName:
          row.fullName,
        pin:
          payload.pin,
      });

      setCopied(
        false,
      );

      router.refresh();
    } finally {
      setBusy(
        null,
      );
    }
  }

  async function updateState(
    row:
      StudentPortalAccessRow,
    active:
      boolean,
  ) {
    setBusy(
      `state:${row.studentId}`,
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/students/portal-access/${row.studentId}/state`,
          {
            method:
              'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({
                active,
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
          'Access state could not be changed.',
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

  async function bulkIssue() {
    setBusy(
      'bulk',
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          '/api/students/portal-access/issue',
          {
            method:
              'POST',
          },
        );

      if (!response.ok) {
        const payload =
          await response
            .json()
            .catch(
              () => null,
            );

        setError(
          payload?.message ??
          'Student access workbook could not be generated.',
        );

        return;
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(
          blob,
        );

      const anchor =
        document.createElement(
          'a',
        );

      anchor.href =
        url;

      anchor.download =
        'student-portal-access-pins.xlsx';

      document.body.appendChild(
        anchor,
      );

      anchor.click();

      anchor.remove();

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

  async function copyPin() {
    if (!issuedPin) {
      return;
    }

    await navigator.clipboard.writeText(
      issuedPin.pin,
    );

    setCopied(
      true,
    );
  }

  const filters:
    Array<{
      value:
        FilterValue;
      label:
        string;
    }> = [
      {
        value:
          'all',
        label:
          'All',
      },
      {
        value:
          'not_issued',
        label:
          'Not issued',
      },
      {
        value:
          'active',
        label:
          'Active',
      },
      {
        value:
          'disabled',
        label:
          'Disabled',
      },
      {
        value:
          'locked',
        label:
          'Locked',
      },
    ];

  return (
    <div className="space-y-4">
      {issuedPin ? (
        <section className="rounded-xl border border-institutional-accent-border bg-institutional-yellow/15 px-4 py-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
                New access PIN
              </p>

              <p className="mt-1 text-xs font-semibold text-text-primary">
                {
                  issuedPin.fullName
                }
                {' · '}
                {
                  issuedPin.admissionNumber
                }
              </p>

              <p className="mt-2 font-mono text-2xl font-extrabold tracking-[0.25em] text-text-primary">
                {
                  issuedPin.pin
                }
              </p>

              <p className="mt-1 text-[10px] text-text-muted">
                Share securely. The PIN is not stored in readable form.
              </p>
            </div>

            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  void copyPin()
                }
                leadingIcon={
                  copied ? (
                    <Check
                      className="size-3"
                      aria-hidden="true"
                    />
                  ) : (
                    <Clipboard
                      className="size-3"
                      aria-hidden="true"
                    />
                  )
                }
              >
                {copied
                  ? 'Copied'
                  : 'Copy'}
              </Button>

              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Close PIN"
                onClick={() =>
                  setIssuedPin(
                    null,
                  )
                }
              >
                <X
                  className="size-3.5"
                  aria-hidden="true"
                />
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full max-w-md">
          <Input
            value={
              query
            }
            onChange={(
              event,
            ) =>
              setQuery(
                event.target.value,
              )
            }
            placeholder="Search student, admission no. or cohort"
            leadingContent={
              <Search
                className="size-3.5"
                aria-hidden="true"
              />
            }
          />
        </div>

        <Button
          type="button"
          size="sm"
          disabled={
            busy !==
            null
          }
          onClick={() =>
            void bulkIssue()
          }
          leadingIcon={
            busy ===
            'bulk' ? (
              <LoaderCircle
                className="size-3.5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Download
                className="size-3.5"
                aria-hidden="true"
              />
            )
          }
        >
          Issue missing access
        </Button>
      </section>

      <div className="flex flex-wrap gap-1.5">
        {filters.map(
          (
            item,
          ) => (
            <button
              key={
                item.value
              }
              type="button"
              onClick={() =>
                setFilter(
                  item.value,
                )
              }
              className={
                filter ===
                item.value
                  ? 'rounded-lg border border-primary bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-white'
                  : 'rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-text-secondary transition hover:border-border-strong'
              }
            >
              {
                item.label
              }
            </button>
          ),
        )}
      </div>

      {error ? (
        <p className="rounded-lg border border-danger-border bg-danger-surface px-3 py-2.5 text-[11px] text-danger">
          {
            error
          }
        </p>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="hidden border-b border-border bg-surface-subtle px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted lg:grid lg:grid-cols-[minmax(0,1.3fr)_8rem_minmax(8rem,.8fr)_8rem_9rem_auto] lg:items-center lg:gap-3">
          <span>Student</span>
          <span>Programme</span>
          <span>Cohort</span>
          <span>Access</span>
          <span>Last login</span>
          <span />
        </div>

        {visibleRows.length ===
        0 ? (
          <p className="px-4 py-6 text-center text-xs text-text-muted">
            No students match this view.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {visibleRows.map(
              (
                row,
              ) => {
                const status =
                  studentPortalAccessStatus(
                    row,
                  );

                return (
                  <article
                    key={
                      row.studentId
                    }
                    className="grid gap-3 px-4 py-3.5 lg:grid-cols-[minmax(0,1.3fr)_8rem_minmax(8rem,.8fr)_8rem_9rem_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-text-primary">
                        {
                          row.fullName
                        }
                      </p>

                      <p className="mt-0.5 text-[10px] text-text-muted">
                        {
                          row.admissionNumber
                        }
                      </p>
                    </div>

                    <p className="text-[11px] font-semibold text-text-secondary">
                      {
                        row.programmeCode
                      }
                    </p>

                    <p className="text-[11px] text-text-secondary">
                      {
                        row.cohortName
                      }
                    </p>

                    <Badge
                      variant={
                        statusVariant(
                          status,
                        )
                      }
                    >
                      {studentPortalAccessStatusLabel(
                        status,
                      )}
                    </Badge>

                    <p className="text-[10px] leading-4 text-text-muted">
                      {formatStudentPortalAccessTime(
                        row.lastLoginAt,
                      )}
                    </p>

                    <div className="flex flex-wrap gap-1.5 lg:justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          busy !==
                          null
                        }
                        onClick={() =>
                          void issuePin(
                            row,
                          )
                        }
                        leadingIcon={
                          busy ===
                          `pin:${row.studentId}` ? (
                            <LoaderCircle
                              className="size-3 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <KeyRound
                              className="size-3"
                              aria-hidden="true"
                            />
                          )
                        }
                      >
                        {row.hasCredential
                          ? 'Reset PIN'
                          : 'Issue PIN'}
                      </Button>

                      {row.hasCredential ? (
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            row.isActive
                              ? 'ghost'
                              : 'outline'
                          }
                          disabled={
                            busy !==
                            null
                          }
                          onClick={() =>
                            void updateState(
                              row,
                              !row.isActive,
                            )
                          }
                          leadingIcon={
                            busy ===
                            `state:${row.studentId}` ? (
                              <LoaderCircle
                                className="size-3 animate-spin"
                                aria-hidden="true"
                              />
                            ) : row.isActive ? (
                              <ShieldOff
                                className="size-3"
                                aria-hidden="true"
                              />
                            ) : (
                              <ShieldCheck
                                className="size-3"
                                aria-hidden="true"
                              />
                            )
                          }
                        >
                          {row.isActive
                            ? 'Disable'
                            : 'Enable'}
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>

      <p className="flex items-start gap-1.5 text-[10px] leading-4 text-text-muted">
        <LockKeyhole
          className="mt-0.5 size-3 shrink-0"
          aria-hidden="true"
        />
        Five failed sign-in attempts temporarily lock the student account for 15 minutes.
      </p>
    </div>
  );
}
