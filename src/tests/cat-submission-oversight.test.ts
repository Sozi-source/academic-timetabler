import { describe, expect, it } from 'vitest';
import type { CandidateMarkRecord } from '@/features/assessment/marks/types';

describe('CAT Submission Oversight & Incomplete Markbook Handling', () => {
  interface MockCandidateRow {
    id: string;
    studentId: string;
    admissionNumber: string;
    fullName: string;
    cohortId: string;
    cohortName: string;
    isAbsent: boolean;
    isCatAbsent: boolean;
    hasCatMark: boolean;
    hasExamMark: boolean;
    hasAnyMark: boolean;
    isCatMissing: boolean;
    marks: CandidateMarkRecord | null;
  }

  function createMockRow(params: {
    studentId: string;
    adm: string;
    name: string;
    cohort: string;
    catMark?: number | null;
    examMark?: number | null;
    isCatAbsent?: boolean;
    isExamAbsent?: boolean;
  }): MockCandidateRow {
    const isAbsent = Boolean(params.isExamAbsent);
    const isCatAbsent = Boolean(params.isCatAbsent);
    const hasCatMark = params.catMark !== null && params.catMark !== undefined;
    const hasExamMark = params.examMark !== null && params.examMark !== undefined;
    const hasAnyMark = Boolean(hasCatMark || hasExamMark);
    const isCatMissing = !isAbsent && !isCatAbsent && !hasCatMark;

    const marks: CandidateMarkRecord = {
      studentId: params.studentId,
      assignment: null,
      presentation: null,
      rat: null,
      cat: params.catMark ?? null,
      catAbsent: isCatAbsent,
      exam: params.examMark ?? null,
      isExamAbsent: isAbsent,
      ratCatAverage: null,
      coursework: null,
      total: null, // Total is null prior to exam submission
      grade: null,
      comment: null,
      isCommitted: false,
      source: hasAnyMark ? 'draft' : 'none',
    };

    return {
      id: `row-${params.studentId}`,
      studentId: params.studentId,
      admissionNumber: params.adm,
      fullName: params.name,
      cohortId: 'cohort-1',
      cohortName: params.cohort,
      isAbsent,
      isCatAbsent,
      hasCatMark,
      hasExamMark,
      hasAnyMark,
      isCatMissing,
      marks,
    };
  }

  const sampleRows: MockCandidateRow[] = [
    createMockRow({
      studentId: 's1',
      adm: 'CND/2025/001',
      name: 'Alice Wanjiku',
      cohort: 'CND Jan 2025',
      catMark: 12,
    }),
    createMockRow({
      studentId: 's2',
      adm: 'CND/2025/002',
      name: 'Bob Kiprono',
      cohort: 'CND Jan 2025',
      catMark: null, // Missing CAT mark
    }),
    createMockRow({
      studentId: 's3',
      adm: 'CND/2025/003',
      name: 'Carol Akinyi',
      cohort: 'CND Jan 2025',
      catMark: 14,
    }),
    createMockRow({
      studentId: 's4',
      adm: 'CND/2025/004',
      name: 'David Omondi',
      cohort: 'CND Jan 2025',
      isCatAbsent: true, // Marked Absent
    }),
    createMockRow({
      studentId: 's5',
      adm: 'CND/2025/005',
      name: 'Eve Chebet',
      cohort: 'CND Jan 2025',
      catMark: null, // Missing CAT mark
    }),
  ];

  it('correctly identifies candidates with saved CAT marks vs missing marks vs absent', () => {
    const s1 = sampleRows[0];
    expect(s1.hasCatMark).toBe(true);
    expect(s1.isCatMissing).toBe(false);
    expect(s1.isCatAbsent).toBe(false);

    const s2 = sampleRows[1];
    expect(s2.hasCatMark).toBe(false);
    expect(s2.isCatMissing).toBe(true);
    expect(s2.isCatAbsent).toBe(false);

    const s4 = sampleRows[3];
    expect(s4.hasCatMark).toBe(false);
    expect(s4.isCatMissing).toBe(false);
    expect(s4.isCatAbsent).toBe(true);
  });

  it('filters candidates by CAT Entered status', () => {
    const filtered = sampleRows.filter((r) => r.hasCatMark);
    expect(filtered.map((r) => r.studentId)).toEqual(['s1', 's3']);
  });

  it('filters candidates by CAT Missing status so HOD can notify trainer', () => {
    const missing = sampleRows.filter((r) => r.isCatMissing);
    expect(missing.map((r) => r.studentId)).toEqual(['s2', 's5']);
    expect(missing.map((r) => r.admissionNumber)).toEqual(['CND/2025/002', 'CND/2025/005']);
  });

  it('allows with-marks filtering when only CAT marks exist (even when total is null)', () => {
    // In previous implementation, with-marks checked `total !== null` which failed during CAT entry
    const withMarks = sampleRows.filter((r) => r.hasAnyMark);
    expect(withMarks.map((r) => r.studentId)).toEqual(['s1', 's3']);
  });

  it('computes accurate CAT telemetry (mean CAT, pass rate, entered vs missing)', () => {
    let sumCat = 0;
    let countCat = 0;
    let catPassCount = 0;
    let catMarkedCount = 0;
    let catMissingCount = 0;

    for (const r of sampleRows) {
      if (r.hasCatMark && r.marks?.cat !== null && r.marks?.cat !== undefined) {
        catMarkedCount += 1;
        sumCat += r.marks.cat;
        countCat += 1;
        if (r.marks.cat >= 6) {
          catPassCount += 1;
        }
      } else if (!r.isAbsent && !r.isCatAbsent) {
        catMissingCount += 1;
      }
    }

    expect(catMarkedCount).toBe(2);
    expect(catMissingCount).toBe(2);
    expect(countCat).toBe(2);
    const meanCat = Number((sumCat / countCat).toFixed(1));
    expect(meanCat).toBe(13); // (12 + 14) / 2 = 13.0
    const catPassRate = Math.round((catPassCount / countCat) * 100);
    expect(catPassRate).toBe(100);
  });

  it('formats missing students list cleanly for copying and trainer dispatch', () => {
    const missing = sampleRows
      .filter((r) => r.isCatMissing)
      .map((r) => ({
        admissionNumber: r.admissionNumber,
        fullName: r.fullName,
      }));

    const lines = [
      'Missing CAT Marks: CND1201 - Human Anatomy',
      `Total Pending: ${missing.length} candidate(s)`,
      '',
      ...missing.map((s, idx) => `${idx + 1}. ${s.admissionNumber} - ${s.fullName}`),
      '',
      'Please enter marks for these students to complete CAT submission.',
    ];

    const message = lines.join('\n');
    expect(message).toContain('Total Pending: 2 candidate(s)');
    expect(message).toContain('1. CND/2025/002 - Bob Kiprono');
    expect(message).toContain('2. CND/2025/005 - Eve Chebet');
    expect(message).toContain('Please enter marks for these students to complete CAT submission.');
  });
});
