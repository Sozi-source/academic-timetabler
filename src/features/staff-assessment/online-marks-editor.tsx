'use client';

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Save,
  Search,
  Send,
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
  calculateOnlineFinalTotal,
  calculateRatCatAverage,
  canEditOnlineMarks,
  missingOnlineComponentCount,
  onlineMarkComponents,
  parseOnlineMarkInput,
  type OnlineMarkComponentKey,
  type OnlineMarkValues,
} from './online-marks-domain';

interface StudentRow {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  attendanceStatus: 'expected' | 'absent';
  initialMarks: OnlineMarkValues;
}

type InputValues = Record<
  string,
  Record<'assignment' | 'presentation' | 'rat' | 'cat' | 'exam', string>
>;

function toInput(value: number | null): string {
  return value === null ? '' : String(value);
}

export function OnlineMarksEditor({
  assessmentId,
  workflowStatus,
  students,
}: {
  assessmentId: string;
  workflowStatus: string | null;
  students: StudentRow[];
}) {
  const router = useRouter();

  const [values, setValues] = useState<InputValues>(
    Object.fromEntries(
      students.map((student) => [
        student.studentId,
        {
          assignment: toInput(student.initialMarks.assignment),
          presentation: toInput(student.initialMarks.presentation),
          rat: toInput(student.initialMarks.rat),
          cat: toInput(student.initialMarks.cat),
          exam:
            student.attendanceStatus === 'absent'
              ? ''
              : toInput(student.initialMarks.exam),
        },
      ]),
    ),
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  const [busy, setBusy] = useState<'save' | 'submit' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibleComponent, setVisibleComponent] = useState<'all' | OnlineMarkComponentKey>('all');

  const isSingleMode = visibleComponent !== 'all';
  const singleComponent = isSingleMode
    ? onlineMarkComponents.find((c) => c.key === visibleComponent)
    : null;

  const editable = canEditOnlineMarks(workflowStatus);

  const parsedRows = useMemo(
    () =>
      students.map((student, studentIndex) => {
        const studentValues = values[student.studentId];

        const assignment = parseOnlineMarkInput(
          studentValues?.assignment ?? '',
          5,
        );

        const presentation = parseOnlineMarkInput(
          studentValues?.presentation ?? '',
          10,
        );

        const rat = parseOnlineMarkInput(studentValues?.rat ?? '', 15);

        const cat = parseOnlineMarkInput(studentValues?.cat ?? '', 15);

        const exam =
          student.attendanceStatus === 'absent'
            ? { valid: true, mark: null, message: null }
            : parseOnlineMarkInput(studentValues?.exam ?? '', 70);

        const marks: OnlineMarkValues = {
          assignment: assignment.mark,
          presentation: presentation.mark,
          rat: rat.mark,
          cat: cat.mark,
          exam: exam.mark,
        };

        return {
          studentIndex,
          student,
          marks,
          fields: {
            assignment,
            presentation,
            rat,
            cat,
            exam,
          },
          missing: missingOnlineComponentCount({
            values: marks,
            absent: student.attendanceStatus === 'absent',
          }),
          ratCatAverage: calculateRatCatAverage({
            rat: marks.rat,
            cat: marks.cat,
          }),
          total: calculateOnlineFinalTotal(
            marks,
            student.attendanceStatus === 'absent',
          ),
        };
      }),
    [students, values],
  );

  // Search Filter
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return parsedRows;
    return parsedRows.filter(
      (row) =>
        row.student.fullName.toLowerCase().includes(q) ||
        row.student.admissionNumber.toLowerCase().includes(q),
    );
  }, [parsedRows, searchQuery]);

  // Pagination Logic
  const totalItems = filteredRows.length;
  const totalPages =
    pageSize === 'all'
      ? 1
      : Math.max(1, Math.ceil(totalItems / (pageSize as number)));

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(() => {
    if (pageSize === 'all') return filteredRows;
    const size = pageSize as number;
    const start = (safeCurrentPage - 1) * size;
    return filteredRows.slice(start, start + size);
  }, [filteredRows, safeCurrentPage, pageSize]);

  const startIndex =
    pageSize === 'all'
      ? 1
      : totalItems === 0
        ? 0
        : (safeCurrentPage - 1) * (pageSize as number) + 1;

  const endIndex =
    pageSize === 'all'
      ? totalItems
      : Math.min(totalItems, safeCurrentPage * (pageSize as number));

  const invalid = parsedRows
    .flatMap((row) =>
      Object.entries(row.fields).map(([key, value]) => ({
        student: row.student,
        key,
        value,
      })),
    )
    .find((item) => !item.value.valid);

  const absent = students.filter((s) => s.attendanceStatus === 'absent').length;
  const missing = parsedRows.reduce((sum, row) => sum + row.missing, 0);

  function setField(
    studentId: string,
    key: 'assignment' | 'presentation' | 'rat' | 'cat' | 'exam',
    value: string,
  ) {
    setValues((current) => ({
      ...current,
      [studentId]: {
        ...current[studentId],
        [key]: value,
      },
    }));
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    currentIndex: number,
    componentKey: OnlineMarkComponentKey,
  ) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextInput = document.querySelector<HTMLInputElement>(
        `input[data-student-index="${currentIndex + 1}"][data-component-key="${componentKey}"]`,
      );
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  }

  async function saveDraft({ silent = false } = {}) {
    if (invalid) {
      setError(
        `${invalid.student.fullName}: ${invalid.value.message ?? 'Invalid mark.'}`,
      );
      return false;
    }

    setBusy('save');
    setError(null);
    if (!silent) setMessage(null);

    try {
      const response = await fetch(
        `/api/staff/assessment/${assessmentId}/online/save`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entries: parsedRows.map((row) => ({
              studentId: row.student.studentId,
              assignment: row.marks.assignment ?? 0,
              presentation: row.marks.presentation ?? 0,
              rat: row.marks.rat ?? 0,
              cat: row.marks.cat,
              exam:
                row.student.attendanceStatus === 'absent'
                  ? null
                  : row.marks.exam,
            })),
          }),
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? 'Draft marks could not be saved.');
        return false;
      }

      if (!silent) {
        setMessage('Draft saved.');
      }

      return true;
    } finally {
      setBusy(null);
    }
  }

  async function submitMarks() {
    if (invalid) {
      setError(
        `${invalid.student.fullName}: ${invalid.value.message ?? 'Invalid mark.'}`,
      );
      return;
    }

    if (missing > 0) {
      setError(
        `${missing} required mark${missing === 1 ? '' : 's'} remain blank.`,
      );
      return;
    }

    setBusy('submit');
    setError(null);
    setMessage(null);

    try {
      const saveResponse = await fetch(
        `/api/staff/assessment/${assessmentId}/online/save`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entries: parsedRows.map((row) => ({
              studentId: row.student.studentId,
              assignment: row.marks.assignment ?? 0,
              presentation: row.marks.presentation ?? 0,
              rat: row.marks.rat ?? 0,
              cat: row.marks.cat,
              exam:
                row.student.attendanceStatus === 'absent'
                  ? null
                  : row.marks.exam,
            })),
          }),
        },
      );

      if (!saveResponse.ok) {
        const payload = await saveResponse.json().catch(() => null);
        setError(payload?.message ?? 'Latest marks could not be saved.');
        return;
      }

      const response = await fetch(
        `/api/staff/assessment/${assessmentId}/online/submit`,
        { method: 'POST' },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? 'Marks could not be submitted.');
        return;
      }

      setMessage('Marks submitted successfully.');
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3.5 pb-24">
      {/* Sleek Compact Stats Strip */}
      <section className="flex flex-wrap items-center justify-between gap-2 rounded-none border border-slate-300 bg-[#fbf9f1] px-3.5 py-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-700">
          <span>
            <strong className="text-slate-950">{students.length}</strong> Students
          </span>
          {absent > 0 ? (
            <span className="text-amber-800">
              · <strong>{absent}</strong> Absent
            </span>
          ) : null}
        </div>
        <Badge variant="neutral" className="rounded-none border border-slate-300 bg-[#fffdf5] font-semibold text-slate-800">Scale /100</Badge>
      </section>

      {/* Mode Switcher & Search Filter */}
      <section className="space-y-2.5 rounded-none border border-slate-300 bg-[#fbf9f1] p-2.5 sm:p-3 shadow-2xs">
        {/* Component Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
          <span className="shrink-0 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
            Mode:
          </span>
          <button
            type="button"
            onClick={() => setVisibleComponent('all')}
            className={`h-8 shrink-0 rounded-none px-2.5 text-xs font-bold transition ${
              visibleComponent === 'all'
                ? 'bg-[#0b4f4a] text-white shadow-2xs'
                : 'border border-slate-300 bg-[#fffdf5] text-slate-800 hover:bg-[#f2ece0]'
            }`}
          >
            All marks
          </button>
          {onlineMarkComponents.map((component) => (
            <button
              key={component.key}
              type="button"
              onClick={() => setVisibleComponent(component.key)}
              className={`h-8 shrink-0 rounded-none px-2.5 text-xs font-bold transition ${
                visibleComponent === component.key
                  ? 'bg-[#0b4f4a] text-white shadow-2xs'
                  : 'border border-slate-300 bg-[#fffdf5] text-slate-800 hover:bg-[#f2ece0]'
              }`}
            >
              {component.label} /{component.maximum}
            </button>
          ))}
        </div>

        {/* Search Bar & Page Size Selector */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by student name or admission no..."
              className="h-8 w-full rounded-none border border-slate-300 bg-[#fffdf5] pl-8 pr-8 text-xs text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-[#0b4f4a] focus:bg-white focus:ring-2 focus:ring-[#0b4f4a]/20"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="text-[11px] font-semibold">Show:</span>
            <div className="flex items-center gap-1">
              {[10, 25, 'all'].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setPageSize(size as number | 'all');
                    setCurrentPage(1);
                  }}
                  className={`h-7 rounded-none px-2 text-[11px] font-bold transition ${
                    pageSize === size
                      ? 'bg-[#0b4f4a] text-white shadow-2xs'
                      : 'border border-slate-300 bg-[#fffdf5] text-slate-800 hover:bg-[#f2ece0]'
                  }`}
                >
                  {size === 'all' ? 'All' : size}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Table / List View */}
      {isSingleMode && singleComponent ? (
        /* SINGLE ENTRY MODE: Guaranteed 100% visible on all mobile screens without truncation */
        <section className="overflow-hidden rounded-none border border-slate-300 bg-[#fffdf5] shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-300 bg-[#f2ece0] px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-800">
            <span>Student</span>
            <span className="shrink-0 text-right">
              {singleComponent.label} /{singleComponent.maximum}
            </span>
          </div>

          {paginatedRows.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-500">
              No students match "{searchQuery}"
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {paginatedRows.map((row) => {
                const key = singleComponent.key;
                const field = row.fields[key];
                const isExamAbsent =
                  key === 'exam' && row.student.attendanceStatus === 'absent';

                return (
                  <div
                    key={row.student.studentId}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition hover:bg-[#fbf9f1]"
                  >
                    {/* Left: Student Name & ID */}
                    <div className="min-w-0 flex-1 pr-1">
                      <p className="text-xs font-bold text-slate-900 leading-tight truncate">
                        {row.student.fullName}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-slate-600">
                        <span>{row.student.admissionNumber}</span>
                        {row.total !== null ? (
                          <span className="font-bold text-[#0b4f4a]">
                            · {row.total.toFixed(1)}/100
                          </span>
                        ) : null}
                      </div>
                      {isExamAbsent ? (
                        <Badge variant="warning" className="mt-0.5 rounded-none text-[9px] py-0 px-1">
                          Absent
                        </Badge>
                      ) : null}
                    </div>

                    {/* Right: Input box (shrink-0, fixed width w-20, NEVER truncated) */}
                    <div className="shrink-0">
                      {isExamAbsent ? (
                        <div className="flex h-10 w-20 items-center justify-center rounded-none border border-slate-300 bg-[#eee8d7] text-xs font-bold text-slate-700">
                          AB
                        </div>
                      ) : (
                        <div>
                          <input
                            data-student-index={row.studentIndex}
                            data-component-key={key}
                            value={values[row.student.studentId]?.[key] ?? ''}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            placeholder={
                              ['assignment', 'presentation', 'rat'].includes(key)
                                ? '0'
                                : '—'
                            }
                            disabled={!editable || busy !== null}
                            onChange={(event) =>
                              setField(
                                row.student.studentId,
                                key,
                                event.target.value,
                              )
                            }
                            onKeyDown={(e) =>
                              handleKeyDown(e, row.studentIndex, key)
                            }
                            aria-label={`${key} mark for ${row.student.fullName}`}
                            className={`h-10 w-20 rounded-none border bg-[#fffdf5] px-2 text-center text-base font-bold text-slate-900 outline-none transition focus:border-[#0b4f4a] focus:ring-2 focus:ring-[#0b4f4a]/20 disabled:bg-[#eee8d7] disabled:text-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                              field.valid
                                ? 'border-slate-400 focus:border-[#0b4f4a]'
                                : 'border-red-600 focus:ring-red-600/20'
                            }`}
                          />
                          {!field.valid ? (
                            <p className="mt-0.5 text-right text-[9px] font-semibold text-red-600">
                              {field.message}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        /* ALL MARKS MODE: Full scrollable spreadsheet table */
        <section className="overflow-x-auto rounded-none border border-slate-300 bg-[#fffdf5] shadow-2xs">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="bg-[#f2ece0] border-b border-slate-300 text-[10px] font-bold uppercase tracking-wide text-slate-800">
              <tr>
                <th className="px-3 py-2.5">Student</th>
                {onlineMarkComponents.map((c) => (
                  <th key={c.key} className="px-2 py-2.5 text-center">
                    {c.label} /{c.maximum}
                  </th>
                ))}
                <th className="px-2 py-2.5 text-center">RAT/CAT /15</th>
                <th className="px-3 py-2.5 text-center">Total /100</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-xs text-slate-500"
                  >
                    No students match "{searchQuery}"
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => (
                  <tr
                    key={row.student.studentId}
                    className="align-middle transition hover:bg-[#fbf9f1]"
                  >
                    <td className="px-3 py-2.5">
                      <p className="text-xs font-bold text-slate-900 line-clamp-1">
                        {row.student.fullName}
                      </p>
                      <p className="text-[10px] font-medium text-slate-600">
                        {row.student.admissionNumber}
                      </p>
                      {row.student.attendanceStatus === 'absent' ? (
                        <Badge variant="warning" className="mt-0.5 rounded-none text-[9px]">
                          Exam absent
                        </Badge>
                      ) : null}
                    </td>

                    {onlineMarkComponents.map(({ key }) => {
                      const field = row.fields[key];
                      const examAbsent =
                        key === 'exam' && row.student.attendanceStatus === 'absent';

                      return (
                        <td key={key} className="px-1.5 py-2.5">
                          {examAbsent ? (
                            <div className="mx-auto flex h-9 w-16 items-center justify-center rounded-none border border-slate-300 bg-[#eee8d7] text-xs font-bold text-slate-700">
                              AB
                            </div>
                          ) : (
                            <div className="mx-auto w-16">
                              <input
                                data-student-index={row.studentIndex}
                                data-component-key={key}
                                value={values[row.student.studentId]?.[key] ?? ''}
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck={false}
                                placeholder={
                                  ['assignment', 'presentation', 'rat'].includes(key)
                                    ? '0'
                                    : '—'
                                }
                                disabled={!editable || busy !== null}
                                onChange={(event) =>
                                  setField(
                                    row.student.studentId,
                                    key,
                                    event.target.value,
                                  )
                                }
                                onKeyDown={(e) =>
                                  handleKeyDown(e, row.studentIndex, key)
                                }
                                aria-label={`${key} mark for ${row.student.fullName}`}
                                className={`h-9 w-full rounded-none border bg-[#fffdf5] px-1 text-center text-xs font-bold text-slate-900 outline-none transition focus:border-[#0b4f4a] focus:ring-2 focus:ring-[#0b4f4a]/20 disabled:bg-[#eee8d7] disabled:text-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                  field.valid
                                    ? 'border-slate-400 focus:border-[#0b4f4a]'
                                    : 'border-red-600 focus:ring-red-600/20'
                                }`}
                              />
                              {!field.valid ? (
                                <p className="mt-0.5 text-center text-[9px] font-semibold text-red-600">
                                  {field.message}
                                </p>
                              ) : null}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-2 py-2.5 text-center text-xs font-bold text-slate-700">
                      {row.ratCatAverage === null
                        ? '—'
                        : row.ratCatAverage.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-center text-sm font-extrabold text-slate-950">
                      {row.student.attendanceStatus === 'absent'
                        ? 'AB'
                        : row.total === null
                          ? '—'
                          : row.total.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* Pagination Strip */}
      {totalItems > 0 && pageSize !== 'all' && totalPages > 1 ? (
        <section className="flex flex-wrap items-center justify-between gap-2 rounded-none border border-slate-300 bg-[#fbf9f1] px-3.5 py-2.5 text-xs text-slate-700 shadow-2xs">
          <span className="text-[11px] font-semibold">
            Showing <strong className="text-slate-950">{startIndex}–{endIndex}</strong> of <strong className="text-slate-950">{totalItems}</strong> students
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-8 items-center gap-1 rounded-none border border-slate-300 bg-[#fffdf5] px-2.5 text-xs font-bold text-slate-800 transition hover:bg-[#f2ece0] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" />
              <span>Prev</span>
            </button>

            <span className="px-2 text-[11px] font-bold text-slate-900">
              {safeCurrentPage} / {totalPages}
            </span>

            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex h-8 items-center gap-1 rounded-none border border-slate-300 bg-[#fffdf5] px-2.5 text-xs font-bold text-slate-800 transition hover:bg-[#f2ece0] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </section>
      ) : null}

      {/* Helper Note */}
      <p className="text-[10px] leading-4 text-text-muted">
        Missed Assignment, Presentation, or RAT default to 0. Press <strong>Enter</strong> on
        your keyboard to jump directly to the next student.
      </p>

      {/* Feedback Messages */}
      {error ? (
        <p className="rounded-lg border border-danger-border bg-danger-surface px-3 py-2.5 text-[11px] text-danger">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-success">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          {message}
        </p>
      ) : null}

      {/* Action Buttons */}
      {editable ? (
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => void saveDraft()}
            leadingIcon={
              busy === 'save' ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )
            }
          >
            Save draft
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={busy !== null || missing > 0 || Boolean(invalid)}
            onClick={() => void submitMarks()}
            leadingIcon={
              busy === 'submit' ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
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
