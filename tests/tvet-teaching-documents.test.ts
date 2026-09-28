import { describe, expect, it } from 'vitest';
import {
  computeRecordOfWorkSummary,
  generateTVETCourseOutline,
  generateTVETSchemeOfWork,
  parseActivitiesList,
  parseResourcesList,
  parseSubTopics,
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

    it('enforces the exact TVET assessment breakdown totaling 100%', () => {
      const outline = generateTVETCourseOutline(mockHeader);
      const matrix = outline.assessmentMatrix;

      expect(matrix.continuousAssessment.cat).toBe(30);
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
      const week8CAT = scheme.plannedWeeks.find((w) => w.weekNumber === 8);
      expect(week8CAT?.assessmentAndRemarks).toContain('CAT');
      expect(week8CAT?.subTopics).toBe('');
      expect(week8CAT?.specificLearningOutcomes).toBe('');

      const week14Exam = scheme.plannedWeeks.find((w) => w.weekNumber === 14);
      expect(week14Exam?.assessmentAndRemarks).toContain('End of Term Examination');
      expect(week14Exam?.subTopics).toBe('');
      expect(week14Exam?.specificLearningOutcomes).toBe('');
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

  describe('Semester Program of Activities & Calendar Milestones Integration', () => {
    it('integrates custom milestones into Scheme of Work and Course Outline', async () => {
      const { mapProgramOfActivitiesToMilestones } = await import(
        '@/features/teaching-documents/program-of-activities/queries'
      );
      const { DEFAULT_PROGRAM_OF_ACTIVITIES } = await import(
        '@/features/teaching-documents/program-of-activities/types'
      );

      const mappedMilestones = mapProgramOfActivitiesToMilestones(DEFAULT_PROGRAM_OF_ACTIVITIES);

      // Verify mapping of CAT week and Exam week
      expect(mappedMilestones.catWeek).toBe(8);
      expect(mappedMilestones.examWeek).toBe(14);

      // Verify Scheme of Work generation respects the milestones
      const scheme = generateTVETSchemeOfWork(mockHeader, undefined, mappedMilestones);
      expect(scheme.plannedWeeks).toHaveLength(14);

      const week8 = scheme.plannedWeeks.find((w) => w.weekNumber === 8);
      expect(week8?.assessmentAndRemarks).toContain('Continuous Assessment Test (CAT)');
      expect(week8?.subTopics).toBe('');
      expect(week8?.specificLearningOutcomes).toBe('');

      const week14 = scheme.plannedWeeks.find((w) => w.weekNumber === 14);
      expect(week14?.assessmentAndRemarks).toContain('End of Term Examination');
      expect(week14?.subTopics).toBe('');
      expect(week14?.specificLearningOutcomes).toBe('');

      // Verify Course Outline schedule respects the milestones
      const outline = generateTVETCourseOutline(mockHeader, undefined, mappedMilestones);
      expect(outline.weeklySchedule).toHaveLength(14);
      const outlineW8 = outline.weeklySchedule.find((w) => w.weekNumber === 8);
      expect(outlineW8?.topicTitle).toContain('CAT');
      expect(outlineW8?.subTopics).toEqual([]);

      const outlineW14 = outline.weeklySchedule.find((w) => w.weekNumber === 14);
      expect(outlineW14?.topicTitle).toContain('Examination');
      expect(outlineW14?.subTopics).toEqual([]);
    });
  });

  describe('Scheme of Work & Course Outline Polish & College Scheduled Dates', () => {
    it('parses subtopics, activities, and resources into discrete lines', () => {
      const subtopics = parseSubTopics('Input devices · Output devices · Central Processing Unit (CPU)');
      expect(subtopics).toEqual(['Input devices', 'Output devices', 'Central Processing Unit (CPU)']);

      const newlineSubtopics = parseSubTopics('Input devices\nOutput devices\nStorage media');
      expect(newlineSubtopics).toEqual(['Input devices', 'Output devices', 'Storage media']);

      const activities = parseActivitiesList('Interactive lecture · Practical demonstration · Group discussion');
      expect(activities).toEqual(['Interactive lecture', 'Practical demonstration', 'Group discussion']);

      const commaActivities = parseActivitiesList('Lecture presentations, group discussions, and laboratory analysis');
      expect(commaActivities).toEqual(['Lecture presentations', 'group discussions', 'laboratory analysis']);

      const resources = parseResourcesList('Course Textbooks · Whiteboard & Markers · Handouts');
      expect(resources).toEqual(['Course Textbooks', 'Whiteboard & Markers', 'Handouts']);
    });

    it('ensures specific learning outcomes start with bold standard lead-in on teaching weeks', () => {
      const scheme = generateTVETSchemeOfWork(mockHeader);
      for (const week of scheme.plannedWeeks) {
        if (week.weekNumber === 8 || week.weekNumber === 14) {
          expect(week.specificLearningOutcomes).toBe('');
          expect(week.subTopics).toBe('');
        } else {
          expect(week.specificLearningOutcomes).toContain('By the end of the lesson/topic, the trainee should be able to:');
        }
      }
    });

    it('applies college-wide CAT and End-Term scheduled dates to all trainer documents', () => {
      const collegeMilestones = {
        catWeek: 8,
        examWeek: 14,
        catRemarks: 'Continuous Assessment Test (CAT)',
        examRemarks: 'End of Term Examination',
        catDate: '9th – 13th June 2026',
        examDate: '20th – 31st July 2026',
      };

      const scheme = generateTVETSchemeOfWork(mockHeader, undefined, collegeMilestones);
      const week8 = scheme.plannedWeeks.find((w) => w.weekNumber === 8);
      const week14 = scheme.plannedWeeks.find((w) => w.weekNumber === 14);

      expect(week8?.assessmentAndRemarks).toContain('Date: 9th – 13th June 2026');
      expect(week14?.assessmentAndRemarks).toContain('Date: 20th – 31st July 2026');

      const outline = generateTVETCourseOutline(mockHeader, undefined, collegeMilestones);
      expect(outline.assessmentApproaches).toContain('9th – 13th June 2026');
      expect(outline.assessmentApproaches).toContain('20th – 31st July 2026');
    });
  });
});

