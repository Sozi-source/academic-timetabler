'use client';

import { AlertCircle, CheckCircle2, Info, LoaderCircle, Lock, RotateCcw, Save, Send, X } from 'lucide-react';
import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import type { TrainerMarkComponentKey, TrainerMarkComponentSubmissions, TrainerMarkEntryRow } from './trainer-mark-entry-types';

interface TrainerMarkSession {
  trainerName: string;
  trainerEmail: string | null;
  expiresAt: string;
  submittedAt: string | null;
  locked: boolean;
  trainerEntryOpen?: boolean;
  unit: { code: string | null; name: string };
  academicPeriod: string;
  cohorts: Array<{
    id: string | null;
    name: string;
    students: TrainerMarkEntryRow[];
    submittedAt: string | null;
    locked: boolean;
    trainerEntryOpen?: boolean;
    componentSubmissions: TrainerMarkComponentSubmissions;
  }>;
}

type MarkField = TrainerMarkComponentKey;
type MarkView = 'all' | MarkField;

const markFields: Array<{ key: MarkField; label: string; maximum: number }> = [
  { key: 'assignment', label: 'Assignment /5', maximum: 5 },
  { key: 'presentation', label: 'Presentation /10', maximum: 10 },
  { key: 'rat', label: 'RAT /15', maximum: 15 },
  { key: 'cat', label: 'CAT /15', maximum: 15 },
  { key: 'exam', label: 'Exam /70', maximum: 70 },
];

const markViews: Array<{ key: MarkView; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'assignment', label: 'Assignment' },
  { key: 'presentation', label: 'Presentation' },
  { key: 'rat', label: 'RAT' },
  { key: 'cat', label: 'CAT' },
  { key: 'exam', label: 'Exam' },
];

export function TrainerMarkEntryPortal() {
  const [session, setSession] = useState<TrainerMarkSession | null>(null);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<MarkView>('all');
  const [students, setStudents] = useState<TrainerMarkEntryRow[]>([]);
  const [studentsByCohort, setStudentsByCohort] = useState<Record<string, TrainerMarkEntryRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'save' | 'submit' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [closedNoticeDialogOpen, setClosedNoticeDialogOpen] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [submitConfirmDialogOpen, setSubmitConfirmDialogOpen] = useState(false);

  const loadSession = useCallback(async () => {
    const response = await fetch('/api/trainer-mark-entry/session', { cache: 'no-store' });
    const result = await response.json() as TrainerMarkSession & { message?: string };
    if (!response.ok) throw new Error(result.message ?? 'Could not load this markbook.');
    return result;
  }, []);

  useEffect(() => {
    async function connect() {
      setLoading(true);
      setError('');
      const token = window.location.hash.slice(1);
      if (token) {
        window.history.replaceState(null, '', window.location.pathname);
        const exchangeResponse = await fetch('/api/trainer-mark-entry/exchange', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const exchangeResult = await exchangeResponse.json() as { message?: string };
        if (!exchangeResponse.ok) throw new Error(exchangeResult.message ?? 'This trainer link is invalid or expired.');
      }
      const loadedSession = await loadSession();
      setSession(loadedSession);
      const firstCohort = loadedSession.cohorts[0] ?? null;
      setSelectedCohortId(firstCohort?.id ?? null);
      setStudents(firstCohort?.students ?? []);
      setStudentsByCohort(Object.fromEntries(loadedSession.cohorts.map((cohort) => [cohort.id ?? 'all', cohort.students])));
    }

    void connect()
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not open this trainer link.'))
      .finally(() => setLoading(false));
  }, [loadSession]);

  function updateMark(assessmentId: string, studentId: string, field: MarkField, value: string) {
    if (field === 'exam') {
      const trimmed = value.trim().toUpperCase();
      if (trimmed === 'AB' || trimmed === 'ABSENT' || trimmed === 'A') {
        const update = (current: TrainerMarkEntryRow[]) => current.map((student) => (
          student.assessmentId === assessmentId && student.studentId === studentId
            ? { ...student, exam: null, attendanceStatus: 'absent' as const }
            : student
        ));
        setStudents((current) => update(current));
        const cohortKey = selectedCohortId ?? 'all';
        setStudentsByCohort((current) => ({ ...current, [cohortKey]: update(current[cohortKey] ?? []) }));
        return;
      }
    }
    const maximum = markFields.find((markField) => markField.key === field)?.maximum ?? 0;
    const wholeNumber = value === '' ? null : Math.min(Number(value.replace(/\D/g, '')), maximum);
    const update = (current: TrainerMarkEntryRow[]) => current.map((student) => {
      if (student.assessmentId === assessmentId && student.studentId === studentId) {
        return {
          ...student,
          [field]: wholeNumber,
          attendanceStatus: field === 'exam' && wholeNumber !== null ? ('expected' as const) : student.attendanceStatus,
        };
      }
      return student;
    });
    setStudents((current) => update(current));
    const cohortKey = selectedCohortId ?? 'all';
    setStudentsByCohort((current) => ({ ...current, [cohortKey]: update(current[cohortKey] ?? []) }));
  }

  function moveMarkCell(event: KeyboardEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const key = event.key;

    let deltaRow = 0;
    let deltaCol = 0;

    if (key === 'ArrowDown') {
      deltaRow = 1;
    } else if (key === 'ArrowUp') {
      deltaRow = -1;
    } else if (key === 'Enter') {
      deltaRow = event.shiftKey ? -1 : 1;
    } else if (key === 'Tab') {
      deltaCol = event.shiftKey ? -1 : 1;
    } else if (key === 'ArrowRight') {
      const isAtEnd = input.selectionEnd === input.value.length;
      const isAllSelected =
        input.selectionStart === 0 && input.selectionEnd === input.value.length;
      if (input.value === '' || isAtEnd || isAllSelected) {
        deltaCol = 1;
      } else {
        return;
      }
    } else if (key === 'ArrowLeft') {
      const isAtStart = input.selectionStart === 0 && input.selectionEnd === 0;
      const isAllSelected =
        input.selectionStart === 0 && input.selectionEnd === input.value.length;
      if (input.value === '' || isAtStart || isAllSelected) {
        deltaCol = -1;
      } else {
        return;
      }
    } else {
      return;
    }

    const visibleFields = selectedView === 'all' ? markFields : markFields.filter((field) => field.key === selectedView);
    const totalCols = visibleFields.length;
    const totalRows = students.length;

    let targetRow = Number(input.dataset.markRow);
    let targetCol = Number(input.dataset.markColumn);
    const table = input.closest('table');
    if (!table) return;

    let target: HTMLInputElement | null = null;
    const maxSteps = totalRows * totalCols + 5;

    for (let step = 1; step <= maxSteps; step += 1) {
      if (deltaRow !== 0) {
        targetRow += deltaRow;
      }
      if (deltaCol !== 0) {
        targetCol += deltaCol;
        if (targetCol >= totalCols) {
          targetCol = 0;
          targetRow += 1;
        } else if (targetCol < 0) {
          targetCol = totalCols - 1;
          targetRow -= 1;
        }
      }

      if (targetRow < 0 || targetRow >= totalRows) break;

      const candidate = table.querySelector<HTMLInputElement>(
        `input[data-mark-cell="true"][data-mark-row="${targetRow}"][data-mark-column="${targetCol}"]:not(:disabled)`,
      );

      if (candidate) {
        target = candidate;
        break;
      }
    }

    if (!target) return;
    event.preventDefault();
    target.focus();
    target.select();
  }

  const selectedCohort = session?.cohorts.find((cohort) => cohort.id === selectedCohortId) ?? null;
  const visibleFields = selectedView === 'all' ? markFields : markFields.filter((field) => field.key === selectedView);
  const isFinalSubmitted = Boolean(selectedCohort?.submittedAt || selectedCohort?.componentSubmissions.exam);
  const isCatSubmitted = Boolean(selectedCohort?.componentSubmissions.cat);
  const readOnly = Boolean(selectedCohort?.locked || isFinalSubmitted);

  const missingAssignment = students.filter((s) => s.assignment === null).length;
  const missingPresentation = students.filter((s) => s.presentation === null).length;
  const missingRat = students.filter((s) => s.rat === null).length;
  const missingCat = students.filter((s) => s.cat === null).length;
  const missingExam = students.filter((s) => s.attendanceStatus !== 'absent' && s.exam === null).length;
  const totalMissing = missingAssignment + missingPresentation + missingRat + missingCat + missingExam;

  const absentExamStudents = students.filter((s) => s.attendanceStatus === 'absent' || s.exam === null);
  const missingCourseworkCount = missingAssignment + missingPresentation + missingRat + missingCat;

  async function saveMarks(submit: boolean) {
    if (!selectedCohort) return;
    if (submit) {
      if (['assignment', 'presentation', 'rat'].includes(selectedView)) {
        setError(
          'Assignment, Presentation, and RAT marks are saved as drafts and submitted together with final exam marks at the end of the semester.',
        );
        return;
      }
      if (selectedView === 'cat') {
        if (isCatSubmitted) {
          setError('CAT marks have already been submitted.');
          return;
        }
        if (missingCat > 0) {
          setError(`Cannot submit CAT: ${missingCat} student(s) are missing CAT marks.`);
          return;
        }
      } else {
        // Final marks submission ('all' or 'exam')
        if (isFinalSubmitted) {
          setError('Final marks have already been submitted.');
          return;
        }
        if (absentExamStudents.length > 0 || missingCourseworkCount > 0) {
          setSubmitConfirmDialogOpen(true);
          return;
        }
      }
    }

    await executeTrainerSaveOrSubmit(submit);
  }

  async function executeTrainerSaveOrSubmit(submit: boolean) {
    if (!selectedCohort) return;
    setSubmitConfirmDialogOpen(false);
    setBusy(submit ? 'submit' : 'save');
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/trainer-mark-entry/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cohort_id: selectedCohort.id,
          component: submit ? (selectedView === 'cat' ? 'cat' : 'all') : selectedView,
          submit,
          entries: students.map((student) => {
            const isAbsent = student.attendanceStatus === 'absent' || student.exam === null;
            return {
              assessment_id: student.assessmentId,
              student_id: student.studentId,
              assignment: submit && student.assignment === null ? 0 : student.assignment,
              presentation: submit && student.presentation === null ? 0 : student.presentation,
              rat: submit && student.rat === null ? 0 : student.rat,
              cat: submit && student.cat === null ? 0 : student.cat,
              exam: isAbsent ? null : student.exam,
              attendance_status: isAbsent ? ('absent' as const) : ('expected' as const),
            };
          }),
        }),
      });
      const result = await response.json() as { message?: string; result?: { savedCount?: number } };
      if (!response.ok) throw new Error(result.message ?? 'Could not save marks.');
      if (submit) {
        setMessage(selectedView === 'cat' ? 'CAT marks submitted successfully.' : 'Final marks submitted successfully.');
        const refreshed = await loadSession();
        setSession(refreshed);
        const updatedCohort = refreshed.cohorts.find((cohort) => cohort.id === selectedCohort.id) ?? null;
        setStudents(updatedCohort?.students ?? []);
        setStudentsByCohort((current) => ({ ...current, [selectedCohort.id ?? 'all']: updatedCohort?.students ?? [] }));
      } else {
        setMessage(`Draft marks saved for ${selectedCohort.name} (${result.result?.savedCount ?? students.length} student records).`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save marks.');
    } finally {
      setBusy(null);
    }
  }

  const isDepartmentEntryClosed = selectedCohort
    ? selectedCohort.trainerEntryOpen === false
    : session?.trainerEntryOpen === false;

  const handleRequestEditMarks = (_targetComp: MarkView = selectedView) => {
    if (isDepartmentEntryClosed) {
      setClosedNoticeDialogOpen(true);
      return;
    }
    setRevisionReason('');
    setRevisionDialogOpen(true);
  };

  async function reopenComponent() {
    if (!selectedCohort || !revisionReason.trim()) return;
    const targetComp = selectedView === 'all' || selectedView === 'exam' ? 'all' : selectedView;
    setBusy('save');
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/trainer-mark-entry/reopen', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          component: targetComp,
          cohort_id: selectedCohort.id,
          reason: revisionReason.trim(),
        }),
      });
      const result = await response.json() as { message?: string };
      if (response.status === 403 || result.message?.toLowerCase().includes('closed')) {
        setRevisionDialogOpen(false);
        setClosedNoticeDialogOpen(true);
        return;
      }
      if (!response.ok) throw new Error(result.message ?? 'Could not unlock this component.');
      setRevisionDialogOpen(false);
      setRevisionReason('');
      setMessage(`${targetComp === 'all' ? 'Final' : markViews.find((view) => view.key === targetComp)?.label ?? targetComp} marks unlocked for revision.`);
      const refreshed = await loadSession();
      setSession(refreshed);
      const updatedCohort = refreshed.cohorts.find((cohort) => cohort.id === selectedCohort.id) ?? null;
      setStudents(updatedCohort?.students ?? []);
      setStudentsByCohort((current) => ({ ...current, [selectedCohort.id ?? 'all']: updatedCohort?.students ?? [] }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not unlock marks for revision.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-2 py-3 sm:px-5 sm:py-5">
      <div className="mx-auto max-w-7xl space-y-3">
        <header className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
          {session ? (
            <>
              <h1 className="text-base font-bold text-slate-900">{session.unit.code ? `${session.unit.code} | ` : ''}{session.unit.name}</h1>
              <p className="mt-0.5 text-xs text-slate-500">{session.academicPeriod}</p>
            </>
          ) : (
            <h1 className="text-base font-bold text-slate-900">Trainer mark entry</h1>
          )}
        </header>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600"><LoaderCircle className="size-4 animate-spin" />Opening...</div>
        ) : error && !session ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><AlertCircle className="mt-0.5 size-5 shrink-0" /><p>{error}</p></div>
        ) : session ? (
          <>
            {session.cohorts.length > 0 ? (
              <section className="rounded-xl border border-slate-200 bg-white p-2.5">
                <div className="flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label="Cohorts">
                  {session.cohorts.map((cohort) => (
                    <button key={cohort.id ?? 'all'} type="button" aria-pressed={cohort.id === selectedCohortId}
                      onClick={() => { setSelectedCohortId(cohort.id); setStudents(studentsByCohort[cohort.id ?? 'all'] ?? cohort.students); setMessage(''); setError(''); }}
                      className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${cohort.id === selectedCohortId ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                      <span>{cohort.name}</span>
                     
                    </button>
                  ))}
                </div>
              </section>
            ) : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No cohort rosters are available on this trainer link.</div>}

            {selectedCohort?.submittedAt ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">Submitted - read only</div> : null}
            {selectedCohort?.locked && !selectedCohort.submittedAt ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Entry closed</div> : null}
            {['assignment', 'presentation', 'rat'].includes(selectedView) && !readOnly ? (
              <div className="rounded-lg border border-slate-200 bg-[#fbf9f1] px-3 py-2 text-xs text-slate-700">
                Coursework marks (Assignment, Presentation, RAT) are saved as drafts and submitted together with final exam marks at the end of the semester.
              </div>
            ) : null}
            {selectedView === 'cat' && isCatSubmitted ? (
              <div className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-emerald-900">
                  <span className="font-semibold">CAT marks</span> have been submitted. Need to correct an entry?
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => handleRequestEditMarks('cat')}
                  className="h-8 shrink-0 border-amber-300 bg-amber-50 text-xs font-medium text-amber-900 hover:bg-amber-100"
                >
                  <RotateCcw className="mr-1.5 size-3.5 text-amber-700" />
                  Revise marks
                </Button>
              </div>
            ) : null}
            {(selectedView === 'all' || selectedView === 'exam') && isFinalSubmitted ? (
              <div className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-emerald-900">
                  <span className="font-semibold">Final marks</span> have been submitted. Need to correct an entry?
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => handleRequestEditMarks(selectedView)}
                  className="h-8 shrink-0 border-amber-300 bg-amber-50 text-xs font-medium text-amber-900 hover:bg-amber-100"
                >
                  <RotateCcw className="mr-1.5 size-3.5 text-amber-700" />
                  Revise marks
                </Button>
              </div>
            ) : null}

            {selectedCohort ? <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
              <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Mark fields">
                  {markViews.map((view) => {
                    const isChecked =
                      view.key === 'all' || view.key === 'exam'
                        ? isFinalSubmitted
                        : Boolean(selectedCohort?.componentSubmissions[view.key]);
                    return (
                      <button key={view.key} type="button" aria-pressed={selectedView === view.key} onClick={() => setSelectedView(view.key)}
                      className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-semibold ${selectedView === view.key ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                        {view.label}{isChecked ? ' ✓' : ''}
                      </button>
                    );
                  })}
                </div>
                {!readOnly ? (
                  <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                    <Button className="w-full sm:w-auto" type="button" variant="outline" disabled={busy !== null || students.length === 0} onClick={() => void saveMarks(false)}>
                      {busy === 'save' ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{busy === 'save' ? 'Saving...' : 'Save draft'}
                    </Button>
                    {['assignment', 'presentation', 'rat'].includes(selectedView) ? null : selectedView === 'cat' ? (
                      isCatSubmitted ? (
                        <Button
                          className="w-full sm:w-auto border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                          type="button"
                          variant="outline"
                          disabled={busy !== null}
                          onClick={() => handleRequestEditMarks('cat')}
                        >
                          <RotateCcw className="size-4 text-amber-700" />
                          Revise CAT marks
                        </Button>
                      ) : (
                        <Button className="w-full sm:w-auto" type="button" disabled={busy !== null || students.length === 0 || missingCat > 0} onClick={() => void saveMarks(true)}>
                          {busy === 'submit' ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}{busy === 'submit' ? 'Submitting...' : 'Submit CAT marks'}
                        </Button>
                      )
                    ) : isFinalSubmitted ? (
                      <Button
                        className="w-full sm:w-auto border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                        type="button"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() => handleRequestEditMarks('all')}
                      >
                        <RotateCcw className="size-4 text-amber-700" />
                        Revise Final Marks
                      </Button>
                    ) : (
                      <Button className="w-full sm:w-auto" type="button" disabled={busy !== null || students.length === 0} onClick={() => void saveMarks(true)}>
                        {busy === 'submit' ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}{busy === 'submit' ? 'Submitting...' : 'Submit Final Marks'}
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="overflow-x-auto">
                <table className={`w-full text-left text-xs ${selectedView === 'all' ? 'min-w-[640px]' : 'min-w-[320px]'} md:min-w-[980px]`}>
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <tr>
                      <th className="sticky left-0 z-30 w-[190px] min-w-[190px] bg-slate-50 px-3 py-3 shadow-[2px_0_4px_rgba(15,23,42,0.08)] md:hidden">Student</th>
                      <th className="hidden px-3 py-3 md:table-cell">No.</th>
                      <th className="hidden px-3 py-3 md:table-cell">Admission number</th>
                      <th className="hidden px-3 py-3 md:table-cell">Student</th>
                      {visibleFields.map((field) => <th key={field.key} className="px-2 py-3 text-center">{field.label}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((student, index) => (
                      <tr key={`${student.assessmentId}:${student.studentId}`} className="group hover:bg-slate-50/70">
                        <td className="sticky left-0 z-20 w-[190px] min-w-[190px] bg-white px-3 py-2.5 shadow-[2px_0_4px_rgba(15,23,42,0.08)] group-hover:bg-slate-50 md:hidden">
                          <div className="font-semibold leading-4 text-slate-800">{student.fullName}{student.attendanceStatus === 'absent' ? <span className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold text-slate-600">Absent</span> : null}</div>
                          <div className="mt-0.5 text-[10px] leading-3 text-slate-500">{student.admissionNumber}</div>
                        </td>
                        <td className="hidden px-3 py-2.5 text-slate-400 md:table-cell">{index + 1}</td>
                        <td className="hidden whitespace-nowrap px-3 py-2.5 font-medium text-slate-900 md:table-cell">{student.admissionNumber}</td>
                        <td className="hidden min-w-52 px-3 py-2.5 text-slate-800 md:table-cell">{student.fullName}{student.attendanceStatus === 'absent' ? <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Absent</span> : null}</td>
                        {visibleFields.map((field, fieldIndex) => {
                          const isAbsentExam = field.key === 'exam' && student.attendanceStatus === 'absent';
                          const displayVal = field.key === 'exam'
                            ? (student.exam !== null ? student.exam : (student.attendanceStatus === 'absent' ? 'AB' : ''))
                            : (student[field.key] ?? '');

                          return (
                            <td key={field.key} className="min-w-[92px] px-2 py-2 text-center">
                              <input
                                aria-label={`${field.label} for ${student.admissionNumber}`}
                                type="text"
                                inputMode={field.key === 'exam' ? 'text' : 'numeric'}
                                data-mark-cell="true"
                                data-mark-row={index}
                                data-mark-column={fieldIndex}
                                onKeyDown={moveMarkCell}
                                min="0"
                                max={field.maximum}
                                value={displayVal}
                                placeholder={['assignment', 'presentation', 'rat'].includes(field.key) ? '0' : isAbsentExam ? 'AB' : '—'}
                                disabled={readOnly || (field.key === 'cat' && isCatSubmitted) || (field.key === 'exam' && isFinalSubmitted)}
                                onFocus={(e) => e.currentTarget.select()}
                                onChange={(event) => updateMark(student.assessmentId, student.studentId, field.key, event.target.value)}
                                className={`h-10 w-20 rounded-md border px-2 text-center text-base tabular-nums outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 sm:h-9 sm:text-xs ${
                                  isAbsentExam
                                    ? 'border-amber-300 bg-amber-50/70 font-semibold text-amber-900'
                                    : 'border-slate-300 bg-white text-slate-900'
                                }`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section> : null}

            {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
            {message ? <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="size-4" />{message}</p> : null}

            {revisionDialogOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
                <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        Revise {selectedView === 'all' || selectedView === 'exam' ? 'Final' : markViews.find((view) => view.key === selectedView)?.label} Marks
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        State why you need to unlock these marks.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRevisionDialogOpen(false)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                      aria-label="Close modal"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="mt-4">
                    <textarea
                      id="trainer-revision-reason"
                      rows={2}
                      value={revisionReason}
                      onChange={(e) => setRevisionReason(e.target.value)}
                      placeholder="e.g. Mark correction or paper re-mark..."
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
                      autoFocus
                    />
                  </div>

                  <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => setRevisionDialogOpen(false)}
                      className="h-8.5 rounded-lg px-3 text-xs font-medium text-slate-500 hover:text-slate-900 transition"
                    >
                      Cancel
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy !== null || revisionReason.trim().length < 3}
                      onClick={() => void reopenComponent()}
                      className="h-8.5 rounded-lg bg-amber-600 px-3.5 text-xs font-medium text-white shadow-2xs hover:bg-amber-700"
                    >
                      {busy === 'save' ? <LoaderCircle className="mr-1.5 size-3.5 animate-spin" /> : null}
                      Unlock Marks
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {closedNoticeDialogOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
                <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                  <div className="flex items-start justify-between">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <Lock className="size-5" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setClosedNoticeDialogOpen(false)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                      aria-label="Close modal"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <h3 className="mt-4 text-base font-semibold text-slate-900">
                    Marks Entry Closed
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                    Marks cannot be edited because the entry period has closed. Please see your Head of Department (HoD) to request reopening.
                  </p>

                  <div className="mt-6 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setClosedNoticeDialogOpen(false)}
                      className="h-8.5 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      Understood
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {submitConfirmDialogOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
                <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        Submit Final Marks
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Please review student statuses before finalizing.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSubmitConfirmDialogOpen(false)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                      aria-label="Close modal"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {/* Absent students */}
                    {absentExamStudents.length > 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="font-semibold text-slate-900">
                            Absent from Exam ({absentExamStudents.length})
                          </span>
                          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                            Grade: AB
                          </span>
                        </div>
                        <div className="max-h-32 overflow-y-auto divide-y divide-slate-200/60 rounded-lg bg-white border border-slate-200/80 px-2.5">
                          {absentExamStudents.map((s) => (
                            <div key={s.studentId} className="flex items-center justify-between py-1.5 text-xs">
                              <span className="font-medium text-slate-800">{s.fullName}</span>
                              <span className="font-mono text-[11px] text-slate-500">{s.admissionNumber}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Unentered coursework */}
                    {missingCourseworkCount > 0 ? (
                      <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-700">
                        <span className="size-2 rounded-full bg-amber-500 shrink-0" />
                        <span>
                          <strong className="font-semibold text-slate-900">{missingCourseworkCount} unentered coursework {missingCourseworkCount === 1 ? 'mark' : 'marks'}</strong> will be recorded as <strong>0</strong>.
                        </span>
                      </div>
                    ) : null}

                    <p className="text-[11px] text-slate-400 leading-normal">
                      Marks can still be unlocked for revision while the entry window remains open.
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => setSubmitConfirmDialogOpen(false)}
                      className="h-8.5 rounded-lg px-3.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition"
                    >
                      Cancel
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => void executeTrainerSaveOrSubmit(true)}
                      className="h-8.5 rounded-lg bg-teal-700 px-4 text-xs font-medium text-white shadow-2xs hover:bg-teal-800"
                    >
                      {busy === 'submit' ? <LoaderCircle className="mr-1.5 size-3.5 animate-spin" /> : null}
                      Confirm & Submit
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
