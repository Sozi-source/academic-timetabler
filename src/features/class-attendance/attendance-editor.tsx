'use client';

import {
  Check,
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
  Save,
  Search,
  Send,
  UserX,
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
  ABSENT_CIRCUMSTANCES,
  canCompleteClassAttendance,
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
  returnTo,
}: {
  sessionId: string;
  sessionStatus: ClassSessionStatus;
  students: ClassAttendanceStudent[];
  returnTo?: string;
}) {
  const router = useRouter();

  // Initialize statuses: default all active students to 'present' unless explicitly absent, not reported, or already saved
  const [statuses, setStatuses] = useState<Record<string, ClassAttendanceStatus>>(() => {
    return Object.fromEntries(
      students.map((student) => {
        if (student.attendanceStatus === 'absent') {
          return [student.studentId, 'absent'];
        }
        if (student.attendanceStatus === 'present') {
          return [student.studentId, 'present'];
        }
        if (student.attendanceStatus === 'not_reported') {
          return [student.studentId, 'not_reported'];
        }

        // Student was unmarked: default to present unless semester not-reported
        const isNotReported =
          student.isReported === false ||
          (student.reportingStatus && student.reportingStatus !== 'reported');

        return [student.studentId, isNotReported ? 'not_reported' : 'present'];
      }),
    );
  });

  const [notes, setNotes] = useState<Record<string, string>>(() => {
    return Object.fromEntries(
      students.map((student) => [student.studentId, student.note ?? '']),
    );
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'absent' | 'present' | 'not_reported'>('all');

  const [busy, setBusy] = useState<'save' | 'complete' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editable = sessionStatus === 'open';

  const summary = useMemo(
    () =>
      classAttendanceSummary(
        students.map((student) => statuses[student.studentId] ?? 'unmarked'),
      ),
    [statuses, students],
  );

  const completeReady = canCompleteClassAttendance(
    students.map((student) => statuses[student.studentId] ?? 'unmarked'),
  );

  // Filtered students based on search query and active tab
  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return students.filter((student) => {
      const currentStatus = statuses[student.studentId] ?? 'unmarked';

      if (filterTab === 'absent' && currentStatus !== 'absent') return false;
      if (filterTab === 'present' && currentStatus !== 'present') return false;
      if (filterTab === 'not_reported' && currentStatus !== 'not_reported') return false;

      if (!query) return true;

      const nameMatch = student.fullName.toLowerCase().includes(query);
      const admMatch = student.admissionNumber.toLowerCase().includes(query);
      return nameMatch || admMatch;
    });
  }, [students, statuses, filterTab, searchQuery]);

  function payload() {
    return students.map((student) => ({
      studentId: student.studentId,
      status: statuses[student.studentId] ?? 'unmarked',
      note: notes[student.studentId]?.trim() ?? '',
    }));
  }

  function handleMarkAllPresent() {
    setStatuses((prev) => {
      const next = { ...prev };
      for (const student of students) {
        const isNotReported =
          student.isReported === false ||
          (student.reportingStatus && student.reportingStatus !== 'reported');
        if (!isNotReported) {
          next[student.studentId] = 'present';
        }
      }
      return next;
    });
  }

  function handleSelectCircumstance(studentId: string, circumstance: string) {
    if (!editable || busy !== null) return;
    setNotes((prev) => {
      const existing = prev[studentId] || '';
      if (existing === circumstance) {
        return { ...prev, [studentId]: '' };
      }
      return { ...prev, [studentId]: circumstance };
    });
  }

  async function save(silent = false): Promise<boolean> {
    setBusy('save');
    setError(null);
    if (!silent) setMessage(null);

    try {
      const response = await fetch(`/api/staff/attendance/${sessionId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: payload() }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setError(result?.message ?? 'Attendance could not be saved.');
        return false;
      }

      if (!silent) {
        setMessage('Attendance saved.');
      }
      return true;
    } catch {
      setError('Network error while saving attendance.');
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function complete() {
    if (!completeReady) {
      setError('Please review all students before completing attendance.');
      return;
    }

    setBusy('complete');
    setError(null);
    setMessage(null);

    try {
      const saveResponse = await fetch(`/api/staff/attendance/${sessionId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: payload() }),
      });

      if (!saveResponse.ok) {
        const result = await saveResponse.json().catch(() => null);
        setError(result?.message ?? 'Latest attendance could not be saved.');
        return;
      }

      const response = await fetch(`/api/staff/attendance/${sessionId}/complete`, {
        method: 'POST',
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setError(result?.message ?? 'Attendance could not be completed.');
        return;
      }

      setMessage('Attendance completed successfully.');

      if (returnTo) {
        router.push(returnTo);
      } else {
        router.refresh();
      }
    } catch {
      setError('Network error while completing attendance.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Metrics Summary Strip */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Total Enrolled
          </p>
          <p className="mt-1 text-lg font-bold text-text-primary">
            {summary.total}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Present
            </p>
            <span className="size-2 rounded-full bg-emerald-500" />
          </div>
          <p className="mt-1 text-lg font-bold text-emerald-900">
            {summary.present}
          </p>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
              Absent
            </p>
            <span className="size-2 rounded-full bg-rose-500" />
          </div>
          <p className="mt-1 text-lg font-bold text-rose-900">
            {summary.absent}
          </p>
        </div>

        {summary.notReported > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Not Reported
              </p>
              <span className="size-2 rounded-full bg-amber-500" />
            </div>
            <p className="mt-1 text-lg font-bold text-amber-900">
              {summary.notReported}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Register Status
            </p>
            <p className="mt-1 text-xs font-semibold text-text-secondary">
              {editable ? 'Mark absentees below' : 'Record Completed'}
            </p>
          </div>
        )}
      </section>

      {/* Concise Helper Banner */}
      {editable ? (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-text-secondary">
            Students are <strong className="text-emerald-700">Present</strong> by default. Tap <strong className="text-rose-700">Absent</strong> only for missing students.
          </p>
          {summary.absent > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllPresent}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              <RotateCcw className="size-3" />
              Reset All to Present
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Search and Filter Controls */}
      <section className="flex flex-col gap-2 rounded-xl border border-border bg-white p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or admission number..."
            className="h-8 w-full rounded-lg border border-border bg-slate-50/50 pl-8 pr-7 text-xs text-text-primary outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-text-muted hover:text-text-primary"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
              filterTab === 'all'
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:bg-surface-subtle'
            }`}
          >
            All ({summary.total})
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('absent')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
              filterTab === 'absent'
                ? 'bg-rose-600 text-white'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            Absent ({summary.absent})
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('present')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
              filterTab === 'present'
                ? 'bg-emerald-600 text-white'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Present ({summary.present})
          </button>

          {summary.notReported > 0 ? (
            <button
              type="button"
              onClick={() => setFilterTab('not_reported')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                filterTab === 'not_reported'
                  ? 'bg-amber-600 text-white'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              Not Reported ({summary.notReported})
            </button>
          ) : null}
        </div>
      </section>

      {/* Student Roster Register */}
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
        <div className="divide-y divide-border">
          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted">
              No students match the current filter or search criteria.
            </div>
          ) : (
            filteredStudents.map((student) => {
              const status = statuses[student.studentId] ?? 'present';
              const isAbsent = status === 'absent';
              const isNotReported = status === 'not_reported';
              const noteText = notes[student.studentId] ?? '';

              return (
                <article
                  key={student.studentId}
                  className={`p-3.5 transition-colors ${
                    isAbsent
                      ? 'bg-rose-50/30'
                      : isNotReported
                        ? 'bg-amber-50/20'
                        : 'hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* Student Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-bold text-text-primary">
                          {student.fullName}
                        </p>
                        <span className="font-mono text-[10px] text-text-muted">
                          {student.admissionNumber}
                        </span>
                        {student.isReported === false ||
                        (student.reportingStatus && student.reportingStatus !== 'reported') ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                            Semester: Not Reported
                          </span>
                        ) : null}
                      </div>

                      {/* Note display for present/completed students */}
                      {!isAbsent && noteText ? (
                        <p className="mt-1 text-[11px] italic text-text-muted">
                          Note: {noteText}
                        </p>
                      ) : null}
                    </div>

                    {/* Attendance Status Action Control */}
                    <div className="flex shrink-0 items-center gap-2">
                      {editable ? (
                        <div className="inline-flex rounded-lg border border-border bg-slate-100 p-0.5 shadow-2xs">
                          {/* Present Toggle Button */}
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => {
                              setStatuses((prev) => ({
                                ...prev,
                                [student.studentId]: 'present',
                              }));
                            }}
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                              status === 'present'
                                ? 'bg-white text-emerald-700 shadow-xs'
                                : 'text-text-muted hover:text-text-primary'
                            }`}
                          >
                            <Check className="size-3" />
                            Present
                          </button>

                          {/* Absent Toggle Button */}
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => {
                              setStatuses((prev) => ({
                                ...prev,
                                [student.studentId]: 'absent',
                              }));
                            }}
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                              isAbsent
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-text-muted hover:text-rose-700'
                            }`}
                          >
                            <UserX className="size-3" />
                            Absent
                          </button>

                          {/* Not Reported Option if applicable */}
                          {(student.isReported === false ||
                            (student.reportingStatus && student.reportingStatus !== 'reported') ||
                            isNotReported) ? (
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => {
                                setStatuses((prev) => ({
                                  ...prev,
                                  [student.studentId]: 'not_reported',
                                }));
                              }}
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                                isNotReported
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'text-text-muted hover:text-amber-700'
                              }`}
                            >
                              Not Reported
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <Badge variant={classAttendanceStatusVariant(status)}>
                          {status === 'present'
                            ? 'Present'
                            : status === 'absent'
                              ? 'Absent'
                              : status === 'not_reported'
                                ? 'Not Reported'
                                : 'Unmarked'}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Absent Circumstance Selector (Visible only when marked Absent) */}
                  {isAbsent && editable ? (
                    <div className="mt-3 rounded-lg border border-rose-200 bg-white p-2.5 shadow-2xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-900">
                          Circumstance:
                        </span>
                        {ABSENT_CIRCUMSTANCES.map((circ) => {
                          const isSelected = noteText === circ;
                          return (
                            <button
                              key={circ}
                              type="button"
                              onClick={() => handleSelectCircumstance(student.studentId, circ)}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
                                isSelected
                                  ? 'bg-rose-600 text-white font-semibold'
                                  : 'border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
                              }`}
                            >
                              {circ}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-2">
                        <input
                          type="text"
                          maxLength={500}
                          value={noteText}
                          onChange={(e) =>
                            setNotes((prev) => ({
                              ...prev,
                              [student.studentId]: e.target.value,
                            }))
                          }
                          placeholder="Specific notes (e.g., Leave of absence approved until next week)..."
                          className="h-8 w-full rounded-md border border-slate-200 bg-slate-50/50 px-2.5 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* Status Messages */}
      {error ? (
        <p className="rounded-lg border border-danger-border bg-danger-surface px-3 py-2 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
          <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
          {message}
        </p>
      ) : null}

      {/* Action Footer */}
      {editable ? (
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-text-muted">
            {summary.absent === 0 ? (
              <span className="font-medium text-emerald-700">
                All {summary.total} students present.
              </span>
            ) : (
              <span className="font-medium text-rose-700">
                {summary.absent} student{summary.absent === 1 ? '' : 's'} marked absent.
              </span>
            )}
          </p>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => void save()}
              leadingIcon={
                busy === 'save' ? (
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-3.5" aria-hidden="true" />
                )
              }
            >
              Save Draft
            </Button>

            <Button
              type="button"
              disabled={busy !== null || !completeReady}
              onClick={() => void complete()}
              leadingIcon={
                busy === 'complete' ? (
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-3.5" aria-hidden="true" />
                )
              }
            >
              Complete Register
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-right text-[11px] text-text-muted">
          Completed attendance register is official and locked.
        </p>
      )}
    </div>
  );
}
