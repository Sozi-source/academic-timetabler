'use client';

import { Fragment, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Filter,
  Printer,
  RotateCcw,
  Save,
  Search,
  TableProperties,
  Users,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { AssessmentCandidateRow } from '@/features/assessment/types';
import { bulkUpdateHodCandidateMarksAction, updateHodCandidateMarksAction } from './actions';
import type { CandidateMarkRecord } from './types';

type BulkMarkField = 'assignment' | 'presentation' | 'rat' | 'cat' | 'exam';

interface RowDraftState {
  assignment: string;
  presentation: string;
  rat: string;
  cat: string;
  catAbsent: boolean;
  exam: string;
}

const FIELD_LIMITS: Record<BulkMarkField, { label: string; max: number }> = {
  assignment: { label: 'Assignment', max: 5 },
  presentation: { label: 'Presentation', max: 10 },
  rat: { label: 'RAT', max: 15 },
  cat: { label: 'CAT', max: 15 },
  exam: { label: 'Exam', max: 70 },
};

const FULL_COLUMN_ORDER: readonly BulkMarkField[] = ['assignment', 'presentation', 'rat', 'cat', 'exam'];

interface AssessmentMarkbookViewTableProps {
  assessmentId?: string;
  canEditMarks?: boolean;
  population: AssessmentCandidateRow[];
  marksByStudent: Record<string, CandidateMarkRecord>;
  assessmentType: 'cat' | 'exam';
  maxMark: number;
  passMark: number;
  marksSubmitted: boolean;
  isComplete: boolean;
  unitCode: string;
  unitName: string;
  periodName: string;
  initialCohort?: string;
  initialStatus?: string;
  initialView?: string;
}

function formatMark(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return String(Math.round(value));
}

function getGradeBadgeClass(grade: string | null | undefined): string {
  if (!grade) return 'bg-slate-50 text-slate-400 border border-slate-200';
  const upper = grade.toUpperCase();
  if (upper.includes('DISTINCTION')) {
    return 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold';
  }
  if (upper.includes('CREDIT')) {
    return 'bg-teal-50 text-teal-800 border border-teal-200 font-bold';
  }
  if (upper.includes('PASS')) {
    return 'bg-slate-100 text-slate-800 border border-slate-300 font-bold';
  }
  if (upper.includes('REFER') || upper.includes('FAIL')) {
    return 'bg-amber-50 text-amber-800 border border-amber-200 font-bold';
  }
  if (upper.includes('ABSENT')) {
    return 'bg-rose-50 text-rose-800 border border-rose-200 font-bold';
  }
  return 'bg-slate-100 text-slate-700 border border-slate-200';
}

export function AssessmentMarkbookViewTable({
  assessmentId,
  canEditMarks = false,
  population,
  marksByStudent,
  assessmentType,
  maxMark,
  passMark,
  marksSubmitted,
  isComplete,
  unitCode,
  unitName,
  periodName,
  initialCohort,
  initialStatus,
  initialView,
}: AssessmentMarkbookViewTableProps) {
  const router = useRouter();
  const editable = Boolean(canEditMarks && assessmentId && !isComplete && !marksSubmitted);
  const [isSaving, startSaving] = useTransition();
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkDrafts, setBulkDrafts] = useState<Record<string, RowDraftState>>({});
  const [dirtyStudentIds, setDirtyStudentIds] = useState<Set<string>>(() => new Set());
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const [draftValues, setDraftValues] = useState<RowDraftState>({
    assignment: '',
    presentation: '',
    rat: '',
    cat: '',
    catAbsent: false,
    exam: '',
  });
  const searchInputId = useId();
  const cohortSelectId = useId();
  const statusSelectId = useId();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCohort, setSelectedCohort] = useState<string>(() => {
    if (!initialCohort || initialCohort === 'all') return 'all';
    // Match directly by cohort UUID
    const matchesId = population.some((p) => p.cohort?.id === initialCohort);
    if (matchesId) return initialCohort;
    // Match by cohort name or code
    const found = population.find(
      (p) =>
        p.cohort?.name?.toLowerCase() === initialCohort.toLowerCase() ||
        p.cohort?.code?.toLowerCase() === initialCohort.toLowerCase(),
    );
    return found?.cohort?.id ?? initialCohort;
  });
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatus || 'all');
  const [viewMode, setViewMode] = useState<'all' | 'cat'>(initialView === 'cat' ? 'cat' : 'all');

  function toInputStr(value: number | null | undefined): string {
    return value === null || value === undefined ? '' : String(value);
  }

  function parseOptionalMark(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  function startEditingRow(studentId: string, marks: CandidateMarkRecord | null, catAbsent: boolean) {
    setEditError(null);
    setEditingStudentId(studentId);
    setDraftValues({
      assignment: toInputStr(marks?.assignment),
      presentation: toInputStr(marks?.presentation),
      rat: toInputStr(marks?.rat),
      cat: catAbsent ? '' : toInputStr(marks?.cat),
      catAbsent,
      exam: toInputStr(marks?.exam),
    });
  }

  function cancelEditingRow() {
    setEditingStudentId(null);
    setEditError(null);
  }

  function saveEditingRow(studentId: string, mode: 'cat' | 'all') {
    if (!assessmentId) return;
    setEditError(null);

    const assignment = parseOptionalMark(draftValues.assignment);
    const presentation = parseOptionalMark(draftValues.presentation);
    const rat = parseOptionalMark(draftValues.rat);
    const cat = draftValues.catAbsent ? null : parseOptionalMark(draftValues.cat);
    const exam = parseOptionalMark(draftValues.exam);

    if (
      (mode === 'cat' && Number.isNaN(cat)) ||
      (mode === 'all' && [assignment, presentation, rat, cat, exam].some((v) => Number.isNaN(v)))
    ) {
      setEditError('Enter valid numeric marks before saving.');
      return;
    }

    startSaving(async () => {
      const result = await updateHodCandidateMarksAction({
        assessmentId,
        studentId,
        component: mode,
        ...(mode === 'all'
          ? { assignment, presentation, rat, cat, catAbsent: draftValues.catAbsent, exam }
          : { cat, catAbsent: draftValues.catAbsent }),
      });
      if ('message' in result) {
        setEditError(result.message);
        return;
      }
      setEditingStudentId(null);
      router.refresh();
    });
  }

  // Discover distinct cohorts present in this population
  const cohorts = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of population) {
      if (row.cohort?.id) {
        map.set(row.cohort.id, row.cohort.name || row.cohort.code || 'Unnamed Cohort');
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [population]);

  // Merge population with marks
  const rows = useMemo(() => {
    return population.map((row) => {
      const studentId = row.student?.id ?? '';
      const marks = marksByStudent[studentId] ?? null;
      const isAbsent = row.attendance_status === 'absent' || Boolean(marks?.isExamAbsent);
      const isCatAbsent = Boolean(marks?.catAbsent);
      const hasCatMark = marks?.cat !== null && marks?.cat !== undefined;
      const hasExamMark = marks?.exam !== null && marks?.exam !== undefined;
      const hasAnyMark = Boolean(
        hasCatMark ||
        hasExamMark ||
        (marks?.assignment !== null && marks?.assignment !== undefined) ||
        (marks?.presentation !== null && marks?.presentation !== undefined) ||
        (marks?.rat !== null && marks?.rat !== undefined) ||
        (marks?.total !== null && marks?.total !== undefined),
      );
      const isCatMissing = !isAbsent && !isCatAbsent && !hasCatMark;

      return {
        rowId: row.id,
        studentId,
        admissionNumber: row.student?.admission_number ?? '—',
        fullName: row.student?.full_name ?? 'Unknown Student',
        cohortId: row.cohort?.id ?? '',
        cohortName: row.cohort?.name ?? row.cohort?.code ?? '—',
        isAbsent,
        isCatAbsent,
        hasCatMark,
        hasExamMark,
        hasAnyMark,
        isCatMissing,
        attendanceStatus: row.attendance_status,
        marks,
      };
    });
  }, [population, marksByStudent]);

  // Calculate telemetry & class averages from all candidates
  const stats = useMemo(() => {
    const satRows = rows.filter((r) => !r.isAbsent);
    const markedSatRows = satRows.filter((r) => r.hasAnyMark);

    let sumAssignment = 0;
    let countAssignment = 0;
    let sumPresentation = 0;
    let countPresentation = 0;
    let sumRat = 0;
    let countRat = 0;
    let sumCat = 0;
    let countCat = 0;
    let sumExam = 0;
    let countExam = 0;
    let sumTotal = 0;
    let countTotal = 0;

    let distinctionCount = 0;
    let creditCount = 0;
    let passCount = 0;
    let referCount = 0;
    let absentCount = rows.filter((r) => r.isAbsent || r.isCatAbsent).length;
    let catMarkedCount = 0;
    let catMissingCount = 0;
    let catPassCount = 0;

    for (const r of rows) {
      if (r.hasCatMark) {
        catMarkedCount += 1;
        if (r.marks?.cat !== null && r.marks?.cat !== undefined) {
          sumCat += r.marks.cat;
          countCat += 1;
          // CAT out of 15; pass mark is 40% (6/15)
          if (r.marks.cat >= 6) {
            catPassCount += 1;
          }
        }
      } else if (!r.isAbsent && !r.isCatAbsent) {
        catMissingCount += 1;
      }

      const m = r.marks;
      if (!m) continue;

      if (m.assignment !== null) {
        sumAssignment += m.assignment;
        countAssignment += 1;
      }
      if (m.presentation !== null) {
        sumPresentation += m.presentation;
        countPresentation += 1;
      }
      if (m.rat !== null) {
        sumRat += m.rat;
        countRat += 1;
      }
      if (m.exam !== null) {
        sumExam += m.exam;
        countExam += 1;
      }
      if (m.total !== null) {
        sumTotal += m.total;
        countTotal += 1;

        if (m.total >= 75) distinctionCount += 1;
        else if (m.total >= 65) creditCount += 1;
        else if (m.total >= passMark) passCount += 1;
        else referCount += 1;
      }
    }

    const meanTotal = countTotal > 0 ? Math.round(sumTotal / countTotal) : null;
    const meanCat = countCat > 0 ? Number((sumCat / countCat).toFixed(1)) : null;
    const passCountTotal = distinctionCount + creditCount + passCount;
    const passRate = countTotal > 0 ? Math.round((passCountTotal / countTotal) * 100) : null;
    const catPassRate = countCat > 0 ? Math.round((catPassCount / countCat) * 100) : null;

    return {
      totalCandidates: rows.length,
      satCandidates: satRows.length,
      absentCandidates: absentCount,
      markedCandidates: markedSatRows.length,
      catMarkedCount,
      catMissingCount,
      meanAssignment: countAssignment > 0 ? Math.round(sumAssignment / countAssignment) : null,
      meanPresentation: countPresentation > 0 ? Math.round(sumPresentation / countPresentation) : null,
      meanRat: countRat > 0 ? Math.round(sumRat / countRat) : null,
      meanCat,
      meanExam: countExam > 0 ? Math.round(sumExam / countExam) : null,
      meanTotal,
      passRate,
      catPassRate,
      passCountTotal,
      distinctionCount,
      creditCount,
      passCount,
      referCount,
    };
  }, [rows, passMark]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      if (q) {
        const matchesName = row.fullName.toLowerCase().includes(q);
        const matchesAdm = row.admissionNumber.toLowerCase().includes(q);
        if (!matchesName && !matchesAdm) return false;
      }

      if (selectedCohort !== 'all' && row.cohortId !== selectedCohort) {
        return false;
      }

      if (selectedStatus === 'sat' && (row.isAbsent || row.isCatAbsent)) return false;
      if (selectedStatus === 'absent' && !row.isAbsent && !row.isCatAbsent) return false;
      if (selectedStatus === 'with-marks' && !row.hasAnyMark) return false;
      if (selectedStatus === 'missing-marks' && (row.isAbsent || (row.hasCatMark && row.hasExamMark))) return false;
      if (selectedStatus === 'cat-entered' && !row.hasCatMark) return false;
      if (selectedStatus === 'cat-missing' && !row.isCatMissing) return false;
      if (selectedStatus === 'cat-absent' && !row.isCatAbsent) return false;
      if (selectedStatus === 'exam-entered' && !row.hasExamMark) return false;

      return true;
    });
  }, [rows, searchQuery, selectedCohort, selectedStatus]);

  const effectiveBulkMode: 'cat' | 'all' = viewMode === 'cat' || assessmentType !== 'exam' ? 'cat' : 'all';
  const dirtyCount = dirtyStudentIds.size;

  useEffect(() => {
    if (!bulkEditMode || dirtyCount === 0) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [bulkEditMode, dirtyCount]);

  function buildRowDraft(marks: CandidateMarkRecord | null, catAbsent: boolean): RowDraftState {
    return {
      assignment: toInputStr(marks?.assignment),
      presentation: toInputStr(marks?.presentation),
      rat: toInputStr(marks?.rat),
      cat: catAbsent ? '' : toInputStr(marks?.cat),
      catAbsent,
      exam: toInputStr(marks?.exam),
    };
  }

  function getBulkDraft(studentId: string, marks: CandidateMarkRecord | null, catAbsent: boolean): RowDraftState {
    return bulkDrafts[studentId] ?? buildRowDraft(marks, catAbsent);
  }

  function isFieldInvalid(raw: string, field: BulkMarkField): boolean {
    const trimmed = raw.trim();
    if (!trimmed) return false;
    const parsed = Number(trimmed);
    return !Number.isFinite(parsed) || parsed < 0 || parsed > FIELD_LIMITS[field].max;
  }

  function updateBulkDraft(
    studentId: string,
    marks: CandidateMarkRecord | null,
    catAbsent: boolean,
    patch: Partial<RowDraftState>,
  ) {
    setEditError(null);
    setBulkNotice(null);
    setBulkDrafts((prev) => {
      const base = prev[studentId] ?? buildRowDraft(marks, catAbsent);
      return {
        ...prev,
        [studentId]: { ...base, ...patch },
      };
    });
    setDirtyStudentIds((prev) => {
      if (prev.has(studentId)) return prev;
      const next = new Set(prev);
      next.add(studentId);
      return next;
    });
  }

  function enterBulkEditMode() {
    setEditingStudentId(null);
    setEditError(null);
    setBulkNotice(null);
    setBulkDrafts({});
    setDirtyStudentIds(new Set());
    setBulkEditMode(true);
  }

  function exitBulkEditMode() {
    if (dirtyStudentIds.size > 0) {
      const confirmed = window.confirm(
        `You have ${dirtyStudentIds.size} unsaved candidate mark change(s). Discard them and exit bulk edit mode?`,
      );
      if (!confirmed) return;
    }
    setBulkDrafts({});
    setDirtyStudentIds(new Set());
    setEditError(null);
    setBulkEditMode(false);
  }

  function discardBulkChanges() {
    setBulkDrafts({});
    setDirtyStudentIds(new Set());
    setEditError(null);
    setBulkNotice(null);
  }

  function handleBulkKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    col: BulkMarkField,
  ) {
    if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const container = tableContainerRef.current;
    if (!container) return;
    const step = e.key === 'ArrowUp' ? -1 : 1;
    let targetIdx = rowIdx + step;
    while (targetIdx >= 0 && targetIdx < filteredRows.length) {
      const target = container.querySelector<HTMLInputElement>(
        `input[data-bulk-row="${targetIdx}"][data-bulk-col="${col}"]`,
      );
      if (target && !target.disabled) {
        target.focus();
        target.select();
        return;
      }
      targetIdx += step;
    }
  }

  function handleBulkPaste(
    e: React.ClipboardEvent<HTMLInputElement>,
    startRowIdx: number,
    startCol: BulkMarkField,
    mode: 'cat' | 'all',
  ) {
    const text = e.clipboardData.getData('text');
    if (!text || (!text.includes('\n') && !text.includes('\r') && !text.includes('\t'))) {
      return;
    }
    e.preventDefault();
    const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
      rawLines.pop();
    }
    if (rawLines.length === 0) return;

    const startColIndex = FULL_COLUMN_ORDER.indexOf(startCol);
    const touchedIds: string[] = [];

    setEditError(null);
    setBulkNotice(null);
    setBulkDrafts((prev) => {
      const next = { ...prev };
      for (let offset = 0; offset < rawLines.length; offset++) {
        const targetRow = filteredRows[startRowIdx + offset];
        if (!targetRow || !targetRow.studentId) break;
        const cells = rawLines[offset].split('\t');
        const current = next[targetRow.studentId] ?? buildRowDraft(targetRow.marks, targetRow.isCatAbsent);
        const updated: RowDraftState = { ...current };

        if (mode === 'cat' || cells.length === 1) {
          const val = (cells[0] ?? '').trim();
          if (startCol === 'cat') {
            if (/^(ab|absent)$/i.test(val)) {
              updated.catAbsent = true;
              updated.cat = '';
            } else {
              updated.catAbsent = false;
              updated.cat = val;
            }
          } else {
            updated[startCol] = val;
          }
        } else {
          for (let colOffset = 0; colOffset < cells.length; colOffset++) {
            const colField = FULL_COLUMN_ORDER[startColIndex + colOffset];
            if (!colField) break;
            const val = (cells[colOffset] ?? '').trim();
            if (colField === 'cat') {
              if (/^(ab|absent)$/i.test(val)) {
                updated.catAbsent = true;
                updated.cat = '';
              } else {
                updated.catAbsent = false;
                updated.cat = val;
              }
            } else {
              updated[colField] = val;
            }
          }
        }

        next[targetRow.studentId] = updated;
        touchedIds.push(targetRow.studentId);
      }
      return next;
    });

    if (touchedIds.length > 0) {
      setDirtyStudentIds((prev) => {
        const next = new Set(prev);
        for (const id of touchedIds) next.add(id);
        return next;
      });
    }
  }

  function saveAllBulkChanges(mode: 'cat' | 'all') {
    if (!assessmentId || dirtyStudentIds.size === 0) return;
    setEditError(null);
    setBulkNotice(null);

    const rowByStudent = new Map(rows.map((r) => [r.studentId, r]));
    const entries: Array<{
      studentId: string;
      assignment?: number | null;
      presentation?: number | null;
      rat?: number | null;
      cat?: number | null;
      catAbsent?: boolean;
      exam?: number | null;
    }> = [];

    const fieldsToValidate: readonly BulkMarkField[] = mode === 'cat' ? ['cat'] : FULL_COLUMN_ORDER;

    for (const studentId of dirtyStudentIds) {
      const row = rowByStudent.get(studentId);
      const draft = bulkDrafts[studentId];
      if (!row || !draft) continue;

      for (const field of fieldsToValidate) {
        if (field === 'cat' && draft.catAbsent) continue;
        if (isFieldInvalid(draft[field], field)) {
          setEditError(
            `Invalid ${FIELD_LIMITS[field].label} mark for ${row.fullName} (${row.admissionNumber}). Enter a number between 0 and ${FIELD_LIMITS[field].max}.`,
          );
          return;
        }
      }

      const cat = draft.catAbsent ? null : parseOptionalMark(draft.cat);
      if (mode === 'cat') {
        entries.push({
          studentId,
          cat,
          catAbsent: draft.catAbsent,
        });
      } else {
        entries.push({
          studentId,
          assignment: parseOptionalMark(draft.assignment),
          presentation: parseOptionalMark(draft.presentation),
          rat: parseOptionalMark(draft.rat),
          cat,
          catAbsent: draft.catAbsent,
          exam: parseOptionalMark(draft.exam),
        });
      }
    }

    if (entries.length === 0) return;

    startSaving(async () => {
      const result = await bulkUpdateHodCandidateMarksAction({
        assessmentId,
        component: mode,
        entries,
      });
      if ('message' in result) {
        setEditError(result.message);
        return;
      }
      setBulkDrafts({});
      setDirtyStudentIds(new Set());
      setBulkNotice(
        `Saved marks for ${result.savedCount} candidate${result.savedCount === 1 ? '' : 's'}.`,
      );
      router.refresh();
    });
  }

  return (
    <section className="space-y-4">
      {/* Performance Summary & Quick Filters */}
      {stats.markedCandidates > 0 || stats.catMarkedCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-2xs">
          {/* Status Quick Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setSelectedStatus(selectedStatus === 'cat-entered' ? 'all' : 'cat-entered')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold border transition cursor-pointer ${
                selectedStatus === 'cat-entered'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="size-3 text-emerald-600" />
              <span>CAT Recorded: {stats.catMarkedCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus(selectedStatus === 'cat-missing' ? 'all' : 'cat-missing')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold border transition cursor-pointer ${
                selectedStatus === 'cat-missing'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
              }`}
            >
              <AlertCircle className="size-3 text-amber-600" />
              <span>Missing CAT: {stats.catMissingCount}</span>
            </button>
            {stats.absentCandidates > 0 ? (
              <button
                type="button"
                onClick={() => setSelectedStatus(selectedStatus === 'absent' ? 'all' : 'absent')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold border transition cursor-pointer ${
                  selectedStatus === 'absent'
                    ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                    : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                }`}
              >
                Absent: {stats.absentCandidates}
              </button>
            ) : null}
            {stats.distinctionCount > 0 ? (
              <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 border border-amber-200">
                Distinction: {stats.distinctionCount}
              </span>
            ) : null}
            {stats.creditCount > 0 ? (
              <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800 border border-teal-200">
                Credit: {stats.creditCount}
              </span>
            ) : null}
            {stats.passCount > 0 ? (
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-800 border border-slate-200">
                Pass: {stats.passCount}
              </span>
            ) : null}
            {stats.referCount > 0 ? (
              <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                Refer: {stats.referCount}
              </span>
            ) : null}
          </div>

          {/* Performance Summary Metrics */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {stats.meanCat !== null ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-50/80 px-2.5 py-1 border border-amber-200 shadow-2xs">
                <span className="text-[11px] font-bold text-amber-800">Mean CAT:</span>
                <span className="font-mono text-xs font-black text-amber-950">
                  {stats.meanCat} / 15
                </span>
              </div>
            ) : null}
            {stats.meanTotal !== null ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-50/80 px-2.5 py-1 border border-amber-200 shadow-2xs">
                <span className="text-[11px] font-bold text-amber-800">Mean Total:</span>
                <span className="font-mono text-xs font-black text-amber-950">
                  {stats.meanTotal} / {maxMark}
                </span>
              </div>
            ) : null}
            {stats.passRate !== null ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 border border-emerald-200">
                <span className="text-[11px] font-medium text-emerald-700">Pass Rate:</span>
                <span className="text-xs font-bold text-emerald-900">
                  {stats.passRate}%
                </span>
              </div>
            ) : stats.catPassRate !== null ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 border border-emerald-200">
                <span className="text-[11px] font-medium text-emerald-700">CAT Pass Rate:</span>
                <span className="text-xs font-bold text-emerald-900">
                  {stats.catPassRate}%
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Filter and Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                viewMode === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full Markbook
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cat')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                viewMode === 'cat'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>CAT Focus</span>
              {stats.catMissingCount > 0 ? (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    viewMode === 'cat' ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {stats.catMissingCount}
                </span>
              ) : null}
            </button>
          </div>

          {/* Search box */}
          <div className="relative min-w-[220px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              id={searchInputId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or admission no..."
              className="h-8.5 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          {/* Cohort Selector (if multiple cohorts) */}
          {cohorts.length > 1 ? (
            <div className="relative">
              <label htmlFor={cohortSelectId} className="sr-only">
                Filter by cohort
              </label>
              <Users className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <select
                id={cohortSelectId}
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="h-8.5 appearance-none rounded-lg border border-slate-300 bg-white pl-8 pr-8 text-xs font-semibold text-slate-700 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="all">All Cohorts ({rows.length})</option>
                {cohorts.map((c) => {
                  const count = rows.filter((r) => r.cohortId === c.id).length;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} ({count})
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          ) : null}

          {/* Status Filter */}
          <div className="relative">
            <label htmlFor={statusSelectId} className="sr-only">
              Filter by status
            </label>
            <Filter className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <select
              id={statusSelectId}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-8.5 appearance-none rounded-lg border border-slate-300 bg-white pl-8 pr-8 text-xs font-semibold text-slate-700 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">All Candidates ({rows.length})</option>
              <option value="cat-entered">CAT Recorded ({stats.catMarkedCount})</option>
              <option value="cat-missing">CAT Pending / Missing ({stats.catMissingCount})</option>
              <option value="with-marks">With Any Marks Recorded ({stats.markedCandidates})</option>
              <option value="missing-marks">Incomplete / Missing Marks</option>
              <option value="cat-absent">CAT Absent (AB)</option>
              <option value="absent">All Absent (AB)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Right side: Count, Bulk Edit & Print */}
        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-slate-500 whitespace-nowrap">
            Showing <strong className="text-slate-900">{filteredRows.length}</strong> of{' '}
            <strong className="text-slate-900">{population.length}</strong> candidates
          </span>
          {editable ? (
            bulkEditMode ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={exitBulkEditMode}
                className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-900 px-3 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer"
              >
                <X className="size-3.5" />
                <span>Exit Bulk Edit</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={enterBulkEditMode}
                className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-600 px-3 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition cursor-pointer"
                title="Open direct mark entry fields for all visible students"
              >
                <TableProperties className="size-3.5" />
                <span>Bulk Edit Marks</span>
              </button>
            )
          ) : null}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
            title="Print markbook roster"
          >
            <Printer className="size-3.5 text-slate-500" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Printable Heading (visible on print only) */}
      <div className="hidden print:block mb-4 border-b border-slate-300 pb-2">
        <h1 className="text-base font-bold text-slate-900">
          IMPERIAL COLLEGE OF MEDICAL AND HEALTH SCIENCES
        </h1>
        <p className="text-xs font-semibold text-slate-700">
          {viewMode === 'cat' || assessmentType === 'cat' ? 'CAT MARKSHEET' : 'FINAL EXAM MARKSHEET'} · {unitCode} {unitName}
        </p>
        <p className="text-[11px] text-slate-500">
          Academic Period: {periodName} · Total Candidates: {population.length}
        </p>
      </div>

      {bulkEditMode ? (
        <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50/95 px-4 py-2.5 shadow-sm backdrop-blur print:hidden">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                <TableProperties className="size-3.5 text-emerald-700" />
                <span>
                  Bulk Edit Mode — {effectiveBulkMode === 'cat' ? 'CAT Marks' : 'All Mark Components'}
                </span>
              </span>
              {dirtyCount > 0 ? (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 border border-amber-300">
                  {dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                  All changes saved
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-emerald-900/80">
              Press <kbd className="rounded border border-emerald-300 bg-white px-1 font-mono text-[10px]">Enter</kbd> or{' '}
              <kbd className="rounded border border-emerald-300 bg-white px-1 font-mono text-[10px]">↓</kbd> to jump to the next student · Paste a column from Excel to fill down
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={dirtyCount === 0 || isSaving}
              onClick={discardBulkChanges}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              <span>Discard</span>
            </button>
            <button
              type="button"
              disabled={dirtyCount === 0 || isSaving}
              onClick={() => saveAllBulkChanges(effectiveBulkMode)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <Save className="size-3.5" />
              <span>
                {isSaving
                  ? 'Saving...'
                  : dirtyCount > 0
                  ? `Save All Changes (${dirtyCount})`
                  : 'Save All Changes'}
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {bulkNotice ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 print:hidden">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            <span>{bulkNotice}</span>
          </span>
          <button type="button" onClick={() => setBulkNotice(null)} className="rounded p-0.5 hover:bg-emerald-100 cursor-pointer" aria-label="Dismiss notice">
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {editError ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800 print:hidden">
          <span>{editError}</span>
          <button type="button" onClick={() => setEditError(null)} className="rounded p-0.5 hover:bg-rose-100 cursor-pointer" aria-label="Dismiss error">
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {/* Candidate Marks Table */}
      <div ref={tableContainerRef} className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-2xs">
        {viewMode === 'cat' ? (
          <table className="w-full table-auto text-left text-xs">
            <thead className="border-b border-slate-300 bg-slate-50 text-[11px] font-bold text-slate-700">
              <tr>
                <th scope="col" className="w-9 px-2 py-2.5 text-center text-slate-500 whitespace-nowrap">No.</th>
                <th scope="col" className="px-2 py-2.5 whitespace-nowrap text-slate-800">Adm No.</th>
                <th scope="col" className="px-2 py-2.5 whitespace-nowrap text-slate-900">Student Name</th>
                <th scope="col" className="px-2 py-2.5 whitespace-nowrap text-slate-700">Cohort</th>
                <th scope="col" className="px-2 py-2.5 text-center whitespace-nowrap bg-amber-100/90 text-amber-950 font-black border-x border-amber-300">
                  CAT <span className="text-[10px] font-bold text-amber-800">/15</span>
                </th>
                <th scope="col" className="px-2 py-2.5 text-center whitespace-nowrap">CAT Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-xs text-slate-500">
                    <p className="font-semibold text-slate-700">No candidates match your filter criteria.</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Try adjusting your search query or status filter above.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const m = row.marks;
                  const isDirty = bulkEditMode && dirtyStudentIds.has(row.studentId);
                  const isEditingThisRow = editingStudentId === row.studentId && !bulkEditMode;
                  const canClickToEdit = editable && !bulkEditMode && !isEditingThisRow;
                  const bulkRow = bulkEditMode ? getBulkDraft(row.studentId, m, row.isCatAbsent) : null;
                  const catInvalid = bulkRow ? !bulkRow.catAbsent && isFieldInvalid(bulkRow.cat, 'cat') : false;
                  return (
                    <Fragment key={row.rowId}>
                      <tr
                        onClick={
                          canClickToEdit
                            ? () => startEditingRow(row.studentId, m, row.isCatAbsent)
                            : undefined
                        }
                        title={canClickToEdit ? 'Click row to edit marks' : undefined}
                        className={`transition-colors odd:bg-white even:bg-slate-50/60 hover:bg-amber-50/35 ${
                          canClickToEdit ? 'cursor-pointer' : ''
                        } ${
                          isEditingThisRow
                            ? 'bg-emerald-50/50! ring-1 ring-inset ring-emerald-300'
                            : isDirty
                            ? 'bg-emerald-50/60!'
                            : row.isCatMissing
                            ? 'bg-amber-50/30'
                            : row.isCatAbsent
                            ? 'bg-rose-50/30'
                            : ''
                        }`}
                      >
                        <td className="px-2 py-2 text-center font-medium text-slate-400 whitespace-nowrap">
                          {idx + 1}.
                        </td>
                        <td className="px-2 py-2 font-mono font-bold text-slate-950 whitespace-nowrap">
                          {row.admissionNumber}
                        </td>
                        <td className="px-2 py-2 font-semibold text-slate-900 whitespace-nowrap">
                          {row.fullName}
                        </td>
                        <td className="px-2 py-2 text-slate-600 whitespace-nowrap">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                            {row.cohortName}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center bg-amber-50/70 border-x border-amber-200/90 font-mono font-bold tabular-nums">
                        {bulkEditMode && bulkRow ? (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={15}
                              step="0.5"
                              data-bulk-row={idx}
                              data-bulk-col="cat"
                              disabled={bulkRow.catAbsent || isSaving}
                              value={bulkRow.cat}
                              onChange={(e) =>
                                updateBulkDraft(row.studentId, m, row.isCatAbsent, { cat: e.target.value })
                              }
                              onKeyDown={(e) => handleBulkKeyDown(e, idx, 'cat')}
                              onPaste={(e) => handleBulkPaste(e, idx, 'cat', 'cat')}
                              placeholder="0–15"
                              aria-label={`CAT mark for ${row.fullName}`}
                              className={`h-7 w-16 rounded border bg-white px-1.5 text-center font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-400 ${
                                catInvalid
                                  ? 'border-rose-500 ring-1 ring-rose-400 focus:ring-rose-500'
                                  : isDirty
                                  ? 'border-emerald-500 focus:ring-emerald-500'
                                  : 'border-amber-400 focus:ring-amber-500'
                              }`}
                            />
                            <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={bulkRow.catAbsent}
                                disabled={isSaving}
                                onChange={(e) =>
                                  updateBulkDraft(row.studentId, m, row.isCatAbsent, {
                                    catAbsent: e.target.checked,
                                    cat: e.target.checked ? '' : bulkRow.cat,
                                  })
                                }
                                className="rounded border-slate-300"
                              />
                              AB
                            </label>
                          </div>
                        ) : editingStudentId === row.studentId ? (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={15}
                              step="0.5"
                              disabled={draftValues.catAbsent || isSaving}
                              value={draftValues.cat}
                              onChange={(e) => setDraftValues((v) => ({ ...v, cat: e.target.value }))}
                              placeholder="0–15"
                              aria-label={`CAT mark for ${row.fullName}`}
                              className="h-7 w-16 rounded border border-amber-400 bg-white px-1.5 text-center font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100 disabled:text-slate-400"
                            />
                            <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={draftValues.catAbsent}
                                disabled={isSaving}
                                onChange={(e) => setDraftValues((v) => ({ ...v, catAbsent: e.target.checked }))}
                                className="rounded border-slate-300"
                              />
                              AB
                            </label>
                          </div>
                        ) : row.isCatAbsent ? (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-900 border border-rose-300">
                            AB
                          </span>
                        ) : row.hasCatMark ? (
                          <span className="text-xs font-black text-amber-950">
                            {formatMark(m?.cat)}
                          </span>
                        ) : (
                          <span className="text-amber-400 font-medium">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center whitespace-nowrap">
                        {row.isCatAbsent ? (
                          <span className="inline-block rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                            Absent (AB)
                          </span>
                        ) : row.hasCatMark ? (
                          <span className="inline-block rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            ✓ Recorded
                          </span>
                        ) : (
                          <span className="inline-block rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300">
                            ⚠ Missing / Pending
                          </span>
                        )}
                      </td>
                    </tr>
                    {isEditingThisRow ? (
                      <tr className="bg-emerald-50/80 border-b border-emerald-200 print:hidden">
                        <td colSpan={6} className="px-3 py-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-emerald-950">
                              Editing {row.fullName} ({row.admissionNumber})
                            </span>
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => saveEditingRow(row.studentId, 'cat')}
                                className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-emerald-600 px-2.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                              >
                                <Save className="size-3 shrink-0" />
                                <span>{isSaving ? 'Saving...' : 'Save'}</span>
                              </button>
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={cancelEditingRow}
                                className="inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                  );
                })
              )}
            </tbody>
            {stats.catMarkedCount > 0 ? (
              <tfoot className="border-t-2 border-slate-300 bg-slate-100/90 font-bold text-slate-800">
                <tr>
                  <td colSpan={4} className="px-3.5 py-3 text-right uppercase tracking-wider text-[11px] text-slate-700 font-extrabold whitespace-nowrap">
                    Class CAT Average ({stats.catMarkedCount} candidates):
                  </td>
                  <td className="px-3 py-3 text-center bg-amber-200/80 border-x border-amber-300 font-black text-amber-950 font-mono text-xs tabular-nums shadow-2xs">
                    {stats.meanCat !== null ? stats.meanCat : '—'}
                  </td>
                  <td className="px-3 py-3 text-center text-[10px] text-slate-600 font-bold">
                    {stats.catPassRate !== null ? `${stats.catPassRate}% Passed (≥6/15)` : '—'}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        ) : (
          <table className="w-full table-auto text-left text-xs">
            <thead className="border-b border-slate-300 bg-slate-50 text-[11px] font-bold text-slate-700">
              {assessmentType === 'exam' ? (
                <>
                  {/* Tier 1 Category Super-Header */}
                  <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600">
                    <th
                      colSpan={3}
                      scope="colgroup"
                      className="px-2 py-1.5 text-left bg-slate-100/90 border-r-2 border-slate-300 text-slate-800 whitespace-nowrap"
                    >
                      Candidate
                    </th>
                    <th
                      colSpan={4}
                      scope="colgroup"
                      className="px-2 py-1.5 text-center bg-slate-50 border-r border-slate-200 text-slate-700 whitespace-nowrap"
                    >
                      Coursework (30%)
                    </th>
                    <th
                      colSpan={1}
                      scope="colgroup"
                      className="px-2 py-1.5 text-center bg-slate-100/80 border-r border-slate-200 text-slate-800 whitespace-nowrap"
                    >
                      Exam (70%)
                    </th>
                    <th
                      colSpan={2}
                      scope="colgroup"
                      className="px-2 py-1.5 text-center bg-amber-100/90 border-l border-amber-300 text-amber-950 font-black shadow-2xs whitespace-nowrap"
                    >
                      Final
                    </th>
                  </tr>

                  {/* Tier 2 Column Detail Header */}
                  <tr className="border-b border-slate-300 bg-slate-50 text-[11px] font-bold text-slate-700">
                    <th scope="col" className="w-8 px-1.5 py-2 text-center text-slate-500 whitespace-nowrap">No.</th>
                    <th scope="col" className="px-2 py-2 whitespace-nowrap text-slate-800">Adm No.</th>
                    <th scope="col" className="px-2 py-2 whitespace-nowrap border-r-2 border-slate-300 text-slate-900">Student Name</th>

                    <th scope="col" className="px-1.5 py-2 text-center whitespace-nowrap">
                      Assign <span className="text-[10px] font-normal text-slate-400">/5</span>
                    </th>
                    <th scope="col" className="px-1.5 py-2 text-center whitespace-nowrap">
                      Pres <span className="text-[10px] font-normal text-slate-400">/10</span>
                    </th>
                    <th scope="col" className="px-1.5 py-2 text-center whitespace-nowrap">
                      RAT <span className="text-[10px] font-normal text-slate-400">/15</span>
                    </th>
                    <th scope="col" className="px-1.5 py-2 text-center whitespace-nowrap border-r border-slate-200">
                      CAT <span className="text-[10px] font-normal text-slate-400">/15</span>
                    </th>
                    <th scope="col" className="px-1.5 py-2 text-center whitespace-nowrap border-r border-slate-200">
                      Exam <span className="text-[10px] font-normal text-slate-400">/70</span>
                    </th>
                    <th scope="col" className="px-1.5 py-2 text-center whitespace-nowrap bg-amber-100/90 text-amber-950 font-black border-x border-amber-300 shadow-2xs">
                      Total <span className="text-[10px] font-bold text-amber-800">/{maxMark}</span>
                    </th>
                    <th scope="col" className="px-2 py-2 text-center whitespace-nowrap bg-amber-50/50">Grade</th>
                  </tr>
                </>
              ) : (
                <tr>
                  <th scope="col" className="w-9 px-2 py-2 text-center text-slate-500 whitespace-nowrap">No.</th>
                  <th scope="col" className="px-2 py-2 whitespace-nowrap text-slate-800">Adm No.</th>
                  <th scope="col" className="px-2 py-2 whitespace-nowrap border-r-2 border-slate-300 text-slate-900">Student Name</th>
                  <th scope="col" className="px-2 py-2 text-center whitespace-nowrap bg-amber-100/90 text-amber-950 font-black border-x border-amber-300">
                    CAT <span className="text-[10px] font-bold text-amber-800">/{maxMark}</span>
                  </th>
                  <th scope="col" className="px-2 py-2 text-center whitespace-nowrap bg-amber-50/50">Grade</th>
                  <th scope="col" className="px-2 py-2 text-center whitespace-nowrap">Status</th>
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={assessmentType === 'exam' ? 10 : 6}
                    className="px-4 py-12 text-center text-xs text-slate-500"
                  >
                    <p className="font-semibold text-slate-700">No candidates match your filter criteria.</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Try adjusting your search query or cohort filter above.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const m = row.marks;
                  const isFinalized = marksSubmitted || Boolean(m?.isCommitted);
                  const isAbsent =
                    row.isAbsent ||
                    (assessmentType === 'exam' && isFinalized && (m?.exam === null || m?.exam === undefined));
                  const isCatAbsent =
                    row.isCatAbsent || (isFinalized && (m?.cat === null || m?.cat === undefined));
                  const isDirty = bulkEditMode && dirtyStudentIds.has(row.studentId);
                  const isEditingThisRow = editingStudentId === row.studentId && !bulkEditMode;
                  const canClickToEdit = editable && !bulkEditMode && !isEditingThisRow;
                  const bulkRow = bulkEditMode ? getBulkDraft(row.studentId, m, isCatAbsent) : null;

                  const bulkInputClass = (field: BulkMarkField, isCat = false) => {
                    const invalid =
                      bulkRow && !(field === 'cat' && bulkRow.catAbsent)
                        ? isFieldInvalid(bulkRow[field], field)
                        : false;
                    return `h-7 w-12 rounded border bg-white px-1 text-center font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-400 ${
                      invalid
                        ? 'border-rose-500 ring-1 ring-rose-400 focus:ring-rose-500'
                        : isDirty
                        ? 'border-emerald-500 focus:ring-emerald-500'
                        : isCat
                        ? 'border-amber-400 focus:ring-amber-500'
                        : 'border-slate-300 focus:ring-emerald-500'
                    }`;
                  };

                  return (
                    <Fragment key={row.rowId}>
                      <tr
                        onClick={
                          canClickToEdit
                            ? () => startEditingRow(row.studentId, m, isCatAbsent)
                            : undefined
                        }
                        title={canClickToEdit ? 'Click row to edit marks' : undefined}
                        className={`transition-colors odd:bg-white even:bg-slate-50/60 hover:bg-amber-50/35 ${
                          canClickToEdit ? 'cursor-pointer' : ''
                        } ${
                          isEditingThisRow
                            ? 'bg-emerald-50/50! ring-1 ring-inset ring-emerald-300'
                            : isDirty
                            ? 'bg-emerald-50/60!'
                            : isAbsent
                            ? 'bg-rose-50/30'
                            : row.isCatMissing
                            ? 'bg-amber-50/20'
                            : ''
                        }`}
                      >
                        {/* Index */}
                        <td className="px-1.5 py-2 text-center font-medium text-slate-400 whitespace-nowrap">
                          {idx + 1}.
                        </td>

                        {/* Admission No */}
                        <td className="px-2 py-2 font-mono font-bold text-slate-950 whitespace-nowrap">
                          {row.admissionNumber}
                        </td>

                        {/* Full Name with vertical boundary wall */}
                        <td className="px-2 py-2 font-semibold text-slate-900 whitespace-nowrap border-r-2 border-slate-200">
                          {row.fullName}
                        </td>

                      {assessmentType === 'exam' ? (
                        <>
                          {/* Assignment /5 */}
                          <td className="px-2.5 py-2.5 text-center font-mono font-medium text-slate-800 tabular-nums">
                            {bulkEditMode && bulkRow ? (
                              <input
                                type="number"
                                min={0}
                                max={5}
                                step="0.5"
                                data-bulk-row={idx}
                                data-bulk-col="assignment"
                                disabled={isSaving}
                                value={bulkRow.assignment}
                                onChange={(e) =>
                                  updateBulkDraft(row.studentId, m, isCatAbsent, { assignment: e.target.value })
                                }
                                onKeyDown={(e) => handleBulkKeyDown(e, idx, 'assignment')}
                                onPaste={(e) => handleBulkPaste(e, idx, 'assignment', 'all')}
                                aria-label={`Assignment mark for ${row.fullName}`}
                                className={bulkInputClass('assignment')}
                              />
                            ) : editingStudentId === row.studentId ? (
                              <input
                                type="number"
                                min={0}
                                max={5}
                                step="0.5"
                                disabled={isSaving}
                                value={draftValues.assignment}
                                onChange={(e) => setDraftValues((v) => ({ ...v, assignment: e.target.value }))}
                                aria-label={`Assignment mark for ${row.fullName}`}
                                className="h-7 w-14 rounded border border-slate-300 bg-white px-1 text-center font-mono text-xs text-slate-900"
                              />
                            ) : (
                              formatMark(m?.assignment)
                            )}
                          </td>

                          {/* Presentation /10 */}
                          <td className="px-2.5 py-2.5 text-center font-mono font-medium text-slate-800 tabular-nums">
                            {bulkEditMode && bulkRow ? (
                              <input
                                type="number"
                                min={0}
                                max={10}
                                step="0.5"
                                data-bulk-row={idx}
                                data-bulk-col="presentation"
                                disabled={isSaving}
                                value={bulkRow.presentation}
                                onChange={(e) =>
                                  updateBulkDraft(row.studentId, m, isCatAbsent, { presentation: e.target.value })
                                }
                                onKeyDown={(e) => handleBulkKeyDown(e, idx, 'presentation')}
                                onPaste={(e) => handleBulkPaste(e, idx, 'presentation', 'all')}
                                aria-label={`Presentation mark for ${row.fullName}`}
                                className={bulkInputClass('presentation')}
                              />
                            ) : editingStudentId === row.studentId ? (
                              <input
                                type="number"
                                min={0}
                                max={10}
                                step="0.5"
                                disabled={isSaving}
                                value={draftValues.presentation}
                                onChange={(e) => setDraftValues((v) => ({ ...v, presentation: e.target.value }))}
                                aria-label={`Presentation mark for ${row.fullName}`}
                                className="h-7 w-14 rounded border border-slate-300 bg-white px-1 text-center font-mono text-xs text-slate-900"
                              />
                            ) : (
                              formatMark(m?.presentation)
                            )}
                          </td>

                          {/* RAT /15 */}
                          <td className="px-2.5 py-2.5 text-center font-mono font-medium text-slate-800 tabular-nums">
                            {bulkEditMode && bulkRow ? (
                              <input
                                type="number"
                                min={0}
                                max={15}
                                step="0.5"
                                data-bulk-row={idx}
                                data-bulk-col="rat"
                                disabled={isSaving}
                                value={bulkRow.rat}
                                onChange={(e) =>
                                  updateBulkDraft(row.studentId, m, isCatAbsent, { rat: e.target.value })
                                }
                                onKeyDown={(e) => handleBulkKeyDown(e, idx, 'rat')}
                                onPaste={(e) => handleBulkPaste(e, idx, 'rat', 'all')}
                                aria-label={`RAT mark for ${row.fullName}`}
                                className={bulkInputClass('rat')}
                              />
                            ) : editingStudentId === row.studentId ? (
                              <input
                                type="number"
                                min={0}
                                max={15}
                                step="0.5"
                                disabled={isSaving}
                                value={draftValues.rat}
                                onChange={(e) => setDraftValues((v) => ({ ...v, rat: e.target.value }))}
                                aria-label={`RAT mark for ${row.fullName}`}
                                className="h-7 w-14 rounded border border-slate-300 bg-white px-1 text-center font-mono text-xs text-slate-900"
                              />
                            ) : (
                              formatMark(m?.rat)
                            )}
                          </td>

                          {/* CAT /15 */}
                          <td className="px-2.5 py-2.5 text-center font-mono font-medium tabular-nums border-r border-slate-200">
                            {bulkEditMode && bulkRow ? (
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={15}
                                  step="0.5"
                                  data-bulk-row={idx}
                                  data-bulk-col="cat"
                                  disabled={bulkRow.catAbsent || isSaving}
                                  value={bulkRow.cat}
                                  onChange={(e) =>
                                    updateBulkDraft(row.studentId, m, isCatAbsent, { cat: e.target.value })
                                  }
                                  onKeyDown={(e) => handleBulkKeyDown(e, idx, 'cat')}
                                  onPaste={(e) => handleBulkPaste(e, idx, 'cat', 'all')}
                                  aria-label={`CAT mark for ${row.fullName}`}
                                  className={bulkInputClass('cat', true)}
                                />
                                <label className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={bulkRow.catAbsent}
                                    disabled={isSaving}
                                    onChange={(e) =>
                                      updateBulkDraft(row.studentId, m, isCatAbsent, {
                                        catAbsent: e.target.checked,
                                        cat: e.target.checked ? '' : bulkRow.cat,
                                      })
                                    }
                                  />
                                  AB
                                </label>
                              </div>
                            ) : editingStudentId === row.studentId ? (
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={15}
                                  step="0.5"
                                  disabled={draftValues.catAbsent || isSaving}
                                  value={draftValues.cat}
                                  onChange={(e) => setDraftValues((v) => ({ ...v, cat: e.target.value }))}
                                  aria-label={`CAT mark for ${row.fullName}`}
                                  className="h-7 w-14 rounded border border-amber-400 bg-white px-1 text-center font-mono text-xs text-slate-900 disabled:bg-slate-100"
                                />
                                <label className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={draftValues.catAbsent}
                                    disabled={isSaving}
                                    onChange={(e) => setDraftValues((v) => ({ ...v, catAbsent: e.target.checked }))}
                                  />
                                  AB
                                </label>
                              </div>
                            ) : isCatAbsent ? (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                                AB
                              </span>
                            ) : row.hasCatMark ? (
                              <span className="text-slate-800 font-semibold">{formatMark(m?.cat)}</span>
                            ) : (
                              <span className="inline-block whitespace-nowrap rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200" title="CAT mark not entered yet">
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Exam /70 */}
                          <td className="px-2.5 py-2.5 text-center font-mono font-medium tabular-nums border-r border-slate-200">
                            {bulkEditMode && bulkRow ? (
                              <input
                                type="number"
                                min={0}
                                max={70}
                                step="0.5"
                                data-bulk-row={idx}
                                data-bulk-col="exam"
                                disabled={isSaving}
                                value={bulkRow.exam}
                                onChange={(e) =>
                                  updateBulkDraft(row.studentId, m, isCatAbsent, { exam: e.target.value })
                                }
                                onKeyDown={(e) => handleBulkKeyDown(e, idx, 'exam')}
                                onPaste={(e) => handleBulkPaste(e, idx, 'exam', 'all')}
                                aria-label={`Exam mark for ${row.fullName}`}
                                className={bulkInputClass('exam')}
                              />
                            ) : editingStudentId === row.studentId ? (
                              <input
                                type="number"
                                min={0}
                                max={70}
                                step="0.5"
                                disabled={isSaving}
                                value={draftValues.exam}
                                onChange={(e) => setDraftValues((v) => ({ ...v, exam: e.target.value }))}
                                aria-label={`Exam mark for ${row.fullName}`}
                                className="h-7 w-14 rounded border border-slate-300 bg-white px-1 text-center font-mono text-xs text-slate-900"
                              />
                            ) : isAbsent ? (
                              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-900 border border-rose-300">
                                AB
                              </span>
                            ) : (
                              <span className="text-slate-900 font-bold">{formatMark(m?.exam)}</span>
                            )}
                          </td>

                          {/* Total /100 — GOLDEN YELLOW SHADE COLUMN */}
                          <td className="px-2.5 py-2.5 text-center bg-amber-50/70 border-x border-amber-200/90">
                            {isAbsent ? (
                              <span className="text-[11px] font-bold text-rose-700">AB</span>
                            ) : m?.total !== null && m?.total !== undefined ? (
                              <span className="text-xs font-black text-amber-950 font-mono tabular-nums">
                                {formatMark(m.total)}
                              </span>
                            ) : (
                              <span className="text-amber-300/80 font-light">—</span>
                            )}
                          </td>

                          {/* Grade */}
                          <td className="px-3 py-2.5 text-center whitespace-nowrap bg-amber-50/30">
                            {isAbsent ? (
                              <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                ABSENT
                              </span>
                            ) : m?.grade ? (
                              <span
                                className={`inline-block rounded px-2 py-0.5 text-[10px] ${getGradeBadgeClass(
                                  m.grade,
                                )}`}
                              >
                                {m.grade}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          {/* CAT Mark — GOLDEN YELLOW SHADE */}
                          <td className="px-3 py-2.5 text-center bg-amber-50/70 border-x border-amber-200/90">
                            {bulkEditMode && bulkRow ? (
                              <div className="inline-flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  max={15}
                                  step="0.5"
                                  data-bulk-row={idx}
                                  data-bulk-col="cat"
                                  disabled={bulkRow.catAbsent || isSaving}
                                  value={bulkRow.cat}
                                  onChange={(e) =>
                                    updateBulkDraft(row.studentId, m, isCatAbsent, { cat: e.target.value })
                                  }
                                  onKeyDown={(e) => handleBulkKeyDown(e, idx, 'cat')}
                                  onPaste={(e) => handleBulkPaste(e, idx, 'cat', 'cat')}
                                  placeholder="0–15"
                                  aria-label={`CAT mark for ${row.fullName}`}
                                  className={bulkInputClass('cat', true)}
                                />
                                <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={bulkRow.catAbsent}
                                    disabled={isSaving}
                                    onChange={(e) =>
                                      updateBulkDraft(row.studentId, m, isCatAbsent, {
                                        catAbsent: e.target.checked,
                                        cat: e.target.checked ? '' : bulkRow.cat,
                                      })
                                    }
                                    className="rounded border-slate-300"
                                  />
                                  AB
                                </label>
                              </div>
                            ) : editingStudentId === row.studentId ? (
                              <div className="inline-flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  max={15}
                                  step="0.5"
                                  disabled={draftValues.catAbsent || isSaving}
                                  value={draftValues.cat}
                                  onChange={(e) => setDraftValues((v) => ({ ...v, cat: e.target.value }))}
                                  placeholder="0–15"
                                  aria-label={`CAT mark for ${row.fullName}`}
                                  className="h-7 w-16 rounded border border-amber-400 bg-white px-1.5 text-center font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100 disabled:text-slate-400"
                                />
                                <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={draftValues.catAbsent}
                                    disabled={isSaving}
                                    onChange={(e) => setDraftValues((v) => ({ ...v, catAbsent: e.target.checked }))}
                                    className="rounded border-slate-300"
                                  />
                                  AB
                                </label>
                              </div>
                            ) : isAbsent || isCatAbsent ? (
                              <span className="text-[11px] font-bold text-rose-700">AB</span>
                            ) : m?.cat !== null && m?.cat !== undefined ? (
                              <span className="text-xs font-black text-amber-950 font-mono tabular-nums">
                                {formatMark(m.cat)}
                              </span>
                            ) : (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Grade */}
                          <td className="px-3 py-2.5 text-center whitespace-nowrap bg-amber-50/30">
                            {m?.grade ? (
                              <span
                                className={`inline-block rounded px-2 py-0.5 text-[10px] ${getGradeBadgeClass(
                                  m.grade,
                                )}`}
                              >
                                {m.grade}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            {isAbsent ? (
                              <span className="inline-block rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                                Absent (AB)
                              </span>
                            ) : (
                              <span className="inline-block rounded bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                Expected / Sat
                              </span>
                            )}
                          </td>
                        </>
                      )}
                      </tr>
                      {isEditingThisRow ? (
                        <tr className="bg-emerald-50/80 border-b border-emerald-200 print:hidden">
                          <td colSpan={assessmentType === 'exam' ? 10 : 6} className="px-3 py-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-emerald-950">
                                Editing {row.fullName} ({row.admissionNumber})
                              </span>
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => saveEditingRow(row.studentId, assessmentType === 'exam' ? 'all' : 'cat')}
                                  className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-emerald-600 px-2.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                                >
                                  <Save className="size-3 shrink-0" />
                                  <span>{isSaving ? 'Saving...' : 'Save'}</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={cancelEditingRow}
                                  className="inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>

            {/* Table Footer: Class Average */}
            {stats.markedCandidates > 0 ? (
              <tfoot className="border-t-2 border-slate-300 bg-slate-100/90 font-bold text-slate-800">
                <tr>
                  <td colSpan={3} className="px-3.5 py-3 text-right uppercase tracking-wider text-[11px] text-slate-700 font-extrabold border-r-2 border-slate-300 whitespace-nowrap">
                    Class Average ({stats.markedCandidates} candidates):
                  </td>

                  {assessmentType === 'exam' ? (
                    <>
                      <td className="px-2.5 py-3 text-center text-slate-800 font-mono tabular-nums">
                        {formatMark(stats.meanAssignment)}
                      </td>
                      <td className="px-2.5 py-3 text-center text-slate-800 font-mono tabular-nums">
                        {formatMark(stats.meanPresentation)}
                      </td>
                      <td className="px-2.5 py-3 text-center text-slate-800 font-mono tabular-nums">
                        {formatMark(stats.meanRat)}
                      </td>
                      <td className="px-2.5 py-3 text-center text-slate-800 font-mono tabular-nums border-r border-slate-200">
                        {formatMark(stats.meanCat)}
                      </td>
                      <td className="px-2.5 py-3 text-center text-slate-900 font-mono font-black border-r border-slate-200">
                        {formatMark(stats.meanExam)}
                      </td>
                      {/* Golden Yellow Highlight on Total Average */}
                      <td className="px-2.5 py-3 text-center bg-amber-200/80 border-x border-amber-300 font-black text-amber-950 font-mono text-xs tabular-nums shadow-2xs">
                        {formatMark(stats.meanTotal)}
                      </td>
                      <td className="px-3 py-3 text-center text-[10px] text-slate-700 bg-amber-50/40 font-bold">
                        {stats.meanTotal !== null
                          ? stats.meanTotal >= 75
                            ? 'DISTINCTION'
                            : stats.meanTotal >= 65
                            ? 'CREDIT'
                            : stats.meanTotal >= passMark
                            ? 'PASS'
                            : 'REFER'
                          : '—'}
                      </td>
                    </>
                  ) : (
                    <>
                      {/* Golden Yellow Highlight on CAT Average */}
                      <td className="px-3 py-3 text-center bg-amber-200/80 border-x border-amber-300 font-black text-amber-950 font-mono text-xs tabular-nums shadow-2xs">
                        {formatMark(stats.meanCat)}
                      </td>
                      <td colSpan={2} className="px-3 py-3 text-center text-[10px] text-slate-600 bg-amber-50/40 font-bold">
                        {stats.passRate !== null ? `${stats.passRate}% Passed` : '—'}
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            ) : null}
          </table>
        )}
      </div>
    </section>
  );
}
