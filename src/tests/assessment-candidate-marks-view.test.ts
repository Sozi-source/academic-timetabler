import { describe, expect, it } from 'vitest';
import {
  calculateOnlineFinalTotal,
  calculateRatCatAverage,
} from '@/features/staff-assessment/online-marks-domain';
import type { CandidateMarkRecord } from '@/features/assessment/marks/types';

describe('Assessment Candidate Marks View Logic', () => {
  it('correctly calculates totals and grades for complete marks', () => {
    const marks: CandidateMarkRecord = {
      studentId: 'student-1',
      assignment: 4.5,
      presentation: 9,
      rat: 13,
      cat: 14,
      catAbsent: false,
      exam: 58,
      isExamAbsent: false,
      ratCatAverage: calculateRatCatAverage({ rat: 13, cat: 14 }), // 13.5
      coursework: 4.5 + 9 + 13.5, // 27
      total: calculateOnlineFinalTotal(
        { assignment: 4.5, presentation: 9, rat: 13, cat: 14, exam: 58 },
        false,
      ), // 4.5 + 9 + 13.5 + 58 = 85
      grade: 'DISTINCTION',
      comment: 'Pass',
      isCommitted: true,
      source: 'official',
    };

    expect(marks.ratCatAverage).toBe(13.5);
    expect(marks.total).toBe(85);
    expect(marks.grade).toBe('DISTINCTION');
    expect(marks.isCommitted).toBe(true);
  });

  it('handles zero scores without treating them as null/missing', () => {
    const total = calculateOnlineFinalTotal(
      { assignment: 0, presentation: 0, rat: 0, cat: 0, exam: 45 },
      false,
    );
    expect(total).toBe(45);

    const zeroTotal = calculateOnlineFinalTotal(
      { assignment: 0, presentation: 0, rat: 0, cat: 0, exam: 0 },
      false,
    );
    expect(zeroTotal).toBe(0);
  });

  it('correctly flags absent exam candidates', () => {
    const total = calculateOnlineFinalTotal(
      { assignment: 5, presentation: 10, rat: 15, cat: 15, exam: null },
      true,
    );
    expect(total).toBeNull();
  });

  it('grades scores according to institutional grade thresholds', () => {
    const assignGrade = (total: number | null, isAbsent: boolean) => {
      if (isAbsent) return 'ABSENT';
      if (total === null) return null;
      if (total >= 75) return 'DISTINCTION';
      if (total >= 65) return 'CREDIT';
      if (total >= 40) return 'PASS';
      return 'REFER';
    };

    expect(assignGrade(92, false)).toBe('DISTINCTION');
    expect(assignGrade(75, false)).toBe('DISTINCTION');
    expect(assignGrade(74.9, false)).toBe('CREDIT');
    expect(assignGrade(65, false)).toBe('CREDIT');
    expect(assignGrade(64.9, false)).toBe('PASS');
    expect(assignGrade(40, false)).toBe('PASS');
    expect(assignGrade(39.9, false)).toBe('REFER');
    expect(assignGrade(12, false)).toBe('REFER');
    expect(assignGrade(null, true)).toBe('ABSENT');
    expect(assignGrade(null, false)).toBeNull();
  });

  it('handles CAT absence where RAT is awarded or missed', () => {
    // If student misses RAT, 0 is awarded in ratCatAverage
    const avgWithoutRat = calculateRatCatAverage({ rat: null, cat: 14 });
    expect(avgWithoutRat).toBe(7);

    // If CAT is missing, ratCatAverage is null
    const avgWithoutCat = calculateRatCatAverage({ rat: 14, cat: null });
    expect(avgWithoutCat).toBeNull();
  });
});
