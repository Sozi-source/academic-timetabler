'use client';

import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  LoaderCircle,
  Lock,
  RotateCcw,
  Save,
  Search,
  Send,
  Upload,
  X,
} from 'lucide-react';
import {
  useEffect,
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
  BulkUploadDialog,
} from '@/features/assessment/marks/bulk-upload-dialog';
import type {
  MatchedBulkStudentResult,
} from '@/features/assessment/marks/bulk-upload-parser';

import {
  calculateOnlineFinalTotal,
  calculateRatCatAverage,
  canEditOnlineMarks,
  formatUnfilledColumnsMessage,
  getUnfilledColumnsSummary,
  missingOnlineComponentCount,
  onlineMarkComponents,
  parseOnlineMarkInput,
  type OnlineMarkComponentKey,
  type OnlineMarkValues,
  type ParsedOnlineMarkInput,
} from './online-marks-domain';

interface StudentRow {
  studentId: string;
  cohortId: string | null;
  admissionNumber: string;
  fullName: string;
  cohortName?: string;
  attendanceStatus: 'expected' | 'absent';
  initialMarks: OnlineMarkValues;
}

interface ComponentSubmission {
  cohortId: string | null;
  component: string;
  submittedAt: string;
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
  trainerEntryOpen,
  workflowStatus,
  componentSubmissions,
  students,
  showStudentCohort = false,
}: {
  assessmentId: string;
  trainerEntryOpen: boolean;
  workflowStatus: string | null;
  componentSubmissions: ComponentSubmission[];
  students: StudentRow[];
  showStudentCohort?: boolean;
}) {
  const router = useRouter();

  const [values, setValues] = useState<InputValues>(() =>
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
              ? (student.initialMarks.exam !== null ? toInput(student.initialMarks.exam) : 'AB')
              : toInput(student.initialMarks.exam),
        },
      ]),
    ),
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  const [busy, setBusy] = useState<'save' | 'submit' | 'download' | 'reopen' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibleComponent, setVisibleComponent] = useState<'all' | OnlineMarkComponentKey>('all');
  const [submissions, setSubmissions] = useState<ComponentSubmission[]>(componentSubmissions);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [closedNoticeDialogOpen, setClosedNoticeDialogOpen] = useState(false);
  const [submitConfirmDialogOpen, setSubmitConfirmDialogOpen] = useState(false);

  const handleRequestEditMarks = () => {
    if (!trainerEntryOpen) {
      setClosedNoticeDialogOpen(true);
      return;
    }
    setRevisionReason('');
    setRevisionDialogOpen(true);
  };

  useEffect(() => {
    setSubmissions(componentSubmissions);
  }, [componentSubmissions]);

  // Callback invoked by BulkUploadDialog: merges spreadsheet data into editor state
  const applyBulkMarks = (matched: MatchedBulkStudentResult[]) => {
    setValues((prev) => {
      const next = { ...prev };
      for (const m of matched) {
        if (!next[m.studentId]) continue;
        next[m.studentId] = {
          assignment: m.assignment !== null ? String(m.assignment) : '',
          presentation: m.presentation !== null ? String(m.presentation) : '',
          rat: m.rat !== null ? String(m.rat) : '',
          cat: m.cat !== null ? String(m.cat) : '',
          exam: m.attendanceStatus === 'absent' ? 'AB' : m.exam !== null ? String(m.exam) : '',
        };
      }
      return next;
    });
    setMessage(`Bulk upload applied for ${matched.length} student(s). Review and save when ready.`);
  };

  const editable = trainerEntryOpen && canEditOnlineMarks(workflowStatus);

  const isSingleMode = visibleComponent !== 'all';
  const singleComponent = isSingleMode
    ? onlineMarkComponents.find((c) => c.key === visibleComponent)
    : null;

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

        const examParsed = parseOnlineMarkInput(
          studentValues?.exam ?? '',
          70,
          true,
        );

        const isAbsent = examParsed.mark !== null
          ? false
          : Boolean(
              examParsed.isAbsent ||
              student.attendanceStatus === 'absent' ||
              studentValues?.exam?.trim().toUpperCase() === 'AB'
            );

        const exam: ParsedOnlineMarkInput = {
          ...examParsed,
          isAbsent,
        };

        const marks: OnlineMarkValues = {
          assignment: assignment.mark,
          presentation: presentation.mark,
          rat: rat.mark,
          cat: cat.mark,
          exam: isAbsent ? null : exam.mark,
        };

        return {
          studentIndex,
          student,
          marks,
          isAbsent,
          fields: {
            assignment,
            presentation,
            rat,
            cat,
            exam,
          },
          missing: missingOnlineComponentCount({
            values: marks,
            absent: isAbsent,
          }),
          ratCatAverage: calculateRatCatAverage({
            rat: marks.rat,
            cat: marks.cat,
          }),
          total: calculateOnlineFinalTotal(
            marks,
            isAbsent,
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
        row.student.admissionNumber.toLowerCase().includes(q) ||
        (row.student.cohortName && row.student.cohortName.toLowerCase().includes(q)),
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

  function componentIsSubmitted(component: OnlineMarkComponentKey, cohortId: string | null) {
    return submissions.some((submission) =>
      submission.component === component && (cohortId === null || submission.cohortId === cohortId),
    );
  }

  function componentSubmittedForAllStudents(component: OnlineMarkComponentKey) {
    return students.length > 0 && students.every((student) => componentIsSubmitted(component, student.cohortId));
  }

  const unfilledSummary = useMemo(
    () => getUnfilledColumnsSummary(parsedRows),
    [parsedRows],
  );

  const catSubmitted = componentSubmittedForAllStudents('cat');
  const finalSubmitted = componentSubmittedForAllStudents('exam') || !editable;

  const selectedComponentAlreadyComplete =
    visibleComponent === 'cat'
      ? catSubmitted
      : visibleComponent === 'all' || visibleComponent === 'exam'
        ? finalSubmitted
        : componentSubmittedForAllStudents(visibleComponent);

  const invalidForSelectedComponent = visibleComponent === 'all'
    ? invalid
    : parsedRows
      .map((row) => ({ student: row.student, value: row.fields[visibleComponent], isAbsent: row.isAbsent }))
      .find((row) => !row.value.valid && !(visibleComponent === 'exam' && row.isAbsent));

  const absent = parsedRows.filter((row) => row.isAbsent).length;
  const missing = parsedRows.reduce((sum, row) => sum + row.missing, 0);

  const absentExamStudents = useMemo(
    () => parsedRows.filter((row) => row.isAbsent || row.marks.exam === null),
    [parsedRows],
  );

  const missingCourseworkCount =
    unfilledSummary.missingAssignment +
    unfilledSummary.missingPresentation +
    unfilledSummary.missingRat +
    unfilledSummary.missingCat;

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
    currentRow: number,
    currentCol: number,
  ) {
    const input = e.currentTarget;
    const key = e.key;

    let deltaRow = 0;
    let deltaCol = 0;

    if (key === 'ArrowDown') {
      deltaRow = 1;
    } else if (key === 'ArrowUp') {
      deltaRow = -1;
    } else if (key === 'Enter') {
      deltaRow = e.shiftKey ? -1 : 1;
    } else if (key === 'Tab') {
      deltaCol = e.shiftKey ? -1 : 1;
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

    const container = input.closest('section') || document;
    const totalCols = isSingleMode ? 1 : onlineMarkComponents.length;
    const totalRows = paginatedRows.length;

    let targetRow = currentRow;
    let targetCol = currentCol;
    let foundTarget: HTMLInputElement | null = null;

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

      const candidate = container.querySelector<HTMLInputElement>(
        `input[data-mark-cell="true"][data-mark-row="${targetRow}"][data-mark-col="${targetCol}"]:not(:disabled)`,
      );

      if (candidate) {
        foundTarget = candidate;
        break;
      }
    }

    if (foundTarget) {
      e.preventDefault();
      foundTarget.focus();
      foundTarget.select();
    }
  }

  async function saveDraft({ silent = false } = {}) {
    const invalidToSave = invalidForSelectedComponent;
    if (invalidToSave) {
      setError(
        `${invalidToSave.student.fullName}: ${invalidToSave.value.message ?? 'Invalid mark.'}`,
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
            component: visibleComponent,
            entries: parsedRows.map((row) => ({
              studentId: row.student.studentId,
              assignment: row.marks.assignment,
              presentation: row.marks.presentation,
              rat: row.marks.rat,
              cat: row.marks.cat,
              exam:
                row.isAbsent
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
    if (['assignment', 'presentation', 'rat'].includes(visibleComponent)) {
      setError(
        'Assignment, Presentation, and RAT marks are saved as drafts and submitted together with final exam marks at the end of the semester.',
      );
      return;
    }

    if (visibleComponent === 'cat') {
      if (catSubmitted) {
        setError('CAT marks have already been submitted.');
        return;
      }
      if (invalidForSelectedComponent) {
        setError(
          `${invalidForSelectedComponent.student.fullName}: ${invalidForSelectedComponent.value.message ?? 'Invalid mark.'}`,
        );
        return;
      }
      if (unfilledSummary.missingCat > 0) {
        setError(`Cannot submit CAT: ${unfilledSummary.missingCat} student(s) are missing CAT marks.`);
        return;
      }

      setBusy('submit');
      setError(null);
      setMessage(null);

      try {
        const response = await fetch(
          `/api/staff/assessment/${assessmentId}/online/submit`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              component: 'cat',
              entries: parsedRows.map((row) => ({
                studentId: row.student.studentId,
                assignment: row.marks.assignment,
                presentation: row.marks.presentation,
                rat: row.marks.rat,
                cat: row.marks.cat,
                exam: row.isAbsent ? null : row.marks.exam,
                attendanceStatus: row.isAbsent ? 'absent' : 'expected',
              })),
            }),
          },
        );

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          setError(payload?.message ?? 'CAT marks could not be submitted.');
          return;
        }

        setSubmissions((current) => [
          ...current.filter((s) => s.component !== 'cat'),
          { component: 'cat', cohortId: null, submittedAt: new Date().toISOString() },
        ]);
        setMessage('CAT marks submitted successfully.');
        router.refresh();
      } finally {
        setBusy(null);
      }
      return;
    }

    // Milestone 2: Final marks submission ('all' or 'exam')
    if (finalSubmitted) {
      setError('Final marks have already been submitted.');
      return;
    }
    if (invalid) {
      setError(
        `${invalid.student.fullName}: ${invalid.value.message ?? 'Invalid mark.'}`,
      );
      return;
    }

    if (absentExamStudents.length > 0 || missingCourseworkCount > 0) {
      setSubmitConfirmDialogOpen(true);
      return;
    }

    await executeFinalSubmit();
  }

  async function executeFinalSubmit() {
    setSubmitConfirmDialogOpen(false);
    setBusy('submit');
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/staff/assessment/${assessmentId}/online/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            component: 'all',
            entries: parsedRows.map((row) => {
              const isAbsent = row.isAbsent || row.marks.exam === null;
              return {
                studentId: row.student.studentId,
                assignment: row.marks.assignment ?? 0,
                presentation: row.marks.presentation ?? 0,
                rat: row.marks.rat ?? 0,
                cat: row.marks.cat ?? 0,
                exam: isAbsent ? null : row.marks.exam,
                attendanceStatus: isAbsent ? 'absent' : 'expected',
              };
            }),
          }),
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? 'Final marks could not be submitted.');
        return;
      }

      const allComps = ['assignment', 'presentation', 'rat', 'cat', 'exam'];
      const now = new Date().toISOString();
      setSubmissions(allComps.map((comp) => ({ component: comp, cohortId: null, submittedAt: now })));
      setMessage('Final marks submitted and markbook finalized successfully.');
      router.refresh();
    } catch {
      setError('Failed to submit final marks.');
    } finally {
      setBusy(null);
    }
  }

  async function reopenComponent() {
    const targetComp = visibleComponent === 'all' || visibleComponent === 'exam' ? 'all' : visibleComponent;
    if (!revisionReason.trim()) return;
    setBusy('reopen');
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/staff/assessment/${assessmentId}/online/reopen`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            component: targetComp,
            reason: revisionReason.trim(),
          }),
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 403 || payload?.message?.toLowerCase().includes('closed')) {
          setRevisionDialogOpen(false);
          setClosedNoticeDialogOpen(true);
          return;
        }
        setError(payload?.message ?? 'Marks could not be unlocked.');
        return;
      }

      if (targetComp === 'all') {
        setSubmissions([]);
      } else {
        setSubmissions((current) =>
          current.filter((sub) => sub.component !== targetComp),
        );
      }
      setRevisionDialogOpen(false);
      setRevisionReason('');
      setMessage(`${targetComp === 'all' ? 'Final' : singleComponent?.label ?? targetComp} marks unlocked for revision. You can now edit and re-save or re-submit.`);
      router.refresh();
    } catch {
      setError('Failed to unlock component marks.');
    } finally {
      setBusy(null);
    }
  }

  async function downloadExcel() {
    setBusy('download');
    setError(null);
    try {
      if (editable && !(visibleComponent === 'all' ? invalid : invalidForSelectedComponent)) {
        await saveDraft({ silent: true });
      }

      const response = await fetch(
        `/api/staff/assessment/${assessmentId}/markbook`,
        { method: 'POST' },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.message ?? 'Excel marksheet could not be generated.');
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition');
      const filenameMatch = disposition?.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
      const filename = filenameMatch?.[1]
        ? decodeURIComponent(filenameMatch[1])
        : (filenameMatch?.[2] ?? 'Unit Marksheet.xlsx');

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download Excel marksheet.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={`space-y-3.5 pb-24${showStudentCohort ? '' : ' external-marks-editor'}`}>
      {!trainerEntryOpen ? (
        <section className="rounded-xl border border-warning-border bg-warning-surface px-4 py-3 text-xs font-semibold text-warning-ink">
          Mark entry is locked by the department.
        </section>
      ) : null}
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
        <div className="flex items-center gap-2">
          <Badge variant="neutral" className="rounded-none border border-slate-300 bg-[#fffdf5] font-semibold text-slate-800">Scale /100</Badge>
          {editable ? (
            <BulkUploadDialog
              assessmentId={assessmentId}
              mode="staff"
              onAppliedToEditor={applyBulkMarks}
              onSaveSuccess={() => router.refresh()}
              trigger={
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-none border border-slate-300 bg-[#fffdf5] px-2.5 text-xs font-bold text-slate-800 transition hover:bg-[#f2ece0]"
                >
                  <Upload className="size-3.5 text-slate-500" />
                  <span>Bulk Upload</span>
                </button>
              }
            />
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => void downloadExcel()}
            leadingIcon={
              busy === 'download' ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )
            }
          >
            Export Excel
          </Button>
        </div>
      </section>

      {/* Mode Switcher & Search Filter */}
      <section className="space-y-2.5 rounded-none border border-slate-300 bg-[#fbf9f1] p-2.5 sm:p-3 shadow-2xs">
        {/* Component Tabs */}
        <div className="space-y-2 pb-0.5">
          <span className="block px-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">
            Mode:
          </span>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:flex lg:flex-wrap">
          <button
            type="button"
            onClick={() => setVisibleComponent('all')}
            className={`min-h-9 w-full rounded-none px-1.5 text-[11px] font-bold leading-4 transition lg:min-h-8 lg:w-auto lg:px-2.5 ${
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
              className={`min-h-9 w-full rounded-none px-1.5 text-[11px] font-bold leading-4 transition lg:min-h-8 lg:w-auto lg:px-2.5 ${
                visibleComponent === component.key
                  ? 'bg-[#0b4f4a] text-white shadow-2xs'
                  : 'border border-slate-300 bg-[#fffdf5] text-slate-800 hover:bg-[#f2ece0]'
              }`}
            >
            {component.label} /{component.maximum}{componentSubmittedForAllStudents(component.key) ? ' ✓' : ''}
            </button>
          ))}
          </div>
        </div>

        {/* Search Bar & Page Size Selector */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <div className="relative min-w-0 flex-1 basis-48">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by student name or admission no..."
              className="h-8 w-full rounded-none border border-slate-300 bg-[#fffdf5] pl-8 pr-8 text-[11px] text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-[#0b4f4a] focus:bg-white focus:ring-2 focus:ring-[#0b4f4a]/20"
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

      {/* Submitted Component Status Banner */}
      {selectedComponentAlreadyComplete && singleComponent ? (
        <section className="flex flex-wrap items-center justify-between gap-2 rounded-none border border-amber-300 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-600 shrink-0" aria-hidden="true" />
            <span>
              <strong>{singleComponent.label}</strong> marks have been submitted and are currently locked.
            </span>
          </div>
          {canEditOnlineMarks(workflowStatus) ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={handleRequestEditMarks}
              className="inline-flex items-center gap-1.5 rounded-none border border-amber-400 bg-white px-2.5 py-1 text-xs font-bold text-amber-900 shadow-2xs transition hover:bg-amber-100"
            >
              <RotateCcw className="size-3.5 text-amber-700" />
              <span>Revise / Edit</span>
            </button>
          ) : null}
        </section>
      ) : null}

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
              No students match &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {paginatedRows.map((row, rowIndex) => {
                const key = singleComponent.key;
                const field = row.fields[key];
                const isExamAbsent = key === 'exam' && row.isAbsent;

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
                      <div>
                        <input
                          data-mark-cell="true"
                          data-mark-row={rowIndex}
                          data-mark-col={0}
                          data-student-index={row.studentIndex}
                          data-component-key={key}
                          value={values[row.student.studentId]?.[key] ?? ''}
                          type="text"
                          inputMode={key === 'exam' ? 'text' : 'decimal'}
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          placeholder={
                            ['assignment', 'presentation', 'rat'].includes(key)
                              ? '0'
                              : isExamAbsent
                                ? 'AB'
                                : '—'
                          }
                          disabled={!editable || busy !== null || componentIsSubmitted(key, row.student.cohortId)}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(event) =>
                            setField(
                              row.student.studentId,
                              key,
                              event.target.value,
                            )
                          }
                          onKeyDown={(e) =>
                            handleKeyDown(e, rowIndex, 0)
                          }
                          aria-label={`${key} mark for ${row.student.fullName}`}
                          className={`h-10 w-20 rounded-none border px-2 text-center text-base font-bold outline-none transition focus:border-[#0b4f4a] focus:ring-2 focus:ring-[#0b4f4a]/20 disabled:bg-[#eee8d7] disabled:text-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                            isExamAbsent
                              ? 'border-amber-300 bg-amber-50/70 text-amber-900'
                              : 'border-slate-400 bg-[#fffdf5] text-slate-900 focus:border-[#0b4f4a]'
                          } ${
                            !field.valid ? 'border-red-600 focus:ring-red-600/20' : ''
                          }`}
                        />
                        {!field.valid ? (
                          <p className="mt-0.5 text-right text-[9px] font-semibold text-red-600">
                            {field.message}
                          </p>
                        ) : null}
                      </div>
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
                    No students match &ldquo;{searchQuery}&rdquo;
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, rowIndex) => (
                  <tr
                    key={row.student.studentId}
                    className="align-middle transition hover:bg-[#fbf9f1]"
                  >
                    <td className="px-3 py-2.5">
                      <p className="text-xs font-bold text-slate-900 line-clamp-1">
                        {row.student.fullName}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-slate-600">
                        <span className="font-mono whitespace-nowrap">{row.student.admissionNumber}</span>
                      </div>
                      {row.isAbsent ? (
                        <Badge variant="warning" className="mt-0.5 rounded-none text-[9px]">
                          Exam absent
                        </Badge>
                      ) : null}
                    </td>

                    {onlineMarkComponents.map(({ key }, colIndex) => {
                      const field = row.fields[key];
                      const isAbsentExam = key === 'exam' && row.isAbsent;

                      return (
                        <td key={key} className="px-1.5 py-2.5">
                          <div className="mx-auto w-16">
                            <input
                              data-mark-cell="true"
                              data-mark-row={rowIndex}
                              data-mark-col={colIndex}
                              data-student-index={row.studentIndex}
                              data-component-key={key}
                              value={values[row.student.studentId]?.[key] ?? ''}
                              type="text"
                              inputMode={key === 'exam' ? 'text' : 'decimal'}
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                              placeholder={
                                ['assignment', 'presentation', 'rat'].includes(key)
                                  ? '0'
                                  : isAbsentExam
                                    ? 'AB'
                                    : '—'
                              }
                              disabled={!editable || busy !== null || componentIsSubmitted(key, row.student.cohortId)}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(event) =>
                                setField(
                                  row.student.studentId,
                                  key,
                                  event.target.value,
                                )
                              }
                              onKeyDown={(e) =>
                                handleKeyDown(e, rowIndex, colIndex)
                              }
                              aria-label={`${key} mark for ${row.student.fullName}`}
                              className={`h-9 w-full rounded-none border px-1 text-center text-xs font-bold outline-none transition focus:border-[#0b4f4a] focus:ring-2 focus:ring-[#0b4f4a]/20 disabled:bg-[#eee8d7] disabled:text-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                isAbsentExam
                                  ? 'border-amber-300 bg-amber-50/70 text-amber-900'
                                  : 'border-slate-400 bg-[#fffdf5] text-slate-900 focus:border-[#0b4f4a]'
                              } ${
                                !field.valid ? 'border-red-600 focus:ring-red-600/20' : ''
                              }`}
                            />
                            {!field.valid ? (
                              <p className="mt-0.5 text-center text-[9px] font-semibold text-red-600">
                                {field.message}
                              </p>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}

                    <td className="px-2 py-2.5 text-center text-xs font-bold text-slate-700">
                      {row.ratCatAverage === null
                        ? '—'
                        : row.ratCatAverage.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-center text-sm font-extrabold text-slate-950">
                      {row.isAbsent
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
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200">
        <div>
          {!editable ? (
            <p className="text-xs font-medium text-slate-600">
              Results are submitted and finalized. Download the completed spreadsheet below.
            </p>
          ) : ['assignment', 'presentation', 'rat'].includes(visibleComponent) ? (
            <p className="text-[11px] text-text-muted">
              Coursework marks (Assignment, Presentation, RAT) are saved as drafts and submitted together with final exam marks at the end of the semester.
            </p>
          ) : visibleComponent === 'cat' ? (
            <p className="text-[11px] text-text-muted">
              {catSubmitted
                ? 'CAT marks submitted successfully.'
                : unfilledSummary.missingCat > 0
                  ? `${unfilledSummary.missingCat} student(s) missing CAT marks before submission.`
                  : 'All CAT marks entered and ready for submission.'}
            </p>
          ) : (
            <p className="text-[11px] text-text-muted">
              {finalSubmitted
                ? 'Final marks submitted and markbook finalized.'
                : unfilledSummary.totalMissing > 0
                  ? `${unfilledSummary.totalMissing} mark(s) unentered. On final submission, empty coursework becomes 0 and empty exams are recorded as Absent (AB).`
                  : 'All columns complete and ready for final submission.'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => void downloadExcel()}
            leadingIcon={
              busy === 'download' ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )
            }
          >
            Download Excel (.xlsx)
          </Button>

          {canEditOnlineMarks(workflowStatus) ? (
            <>
              {trainerEntryOpen ? (
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
              ) : null}

              {['assignment', 'presentation', 'rat'].includes(visibleComponent) ? null : visibleComponent === 'cat' ? (
                catSubmitted ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy !== null}
                    onClick={handleRequestEditMarks}
                    className="border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100"
                    leadingIcon={
                      busy === 'reopen' ? (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3.5 text-amber-700" />
                      )
                    }
                  >
                    Revise CAT marks
                  </Button>
                ) : trainerEntryOpen ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      busy !== null ||
                      unfilledSummary.missingCat > 0 ||
                      Boolean(invalidForSelectedComponent)
                    }
                    onClick={() => void submitMarks()}
                    leadingIcon={
                      busy === 'submit' ? (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : (
                        <Send className="size-3.5" />
                      )
                    }
                  >
                    Submit CAT marks
                  </Button>
                ) : null
              ) : finalSubmitted ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={handleRequestEditMarks}
                  className="border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100"
                  leadingIcon={
                    busy === 'reopen' ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5 text-amber-700" />
                    )
                  }
                >
                  Revise Final Marks
                </Button>
              ) : trainerEntryOpen ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    busy !== null ||
                    Boolean(invalid)
                  }
                  onClick={() => void submitMarks()}
                  leadingIcon={
                    busy === 'submit' ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )
                  }
                >
                  Submit Final Marks
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {revisionDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60 shadow-2xs">
                  <RotateCcw className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Revise {visibleComponent === 'all' || visibleComponent === 'exam' ? 'Final' : singleComponent?.label ?? ''} Marks
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Provide a brief reason to unlock marks for correction.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRevisionDialogOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                aria-label="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4">
              <label htmlFor="staff-revision-reason" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Reason for revision
              </label>
              <textarea
                id="staff-revision-reason"
                rows={3}
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                placeholder="e.g. Correcting misplaced score for student, paper re-marked..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/15"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => setRevisionDialogOpen(false)}
                className="rounded-xl px-3.5 text-xs font-medium"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy !== null || revisionReason.trim().length < 3}
                onClick={() => void reopenComponent()}
                className="rounded-xl bg-amber-600 px-3.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-amber-700"
              >
                {busy === 'reopen' ? <LoaderCircle className="mr-1.5 size-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 size-3.5" />}
                Unlock for editing
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {closedNoticeDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700 border border-rose-200/60 shadow-2xs">
                  <Lock className="size-4.5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Marks Entry Closed
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Department marks entry window is inactive.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClosedNoticeDialogOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                aria-label="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs leading-relaxed text-slate-700 space-y-2">
              <p className="font-semibold text-slate-900">
                Marks cannot be edited at this time.
              </p>
              <p className="text-[11.5px] text-slate-600 leading-normal">
                The department has closed the marks entry period for this assessment. Any amendments or late entries must be authorized by department administration.
              </p>
              <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2 text-[11px] font-semibold text-slate-800">
                <Info className="size-3.5 shrink-0 text-slate-600" />
                <span>Please see your Head of Department (HoD) to request reopening.</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setClosedNoticeDialogOpen(false)}
                className="rounded-xl px-4 text-xs font-semibold"
              >
                Understood
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {submitConfirmDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <AlertCircle className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Confirm Final Marks Submission
                  </h3>
                  <p className="text-xs text-slate-500">
                    Review unentered marks and absent students before finalizing.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSubmitConfirmDialogOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              {/* Absent students notice */}
              {absentExamStudents.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <span>
                      {absentExamStudents.length} student{absentExamStudents.length === 1 ? '' : 's'} will be recorded as Absent (AB)
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                    The following students have no final exam mark entered and will receive an official grade of <strong>ABSENT</strong> on their academic transcript:
                  </p>
                  <div className="mt-2.5 max-h-36 overflow-y-auto divide-y divide-amber-200/60 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-[11px]">
                    {absentExamStudents.map((row) => (
                      <div key={row.student.studentId} className="flex items-center justify-between py-1.5">
                        <span className="font-semibold text-slate-900">{row.student.fullName}</span>
                        <span className="font-mono text-slate-600">{row.student.admissionNumber}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Coursework zeros notice */}
              {missingCourseworkCount > 0 ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 text-blue-900">
                  <div className="font-bold">
                    {missingCourseworkCount} unentered coursework mark{missingCourseworkCount === 1 ? '' : 's'}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-blue-800">
                    Blank cells in continuous assessment (Assignment, Presentation, RAT, or CAT) will automatically be recorded as <strong>0 marks</strong>.
                  </p>
                </div>
              ) : null}

              <p className="text-[11px] leading-relaxed text-slate-500">
                Once submitted, marks will be submitted for departmental moderation. You can unlock them for revisions while the assessment entry window remains open.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => setSubmitConfirmDialogOpen(false)}
              >
                Return to Markbook
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy !== null}
                onClick={() => void executeFinalSubmit()}
                className="bg-[#0b4f4a] text-white hover:bg-[#083e3a]"
                leadingIcon={
                  busy === 'submit' ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )
                }
              >
                {busy === 'submit' ? 'Submitting...' : 'Confirm & Submit Final Marks'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
