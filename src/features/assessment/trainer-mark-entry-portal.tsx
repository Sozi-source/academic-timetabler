'use client';

import { AlertCircle, CheckCircle2, LoaderCircle, Save, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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
  students: TrainerMarkEntryRow[];
}

type MarkField = 'assignment' | 'presentation' | 'rat' | 'cat' | 'exam';

const markFields: Array<{ key: MarkField; label: string; maximum: number }> = [
  { key: 'assignment', label: 'Assignment /5', maximum: 5 },
  { key: 'presentation', label: 'Presentation /10', maximum: 10 },
  { key: 'rat', label: 'RAT /15', maximum: 15 },
  { key: 'cat', label: 'CAT /15', maximum: 15 },
  { key: 'exam', label: 'Exam /70', maximum: 70 },
];

export function TrainerMarkEntryPortal() {
  const [session, setSession] = useState<TrainerMarkSession | null>(null);
  const [students, setStudents] = useState<TrainerMarkEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'save' | 'submit' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadSession = useCallback(async () => {
    const response = await fetch('/api/trainer-mark-entry/session', { cache: 'no-store' });
    const result = await response.json() as TrainerMarkSession & { message?: string };
    if (!response.ok) throw new Error(result.message ?? 'Could not load this markbook.');
    setSession(result);
    setStudents(result.students);
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
      await loadSession();
    }

    void connect()
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not open this trainer link.'))
      .finally(() => setLoading(false));
  }, [loadSession]);

  function updateMark(studentId: string, field: MarkField, value: string) {
    setStudents((current) => current.map((student) => (
      student.studentId === studentId
        ? { ...student, [field]: value === '' ? null : Number(value) }
        : student
    )));
  }

  async function saveMarks(submit: boolean) {
    setBusy(submit ? 'submit' : 'save');
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/trainer-mark-entry/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          submit,
          entries: students.map((student) => ({
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
        setMessage('Marks submitted to the HOD for review. This link is now read-only.');
        await loadSession();
      } else {
        setMessage(`Draft marks saved for ${result.result?.savedCount ?? students.length} students.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save marks.');
    } finally {
      setBusy(null);
    }
  }

  const readOnly = Boolean(session?.submittedAt || session?.locked);
  const expiresLabel = session ? new Date(session.expiresAt).toLocaleString() : '';

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Academic Planner · Trainer access</p>
          {session ? (
            <>
              <h1 className="mt-2 text-xl font-bold text-slate-900">{session.unit.code ? `${session.unit.code} · ` : ''}{session.unit.name}</h1>
              <p className="mt-1 text-sm text-slate-600">{session.academicPeriod} · Mark entry for {session.trainerName}</p>
              <p className="mt-2 text-xs text-slate-500">Link expires {expiresLabel}. Marks remain drafts until the HOD reviews them.</p>
            </>
          ) : (
            <h1 className="mt-2 text-xl font-bold text-slate-900">Trainer mark entry</h1>
          )}
        </header>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-12 text-sm text-slate-600"><LoaderCircle className="size-4 animate-spin" />Opening your markbook...</div>
        ) : error && !session ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><AlertCircle className="mt-0.5 size-5 shrink-0" /><p>{error}</p></div>
        ) : session ? (
          <>
            {session.submittedAt ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Submitted {new Date(session.submittedAt).toLocaleString()}. Your markbook is read-only while the HOD reviews it.</div> : null}
            {session.locked && !session.submittedAt ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This markbook is closed and no longer accepts edits.</div> : null}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Registered candidates ({students.length})</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Enter marks within each component limit. Exam is fixed as AB for absent students.</p>
                </div>
                {!readOnly ? (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" disabled={busy !== null || students.length === 0} onClick={() => void saveMarks(false)}>
                      {busy === 'save' ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{busy === 'save' ? 'Saving...' : 'Save draft'}
                    </Button>
                    <Button type="button" disabled={busy !== null || students.length === 0} onClick={() => void saveMarks(true)}>
                      {busy === 'submit' ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}{busy === 'submit' ? 'Submitting...' : 'Submit to HOD'}
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <tr>
                      <th className="px-3 py-3">No.</th>
                      <th className="px-3 py-3">Admission number</th>
                      <th className="px-3 py-3">Student</th>
                      {markFields.map((field) => <th key={field.key} className="px-2 py-3 text-center">{field.label}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((student, index) => (
                      <tr key={student.studentId} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2.5 text-slate-400">{index + 1}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-900">{student.admissionNumber}</td>
                        <td className="min-w-52 px-3 py-2.5 text-slate-800">{student.fullName}{student.attendanceStatus === 'absent' ? <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Absent</span> : null}</td>
                        {markFields.map((field) => (
                          <td key={field.key} className="px-2 py-2 text-center">
                            {field.key === 'exam' && student.attendanceStatus === 'absent' ? (
                              <span className="text-xs font-semibold text-slate-500">AB</span>
                            ) : (
                              <input
                                aria-label={`${field.label} for ${student.admissionNumber}`}
                                type="number"
                                min="0"
                                max={field.maximum}
                                step="0.01"
                                value={student[field.key] ?? ''}
                                disabled={readOnly}
                                onChange={(event) => updateMark(student.studentId, field.key, event.target.value)}
                                className="h-8 w-20 rounded-md border border-slate-300 bg-white px-2 text-center text-xs disabled:bg-slate-100"
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
            {message ? <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="size-4" />{message}</p> : null}

            {!readOnly ? (
              <div className="flex justify-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <Button type="button" variant="outline" disabled={busy !== null || students.length === 0} onClick={() => void saveMarks(false)}><Save className="size-4" />Save draft</Button>
                <Button type="button" disabled={busy !== null || students.length === 0} onClick={() => void saveMarks(true)}><Send className="size-4" />Submit to HOD</Button>
              </div>
            ) : null}
          </>
        ) : null}
        <p className="text-center text-[11px] text-slate-400">This link only grants access to the markbook assigned by your HOD.</p>
      </div>
    </main>
  );
}
