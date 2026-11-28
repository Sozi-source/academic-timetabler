'use client';

import {
  LoaderCircle,
  LockKeyhole,
  Search,
  ShieldCheck,
  ShieldOff,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
    { value: 'not_issued', label: 'Not Activated' },
    { value: 'disabled', label: 'Disabled' },
    { value: 'locked', label: 'Locked' },
  ];

  return (
    <div className="space-y-4 pb-12">
      {/* Search & Filter Bar */}
      <section className="flex flex-col gap-3 rounded-xl border border-slate-300 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student, admission number, cohort..."
            className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-7 text-xs font-medium text-slate-900 placeholder:text-slate-500 placeholder:opacity-100 outline-none transition focus:border-slate-500"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        {/* Filter Pills */}
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
      </section>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}

      {/* Student List Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <TableContainer embedded label="Student portal access">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Admission No</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Programme</TableHead>
                <TableHead>Cohort</TableHead>
                <TableHead className="text-center">Activation Status</TableHead>
                <TableHead className="text-center">Last Sign In</TableHead>
                <TableHead className="text-right">Account Controls</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {visibleRows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-8 text-center text-xs font-medium text-text-muted">
                    No students match this view.
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map((row) => {
                  const status = studentPortalAccessStatus(row);
                  const isBusyState = busy === `state:${row.studentId}`;

                  return (
                    <TableRow key={row.studentId}>
                      <TableCell className="font-mono text-xs font-semibold text-text-secondary">
                        {row.admissionNumber}
                      </TableCell>

                      <TableCell className="font-semibold text-text-primary">
                        {row.fullName}
                      </TableCell>

                      <TableCell className="text-text-secondary">
                        {row.programmeCode}
                      </TableCell>

                      <TableCell className="text-text-secondary">
                        {row.cohortName}
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge
                          variant="neutral"
                          className={
                            status === 'active'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
                              : status === 'not_issued'
                                ? 'bg-slate-100 text-slate-700 border-slate-300 font-bold'
                                : status === 'locked'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200 font-bold'
                                  : 'bg-red-50 text-red-700 border-red-200 font-bold'
                          }
                        >
                          {status === 'not_issued' ? 'Not Activated' : studentPortalAccessStatusLabel(status)}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-center text-xs text-text-secondary">
                        {formatStudentPortalAccessTime(row.lastLoginAt)}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {row.hasCredential ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy !== null}
                              onClick={() => handleToggleState(row, !row.isActive)}
                              className="h-7 px-2.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
                              leadingIcon={
                                isBusyState ? (
                                  <LoaderCircle className="size-3 animate-spin" />
                                ) : row.isActive ? (
                                  <ShieldOff className="size-3 text-red-600" />
                                ) : (
                                  <ShieldCheck className="size-3 text-emerald-600" />
                                )
                              }
                            >
                              {row.isActive ? 'Disable Access' : 'Enable Access'}
                            </Button>
                          ) : (
                            <span className="text-xs font-semibold text-text-muted italic">
                              Pending Activation
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </section>

      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <LockKeyhole className="size-3 text-slate-400" />
        Students activate their portal accounts directly at <span className="font-mono text-slate-700 font-bold">/student/activate</span>. Admins can track activation status and manage security access controls.
      </p>
    </div>
  );
}
