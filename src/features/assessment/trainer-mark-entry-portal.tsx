'use client';

import { AlertCircle, CheckCircle2, LoaderCircle, Save, Send } from 'lucide-react';
import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import type { TrainerMarkEntryRow } from './trainer-mark-entry-types';

interface TrainerMarkSession {
  trainerName: string;
  trainerEmail: string | null;
  expiresAt: string;
  submittedAt: string | null;
  locked: boolean;
  unit: { code: string | null; name: string };
  academicPeriod: string;
  cohorts: Array<{
    id: string | null;
    name: string;
    students: TrainerMarkEntryRow[];
    submittedAt: string | null;
    locked: boolean;
  }>;
}

type MarkField = 'assignment' | 'presentation' | 'rat' | 'cat' | 'exam';
type MarkView = 'all' | Exclude<MarkField, 'exam'>;

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
    const maximum = markFields.find((markField) => markField.key === field)?.maximum ?? 0;
    const wholeNumber = value === '' ? null : Math.min(Number(value.replace(/\D/g, '')), maximum);
    const update = (current: TrainerMarkEntryRow[]) => current.map((student) => (
      student.assessmentId === assessmentId && student.studentId === studentId
        ? { ...student, [field]: wholeNumber }
        : student
    ));
    setStudents((current) => update(current));
    const cohortKey = selectedCohortId ?? 'all';
    setStudentsByCohort((current) => ({ ...current, [cohortKey]: update(current[cohortKey] ?? []) }));
  }

  function moveMarkCell(event: KeyboardEvent<HTMLInputElement>) {
    const directions: Record<string, { row: number; column: number }> = {
      ArrowLeft: { row: 0, column: -1 }, ArrowRight: { row: 0, column: 1 },
      ArrowUp: { row: -1, column: 0 }, ArrowDown: { row: 1, column: 0 },
    };
    const direction = directions[event.key];
    if (!direction) return;
    const inputs = Array.from(event.currentTarget.closest('table')?.querySelectorAll<HTMLInputElement>('input[data-mark-cell="true"]') ?? []);
    const visibleFields = selectedView === 'all' ? markFields : markFields.filter((field) => field.key === selectedView);
    const currentRow = Number(event.currentTarget.dataset.markRow);
    const currentColumn = Number(event.currentTarget.dataset.markColumn);
    let target: HTMLInputElement | undefined;
    for (let distance = 1; distance <= students.length; distance += 1) {
      const row = currentRow + direction.row * distance;
      const column = currentColumn + direction.column * distance;
      if (row < 0 || row >= students.length || column < 0 || column >= visibleFields.length) break;
      target = inputs.find((input) => Number(input.dataset.markRow) === row && Number(input.dataset.markColumn) === column);
      if (target) break;
    }
    if (!target) return;
    event.preventDefault();
    target.focus();
    target.select();
  }

  const selectedCohort = session?.cohorts.find((cohort) => cohort.id === selectedCohortId) ?? null;
  const visibleFields = selectedView === 'all' ? markFields : markFields.filter((field) => field.key === selectedView);
  const readOnly = Boolean(selectedCohort?.submittedAt || selectedCohort?.locked);

  async function saveMarks(submit: boolean) {
    if (!selectedCohort) return;
    setBusy(submit ? 'submit' : 'save');
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/trainer-mark-entry/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cohort_id: selectedCohort.id,
          submit,
          entries: students.map((student) => ({
            assessment_id: student.assessmentId,
            student_id: student.studentId,
            assignment: student.assignment,
            presentation: student.presentation,
            rat: student.rat,
            cat: student.cat,
            exam: student.exam,
          })),
        }),
      });
      const result = await response.json() as { message?: string; result?: { savedCount?: number } };
      if (!response.ok) throw new Error(result.message ?? 'Could not save marks.');
      if (submit) {
        setMessage(`Marks for ${selectedCohort.name} were submitted to the HOD for review.`);
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

            {selectedCohort ? <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
              <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Mark fields">
                  {markViews.map((view) => (
                    <button key={view.key} type="button" role="tab" aria-selected={selectedView === view.key} onClick={() => setSelectedView(view.key)}
                      className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-semibold ${selectedView === view.key ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                      {view.label}
                    </button>
                  ))}
                </div>
                {!readOnly ? (
                  <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                    <Button className="w-full sm:w-auto" type="button" variant="outline" disabled={busy !== null || students.length === 0} onClick={() => void saveMarks(false)}>
                      {busy === 'save' ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{busy === 'save' ? 'Saving...' : 'Save draft'}
                    </Button>
                    <Button className="w-full sm:w-auto" type="button" disabled={busy !== null || students.length === 0} onClick={() => void saveMarks(true)}>
                      {busy === 'submit' ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}{busy === 'submit' ? 'Submitting...' : 'Submit to HOD'}
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <tr>
                      <th className="px-3 py-3">No.</th>
                      <th className="px-3 py-3">Admission number</th>
                      <th className="px-3 py-3">Student</th>
                      {visibleFields.map((field) => <th key={field.key} className="px-2 py-3 text-center">{field.label}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((student, index) => (
                      <tr key={`${student.assessmentId}:${student.studentId}`} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2.5 text-slate-400">{index + 1}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-900">{student.admissionNumber}</td>
                        <td className="min-w-52 px-3 py-2.5 text-slate-800">{student.fullName}{student.attendanceStatus === 'absent' ? <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Absent</span> : null}</td>
                        {visibleFields.map((field, fieldIndex) => (
                          <td key={field.key} className="px-2 py-2 text-center">
                            {field.key === 'exam' && student.attendanceStatus === 'absent' ? (
                              <span className="text-xs font-semibold text-slate-500">AB</span>
                            ) : (
                              <input
                                aria-label={`${field.label} for ${student.admissionNumber}`}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                data-mark-cell="true"
                                data-mark-row={index}
                                data-mark-column={fieldIndex}
                                onKeyDown={moveMarkCell}
                                min="0"
                                max={field.maximum}
                                value={student[field.key] ?? ''}
                                disabled={readOnly}
                                onChange={(event) => updateMark(student.assessmentId, student.studentId, field.key, event.target.value)}
                                className="h-10 w-20 rounded-md border border-slate-300 bg-white px-2 text-center text-base tabular-nums outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 sm:h-9 sm:text-xs"
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section> : null}

            {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
            {message ? <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="size-4" />{message}</p> : null}

          </>
        ) : null}
      </div>
    </main>
  );
}
