import { describe, expect, it } from 'vitest';
import { canCompleteClassAttendance } from '@/features/class-attendance/domain';
import type { ClassAttendanceStatus } from '@/features/class-attendance/types';
import { isAssessmentPopulationEditable } from '@/features/assessment/domain';

interface OnlineMarkEntry {
  assignment: number | null; // /5
  presentation: number | null; // /10
  rat: number | null; // /15
  cat: number | null; // /15
  exam: number | null; // /70
}

function validateAndComputeOnlineMarks(entry: OnlineMarkEntry) {
  const { assignment, presentation, rat, cat, exam } = entry;

  // 1. Boundary checks
  if (assignment !== null && (assignment < 0 || assignment > 5)) {
    return { valid: false, error: 'Assignment mark must be between 0 and 5.' };
  }
  if (presentation !== null && (presentation < 0 || presentation > 10)) {
    return { valid: false, error: 'Presentation mark must be between 0 and 10.' };
  }
  if (rat !== null && (rat < 0 || rat > 15)) {
    return { valid: false, error: 'RAT mark must be between 0 and 15.' };
  }
  if (cat !== null && (cat < 0 || cat > 15)) {
    return { valid: false, error: 'CAT mark must be between 0 and 15.' };
  }
  if (exam !== null && (exam < 0 || exam > 70)) {
    return { valid: false, error: 'Exam mark must be between 0 and 70.' };
  }

  // 2. Compute components
  const hasCoursework = assignment !== null && presentation !== null && rat !== null && cat !== null;
  const hasExam = exam !== null;

  if (!hasCoursework && !hasExam) {
    return { valid: true, total: null, isComplete: false };
  }

  const ratCatAverage = rat !== null && cat !== null ? (rat + cat) / 2 : 0;
  const coursework = (assignment ?? 0) + (presentation ?? 0) + ratCatAverage;
  const total = coursework + (exam ?? 0);

  return {
    valid: true,
    coursework: Math.round(coursework * 100) / 100,
    total: Math.round(total * 100) / 100,
    isComplete: hasCoursework && hasExam,
  };
}

describe('Production QA: RLS & Mutation Guards', () => {
  describe('Class Attendance Mutation Guards', () => {
    it('blocks session completion when any student remains unmarked', () => {
      const incompleteRoster: ClassAttendanceStatus[] = ['present', 'unmarked', 'absent'];
      expect(canCompleteClassAttendance(incompleteRoster)).toBe(false);

      const completeRoster: ClassAttendanceStatus[] = ['present', 'present', 'absent'];
      expect(canCompleteClassAttendance(completeRoster)).toBe(true);
    });

    it('rejects empty rosters from completion', () => {
      expect(canCompleteClassAttendance([])).toBe(false);
    });
  });

  describe('Assessment Population Lock Guards', () => {
    it('allows population edits during draft, generated, and open states', () => {
      expect(isAssessmentPopulationEditable('draft')).toBe(true);
      expect(isAssessmentPopulationEditable('generated')).toBe(true);
      expect(isAssessmentPopulationEditable('open')).toBe(true);
    });

    it('strictly locks population once marks are submitted, finalised, or archived', () => {
      expect(isAssessmentPopulationEditable('submitted')).toBe(false);
      expect(isAssessmentPopulationEditable('finalised')).toBe(false);
      expect(isAssessmentPopulationEditable('archived')).toBe(false);
    });
  });

  describe('Online Marks Grading Formula & Bounds Guard', () => {
    it('computes Assignment(5) + Presentation(10) + AVG(RAT 15, CAT 15) + Exam(70) = 100', () => {
      const studentMarks: OnlineMarkEntry = {
        assignment: 4.5, // out of 5
        presentation: 9.0, // out of 10
        rat: 14.0, // out of 15
        cat: 12.0, // out of 15 -> AVG(14, 12) = 13.0
        exam: 58.0, // out of 70
      };

      const result = validateAndComputeOnlineMarks(studentMarks);
      expect(result.valid).toBe(true);
      expect(result.isComplete).toBe(true);
      // Coursework = 4.5 + 9.0 + 13.0 = 26.5 / 30
      expect(result.coursework).toBe(26.5);
      // Total = 26.5 + 58.0 = 84.5 / 100
      expect(result.total).toBe(84.5);
    });

    it('rejects invalid marks that exceed component maximums', () => {
      expect(
        validateAndComputeOnlineMarks({
          assignment: 6, // max 5
          presentation: 8,
          rat: 10,
          cat: 10,
          exam: 50,
        }).valid
      ).toBe(false);

      expect(
        validateAndComputeOnlineMarks({
          assignment: 4,
          presentation: 12, // max 10
          rat: 10,
          cat: 10,
          exam: 50,
        }).valid
      ).toBe(false);

      expect(
        validateAndComputeOnlineMarks({
          assignment: 4,
          presentation: 8,
          rat: 18, // max 15
          cat: 10,
          exam: 50,
        }).valid
      ).toBe(false);

      expect(
        validateAndComputeOnlineMarks({
          assignment: 4,
          presentation: 8,
          rat: 10,
          cat: 10,
          exam: 75, // max 70
        }).valid
      ).toBe(false);
    });
  });
});
