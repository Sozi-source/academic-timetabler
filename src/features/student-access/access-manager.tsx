'use client';

import {
  Check,
  Clipboard,
  Download,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  formatStudentPortalAccessTime,
  studentPortalAccessStatus,
  studentPortalAccessStatusLabel,
} from './domain';
import type {
  StudentPortalAccessRow,
  StudentPortalAccessStatus,
} from './types';

type FilterValue = 'all' | StudentPortalAccessStatus;

export function StudentPortalAccessManager({
  rows,
}: {
  rows: StudentPortalAccessRow[];
}) {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [activeStudentPin, setActiveStudentPin] = useState<{
    studentId: string;
    admissionNumber: string;
    fullName: string;
    programmeCode: string;
    cohortName: string;
    pin: string;
  } | null>(null);

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return rows.filter((row) => {
      const status = studentPortalAccessStatus(row);

      if (filter !== 'all' && status !== filter) {
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
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [filter, query, rows]);

  // Issue or Rotate a PIN for an individual student
  async function handleRotatePin(row: StudentPortalAccessRow) {
    setBusy(`pin:${row.studentId}`);
    setError(null);

    try {
      const response = await fetch(
        `/api/students/portal-access/${row.studentId}/pin`,
        { method: 'POST' },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? 'PIN could not be rotated.');
        return;
      }

      setActiveStudentPin({
        studentId: row.studentId,
        admissionNumber: row.admissionNumber,
        fullName: row.fullName,
        programmeCode: row.programmeCode,
        cohortName: row.cohortName,
        pin: payload.pin,
      });

      setCopied(false);
      router.refresh();
    } catch {
      setError('An error occurred while generating the PIN.');
    } finally {
      setBusy(null);
    }
  }

  // Toggle enable/disable
  async function handleToggleState(
    row: StudentPortalAccessRow,
    active: boolean,
  ) {
    setBusy(`state:${row.studentId}`);
    setError(null);

    try {
      const response = await fetch(
        `/api/students/portal-access/${row.studentId}/state`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active }),
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? 'Account state could not be updated.');
        return;
      }

      router.refresh();
    } catch {
      setError('An error occurred while updating account state.');
    } finally {
      setBusy(null);
    }
  }

  // Bulk issue / regenerate
  async function handleBulkIssue(forceAll = false) {
    setBusy(forceAll ? 'bulk-all' : 'bulk-missing');
    setError(null);

    try {
      const response = await fetch(
        `/api/students/portal-access/issue${forceAll ? '?forceAll=true' : ''}`,
        { method: 'POST' },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.message ?? 'Bulk PIN generation failed.');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = forceAll
        ? 'all-student-portal-pins.xlsx'
        : 'new-student-portal-pins.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      router.refresh();
    } catch {
      setError('An error occurred during bulk generation.');
    } finally {
      setBusy(null);
    }
  }

  async function handleCopyPin(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filters: Array<{ value: FilterValue; label: string }> = [
    { value: 'all', label: 'All Students' },
    { value: 'active', label: 'Active Access' },
    { value: 'not_issued', label: 'Not Issued' },
    { value: 'disabled', label: 'Disabled' },
    { value: 'locked', label: 'Locked' },
  ];

  return (
    <div className="space-y-4 pb-12">
      {/* Active Generated / Rotated PIN Banner */}
      {activeStudentPin ? (
        <section className="relative overflow-hidden rounded-xl border border-slate-300 bg-slate-900 p-4 text-white shadow-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded bg-slate-800 text-slate-200">
                  <KeyRound className="size-3.5" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Student Portal Access PIN
                </span>
              </div>

              <div className="mt-2">
                <h3 className="text-sm font-bold text-white">
                  {activeStudentPin.fullName}
                </h3>
                <p className="text-xs text-slate-400">
                  {activeStudentPin.admissionNumber} · {activeStudentPin.cohortName} ({activeStudentPin.programmeCode})
                </p>
              </div>

              {/* Large PIN display */}
              <div className="mt-3 flex items-center gap-3">
                <span className="rounded-lg bg-slate-800 px-4 py-2 font-mono text-2xl font-black tracking-[0.3em] text-white border border-slate-700 shadow-inner">
                  {activeStudentPin.pin}
                </span>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyPin(activeStudentPin.pin)}
                  className="h-9 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                  leadingIcon={
                    copied ? (
                      <Check className="size-3.5 text-emerald-400" />
                    ) : (
                      <Clipboard className="size-3.5" />
                    )
                  }
                >
                  {copied ? 'Copied PIN' : 'Copy PIN'}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => {
                    const row = rows.find((r) => r.studentId === activeStudentPin.studentId);
                    if (row) handleRotatePin(row);
                  }}
                  className="h-9 text-slate-300 hover:bg-slate-800 hover:text-white"
                  leadingIcon={
                    busy === `pin:${activeStudentPin.studentId}` ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )
                  }
                >
                  Rotate Again
                </Button>
              </div>

              <p className="mt-2 text-[11px] text-slate-400">
                Share this 6-digit PIN with the student for their portal sign-in.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveStudentPin(null)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              aria-label="Dismiss PIN Banner"
            >
              <X className="size-4" />
            </button>
          </div>
        </section>
      ) : null}

      {/* Action Bar & Search */}
      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student, admission number, cohort..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => handleBulkIssue(false)}
            className="h-9 text-xs font-semibold text-slate-700"
            leadingIcon={
              busy === 'bulk-missing' ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )
            }
          >
            Issue Missing PINs
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => {
              if (
                window.confirm(
                  'Are you sure you want to regenerate and rotate PINs for ALL students? This will overwrite existing PINs and download the updated spreadsheet.',
                )
              ) {
                handleBulkIssue(true);
              }
            }}
            className="h-9 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            leadingIcon={
              busy === 'bulk-all' ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )
            }
          >
            Rotate All PINs (Excel)
          </Button>
        </div>
      </section>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === item.value
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}

      {/* Student List Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
              <tr>
                <th className="px-4 py-2.5">Student</th>
                <th className="px-3 py-2.5">Programme</th>
                <th className="px-3 py-2.5">Cohort</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5 text-center">Last Sign In</th>
                <th className="px-4 py-2.5 text-right">PIN Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">
                    No students match this view.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const status = studentPortalAccessStatus(row);
                  const isBusyPin = busy === `pin:${row.studentId}`;
                  const isBusyState = busy === `state:${row.studentId}`;

                  return (
                    <tr key={row.studentId} className="transition hover:bg-slate-50/50">
                      {/* Student Name & Adm */}
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{row.fullName}</p>
                        <p className="text-[11px] font-medium text-slate-500">{row.admissionNumber}</p>
                      </td>

                      {/* Programme */}
                      <td className="px-3 py-3 text-slate-600">
                        {row.programmeCode}
                      </td>

                      {/* Cohort */}
                      <td className="px-3 py-3 text-slate-600">
                        {row.cohortName}
                      </td>

                      {/* Access Status */}
                      <td className="px-3 py-3 text-center">
                        <Badge
                          variant="neutral"
                          className={
                            status === 'active'
                              ? 'bg-slate-100 text-slate-800'
                              : status === 'not_issued'
                                ? 'bg-slate-50 text-slate-400'
                                : status === 'locked'
                                  ? 'bg-amber-50 text-amber-800'
                                  : 'bg-red-50 text-red-700'
                          }
                        >
                          {studentPortalAccessStatusLabel(status)}
                        </Badge>
                      </td>

                      {/* Last Login */}
                      <td className="px-3 py-3 text-center text-[11px] text-slate-400">
                        {formatStudentPortalAccessTime(row.lastLoginAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy !== null}
                            onClick={() => handleRotatePin(row)}
                            className="h-7 border-slate-200 px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                            leadingIcon={
                              isBusyPin ? (
                                <LoaderCircle className="size-3 animate-spin" />
                              ) : (
                                <KeyRound className="size-3" />
                              )
                            }
                          >
                            {row.hasCredential ? 'Rotate PIN' : 'Generate PIN'}
                          </Button>

                          {row.hasCredential ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy !== null}
                              onClick={() => handleToggleState(row, !row.isActive)}
                              className="h-7 px-2 text-[11px] font-semibold text-slate-500 hover:text-slate-900"
                              leadingIcon={
                                isBusyState ? (
                                  <LoaderCircle className="size-3 animate-spin" />
                                ) : row.isActive ? (
                                  <ShieldOff className="size-3" />
                                ) : (
                                  <ShieldCheck className="size-3" />
                                )
                              }
                            >
                              {row.isActive ? 'Disable' : 'Enable'}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <LockKeyhole className="size-3 text-slate-400" />
        Admins can view and rotate student PINs at any time. PINs are securely hashed and validated upon student login.
      </p>
    </div>
  );
}
