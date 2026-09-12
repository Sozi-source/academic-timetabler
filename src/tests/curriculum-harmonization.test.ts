import { describe, expect, it } from 'vitest';
import {
  findCanonicalCurriculum,
  getAllCurriculumUnits,
  getUnitCurriculum,
  MASTER_CURRICULUM_REGISTRY,
} from '@/features/teaching-documents/curriculum-registry';
import {
  generateTVETCourseOutline,
  generateTVETSchemeOfWork,
  type TVETDocumentHeaderContext,
} from '@/features/teaching-documents/tvet-standards';

describe('Authoritative TVET KNEC Curriculum & Shared CND/DND Harmonization', () => {
  describe('Master Curriculum Completeness', () => {
    it('contains all 43 canonical curriculum units across Modules I, II, and III', () => {
      const allUnits = getAllCurriculumUnits();
      expect(allUnits).toHaveLength(43);

      const m1Units = allUnits.filter((u) => u.moduleNumber === 1);
      const m2Units = allUnits.filter((u) => u.moduleNumber === 2);
      const m3Units = allUnits.filter((u) => u.moduleNumber === 3);

      expect(m1Units).toHaveLength(19);
      expect(m2Units).toHaveLength(12);
      expect(m3Units).toHaveLength(12);
    });

    it('validates that every canonical unit has complete 14-week schedule, competencies, and references', () => {
      const allUnits = getAllCurriculumUnits();

      for (const unit of allUnits) {
        expect(unit.canonicalKey).toBeTruthy();
        expect(unit.syllabusCode).toBeTruthy();
        expect(unit.unitName).toBeTruthy();
        expect(unit.nominalHours).toBeGreaterThan(0);
        expect(unit.unitDescription).toBeTruthy();
        expect(unit.overallCompetency).toBeTruthy();
        expect(unit.learningOutcomes?.length).toBeGreaterThan(0);
        expect(unit.references?.length).toBeGreaterThan(0);
        expect(unit.weeklySchedule && unit.weeklySchedule.length >= 12).toBe(true);

        for (const week of unit.weeklySchedule!) {
          expect(week.weekNumber).toBeGreaterThanOrEqual(1);
          expect(week.weekNumber).toBeLessThanOrEqual(14);
          expect(week.topicTitle).toBeTruthy();
          expect(week.subTopics.length).toBeGreaterThan(0);
          expect(week.specificLearningOutcomes).toBeTruthy();
          expect(week.learningActivities).toBeTruthy();
        }
      }
    });
  });

  describe('Shared Unit Resolution (CND <-> DND Unified Resources)', () => {
    it('resolves Diet Therapy I identically for CND 1202 and DND 1202', () => {
      const cndCurriculum = getUnitCurriculum('CND 1202', 'Diet Therapy I');
      const dndCurriculum = getUnitCurriculum('DND 1202', 'Diet Therapy I');

      expect(cndCurriculum.overallCompetency).toBe(dndCurriculum.overallCompetency);
      expect(cndCurriculum.unitDescription).toBe(dndCurriculum.unitDescription);
      expect(cndCurriculum.weeklySchedule?.map((w) => w.topicTitle)).toEqual(
        dndCurriculum.weeklySchedule?.map((w) => w.topicTitle)
      );
      expect(cndCurriculum.references).toEqual(dndCurriculum.references);
    });

    it('resolves Nutrition in Emergencies identically for CND 2301 and DND 2301', () => {
      const cndCurriculum = getUnitCurriculum('CND 2301', 'Nutrition in Emergencies');
      const dndCurriculum = getUnitCurriculum('DND 2301', 'Nutrition in Emergencies');

      expect(cndCurriculum.overallCompetency).toBe(dndCurriculum.overallCompetency);
      expect(cndCurriculum.learningOutcomes).toEqual(dndCurriculum.learningOutcomes);
      expect(cndCurriculum.weeklySchedule?.map((w) => w.topicTitle)).toEqual(
        dndCurriculum.weeklySchedule?.map((w) => w.topicTitle)
      );
    });

    it('resolves Nutrition Assessment identically for CND 2302 and DND 2302', () => {
      const cndCurriculum = getUnitCurriculum('CND 2302', 'Nutrition Assessment and Surveillance');
      const dndCurriculum = getUnitCurriculum('DND 2302', 'Nutrition Assessment and Surveillance');

      expect(cndCurriculum.overallCompetency).toBe(dndCurriculum.overallCompetency);
      expect(cndCurriculum.weeklySchedule?.map((w) => w.topicTitle)).toEqual(
        dndCurriculum.weeklySchedule?.map((w) => w.topicTitle)
      );
    });

    it('resolves Food Safety and Hygiene identically for CND 1203 and DND 1203', () => {
      const cndCurriculum = getUnitCurriculum('CND 1203', 'Food Safety and Hygiene');
      const dndCurriculum = getUnitCurriculum('DND 1203', 'Food Safety and Hygiene');

      expect(cndCurriculum.overallCompetency).toBe(dndCurriculum.overallCompetency);
      expect(cndCurriculum.weeklySchedule?.map((w) => w.topicTitle)).toEqual(
        dndCurriculum.weeklySchedule?.map((w) => w.topicTitle)
      );
    });

    it('resolves ICT identically for CND 1201 and DND 1201', () => {
      const cndCurriculum = getUnitCurriculum('CND 1201', 'Information Communication Technology');
      const dndCurriculum = getUnitCurriculum('DND 1201', 'Information Communication Technology');

      expect(cndCurriculum.overallCompetency).toBe(dndCurriculum.overallCompetency);
      expect(cndCurriculum.weeklySchedule?.map((w) => w.topicTitle)).toEqual(
        dndCurriculum.weeklySchedule?.map((w) => w.topicTitle)
      );
    });
  });

  describe('Teaching Document Generation with Harmonized Curriculum', () => {
    it('generates consistent Course Outlines and Schemes of Work for CND and DND shared allocations', () => {
      const cndHeader: TVETDocumentHeaderContext = {
        institutionName: 'Academic Planner TVET College',
        departmentName: 'Health Sciences',
        academicPeriodName: 'Jan - Apr 2026',
        unitCode: 'CND 1202',
        unitName: 'Diet Therapy I',
        cohortName: 'CND Jan 2026',
        trainerName: 'Dr. Sarah Mutua',
        totalNominalHours: 66,
        weeklyHours: 5,
      };

      const dndHeader: TVETDocumentHeaderContext = {
        institutionName: 'Academic Planner TVET College',
        departmentName: 'Health Sciences',
        academicPeriodName: 'Jan - Apr 2026',
        unitCode: 'DND 1202',
        unitName: 'Diet Therapy I',
        cohortName: 'DND Jan 2026',
        trainerName: 'Dr. Sarah Mutua',
        totalNominalHours: 66,
        weeklyHours: 5,
      };

      const cndOutline = generateTVETCourseOutline(cndHeader);
      const dndOutline = generateTVETCourseOutline(dndHeader);

      // Shared topics and competencies must match exactly
      expect(cndOutline.overallCompetency).toBe(dndOutline.overallCompetency);
      expect(cndOutline.weeklySchedule.map((w) => w.topicTitle)).toEqual(
        dndOutline.weeklySchedule.map((w) => w.topicTitle)
      );
      expect(cndOutline.weeklySchedule[0].topicTitle).toContain('Introduction to Diet Therapy');

      const cndScheme = generateTVETSchemeOfWork(cndHeader);
      const dndScheme = generateTVETSchemeOfWork(dndHeader);

      expect(cndScheme.plannedWeeks.map((w) => w.topic)).toEqual(
        dndScheme.plannedWeeks.map((w) => w.topic)
      );
      expect(cndScheme.plannedWeeks.map((w) => w.subTopics)).toEqual(
        dndScheme.plannedWeeks.map((w) => w.subTopics)
      );
    });
  });
});
