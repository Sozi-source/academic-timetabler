import { describe, expect, it } from 'vitest';
import {
  computeRecordOfWorkSummary,
  generateTVETCourseOutline,
  generateTVETSchemeOfWork,
  type TVETDocumentHeaderContext,
  type TVETRecordOfWorkEntry,
} from '@/features/teaching-documents/tvet-standards';
import {
  getUnitCurriculum,
  registerUnitCurriculum,
} from '@/features/teaching-documents/curriculum-registry';

const mockHeader: TVETDocumentHeaderContext = {
  institutionName: 'Academic Planner TVET College',
  departmentName: 'Health Sciences',
  academicPeriodName: 'Jan - Apr 2026',
  unitCode: 'NUTR 101',
  unitName: 'Principles of Human Nutrition',
  cohortName: 'DND 2026 Jan',
  trainerName: 'Dr. Jane Mwangi',
  trainerEmail: 'j.mwangi@college.ac.ke',
  totalNominalHours: 56,
  weeklyHours: 4,
};

describe('TVET Standardised Teaching Documents Suite', () => {
  describe('Standardised TVET Course Outline', () => {
    it('generates dynamic header metadata accurately', () => {
      const outline = generateTVETCourseOutline(mockHeader);

      expect(outline.header.institutionName).toBe('Academic Planner TVET College');
      expect(outline.header.unitCode).toBe('NUTR 101');
      expect(outline.header.unitName).toBe('Principles of Human Nutrition');
      expect(outline.header.trainerName).toBe('Dr. Jane Mwangi');
      expect(outline.header.cohortName).toBe('DND 2026 Jan');
    });

    it('generates a 14-week topical curriculum schedule', () => {
      const outline = generateTVETCourseOutline(mockHeader);

      expect(outline.weeklySchedule).toHaveLength(14);
      expect(outline.weeklySchedule[0].weekNumber).toBe(1);
      expect(outline.weeklySchedule[13].weekNumber).toBe(14);

      // Verify total hours match nominal contact hours (14 * 4 = 56)
      const totalHours = outline.weeklySchedule.reduce((sum, w) => sum + w.hours, 0);
      expect(totalHours).toBe(56);
    });

    it('enforces the exact TVET 5-component assessment breakdown totaling 100%', () => {
      const outline = generateTVETCourseOutline(mockHeader);
      const matrix = outline.assessmentMatrix;

      expect(matrix.continuousAssessment.assignment).toBe(5);
      expect(matrix.continuousAssessment.presentation).toBe(10);
      expect(matrix.continuousAssessment.rat).toBe(15);
      expect(matrix.continuousAssessment.cat).toBe(15);
      expect(matrix.continuousAssessment.courseworkWeightedTotal).toBe(30);

      expect(matrix.finalExamination).toBe(70);
      expect(matrix.finalTotal).toBe(100);
    });
  });

  describe('Curriculum Registry & Real Document Seeding', () => {
    it('retrieves pre-seeded real unit curriculum (CND 1101 Anatomy)', () => {
      const anatomyHeader: TVETDocumentHeaderContext = {
        institutionName: 'Academic Planner TVET College',
        departmentName: 'Health Sciences',
        academicPeriodName: 'Jan - Apr 2026',
        unitCode: 'CND 1101',
        unitName: 'Human Anatomy and Physiology',
        cohortName: 'CND 2026 Jan',
        trainerName: 'Dr. Peter Ochieng',
        totalNominalHours: 56,
        weeklyHours: 4,
      };

      const outline = generateTVETCourseOutline(anatomyHeader);

      // Verify that specific seeded anatomy topics were loaded
      expect(outline.weeklySchedule[0].topicTitle).toContain('Cellular Biology');
      expect(outline.weeklySchedule[2].topicTitle).toContain('Cardiovascular System');
      expect(outline.weeklySchedule[5].topicTitle).toContain('Respiratory System');
      expect(outline.weeklySchedule[6].topicTitle).toContain('Digestive System');
      expect(outline.references[0]).toContain('Ross & Wilson');
    });

    it('allows dynamically registering and retrieving new custom unit seeds', () => {
      registerUnitCurriculum({
        unitCode: 'PHARM 201',
        unitName: 'Pharmacology and Therapeutics',
        unitDescription: 'Comprehensive study of pharmacokinetics and pharmacodynamics.',
        overallCompetency: 'Administer and calculate therapeutic drug dosages safely.',
        learningOutcomes: ['Explain drug absorption and elimination mechanisms.'],
      });

      const pharm = getUnitCurriculum('PHARM 201', 'Pharmacology and Therapeutics');
      expect(pharm.unitName).toBe('Pharmacology and Therapeutics');
      expect(pharm.overallCompetency).toContain('therapeutic drug dosages');
    });
  });

  describe('Standardised TVET Scheme of Work / Lesson Plan', () => {
    it('generates a 14-week lesson plan matrix with outcomes and assessment strategies', () => {
      const scheme = generateTVETSchemeOfWork(mockHeader);

      expect(scheme.plannedWeeks).toHaveLength(14);

      // Check specific milestone weeks
      const week5RAT = scheme.plannedWeeks.find((w) => w.weekNumber === 5);
      expect(week5RAT?.assessmentAndRemarks).toContain('RAT');

      const week8CAT = scheme.plannedWeeks.find((w) => w.weekNumber === 8);
      expect(week8CAT?.assessmentAndRemarks).toContain('CAT');

      const week14Exam = scheme.plannedWeeks.find((w) => w.weekNumber === 14);
      expect(week14Exam?.assessmentAndRemarks).toContain('Final Examination');
    });
  });

  describe('Interactive Record of Work Covered', () => {
    it('computes completion percentages based on delivered unique weeks', () => {
      const entries: TVETRecordOfWorkEntry[] = [
        {
          id: '1',
          allocationId: 'alloc-1',
          weekNumber: 1,
          sessionDate: '2026-01-12',
          workCovered: 'Unit Introduction & Safety',
          outcomesAchieved: 'Understood safety guidelines',
          attendanceSummary: '28/30',
          remarks: 'Completed',
          trainerSignature: 'Dr. Jane Mwangi',
          signedAt: '2026-01-12T10:00:00Z',
          hodStatus: 'pending',
        },
        {
          id: '2',
          allocationId: 'alloc-1',
          weekNumber: 2,
          sessionDate: '2026-01-19',
          workCovered: 'Fundamental Nutrition',
          outcomesAchieved: 'Nutrient categories classified',
          attendanceSummary: '29/30',
          remarks: 'Completed',
          trainerSignature: 'Dr. Jane Mwangi',
          signedAt: '2026-01-19T10:00:00Z',
          hodStatus: 'pending',
        },
        {
          id: '3',
          allocationId: 'alloc-1',
          weekNumber: 2, // Second session in Week 2
          sessionDate: '2026-01-21',
          workCovered: 'Practical food tests',
          outcomesAchieved: 'Conducted Benedicts test',
          attendanceSummary: '30/30',
          remarks: 'Completed lab work',
          trainerSignature: 'Dr. Jane Mwangi',
          signedAt: '2026-01-21T10:00:00Z',
          hodStatus: 'pending',
        },
      ];

      const summary = computeRecordOfWorkSummary(mockHeader, entries, 14);

      // 2 unique weeks delivered (Week 1 and Week 2) out of 14 weeks = 14% completion
      expect(summary.completedWeeksCount).toBe(2);
      expect(summary.syllabusCompletionRate).toBe(14);
      expect(summary.entries).toHaveLength(3);
    });

    it('handles empty records of work cleanly', () => {
      const summary = computeRecordOfWorkSummary(mockHeader, [], 14);

      expect(summary.completedWeeksCount).toBe(0);
      expect(summary.syllabusCompletionRate).toBe(0);
      expect(summary.entries).toHaveLength(0);
    });
  });
});
