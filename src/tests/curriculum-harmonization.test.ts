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

    it('validates that verified Module 1 and Module 3 units (31 units) have complete 14-week schedules, competencies, and references', () => {
      const allUnits = getAllCurriculumUnits();
      const verifiedUnits = allUnits.filter((u) => u.moduleNumber === 1 || u.moduleNumber === 3);
      expect(verifiedUnits).toHaveLength(31);

      for (const unit of verifiedUnits) {
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

    it('validates that unverified Module 2 units (12 units) are cleanly purged of broken/synthetic content and marked pending', () => {
      const allUnits = getAllCurriculumUnits();
      const pendingUnits = allUnits.filter((u) => u.moduleNumber === 2);
      expect(pendingUnits).toHaveLength(12);

      for (const unit of pendingUnits) {
        expect(unit.isAvailable).toBe(false);
        expect(unit.weeklySchedule).toHaveLength(0);
        expect(unit.learningOutcomes).toHaveLength(0);
        expect(unit.notReadyMessage).toContain('not yet available');
        expect(unit.unitDescription).toContain('pending');
      }
    });

    it('returns isAvailable: false and notReadyMessage when generating course outline or scheme of work for Food Processing and Preservation', () => {
      const header: TVETDocumentHeaderContext = {
        institutionName: 'Academic Planner TVET College',
        departmentName: 'Nutrition & Dietetics',
        academicPeriodName: 'Jan - Apr 2026',
        unitCode: '24.2.0',
        unitName: 'Principles of Food Processing and Preservation',
        cohortName: 'DND Jan 2026',
        trainerName: 'Mr. Otieno',
        totalNominalHours: 66,
        weeklyHours: 5,
      };

      const outline = generateTVETCourseOutline(header);
      expect(outline.isAvailable).toBe(false);
      expect(outline.weeklySchedule).toHaveLength(0);
      expect(outline.notReadyMessage).toContain('not yet available');

      const scheme = generateTVETSchemeOfWork(header);
      expect(scheme.isAvailable).toBe(false);
      expect(scheme.plannedWeeks).toHaveLength(0);
      expect(scheme.notReadyMessage).toContain('not yet available');
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

  describe('Zero-Hallucination Guardrails & Agricultural Production Isolation', () => {
    it('guarantees Agricultural Production (CHN 2309, DND 3205, CND 2306) does NOT resolve to Food Security or Trade Project', () => {
      const chnAgric = getUnitCurriculum('CHN 2309', 'Agricultural Production');
      expect(chnAgric.isAvailable).toBe(false);
      expect(chnAgric.weeklySchedule).toHaveLength(0);
      expect(chnAgric.unitDescription).not.toContain('Food Security');
      expect(chnAgric.unitDescription).toContain('pending');
      expect(chnAgric.notReadyMessage).toContain('not yet available');

      const dndAgric = getUnitCurriculum('DND 3205', 'Agricultural Production');
      expect(dndAgric.isAvailable).toBe(false);
      expect(dndAgric.weeklySchedule).toHaveLength(0);

      const cndAgric = getUnitCurriculum('CND 2306', 'Agricultural Production');
      expect(cndAgric.isAvailable).toBe(false);
      expect(cndAgric.weeklySchedule).toHaveLength(0);

      // Verify canonical search directly returns undefined
      expect(findCanonicalCurriculum('CHN 2309', 'Agricultural Production')).toBeUndefined();
      expect(findCanonicalCurriculum('DND 3205', 'Agricultural Production')).toBeUndefined();
      expect(findCanonicalCurriculum('CND 2306', 'Agricultural Production')).toBeUndefined();
      expect(findCanonicalCurriculum('', 'Agricultural Production')).toBeUndefined();
    });

    it('generates pending TVET document states for Agricultural Production without synthetic schedules', () => {
      const header: TVETDocumentHeaderContext = {
        institutionName: 'Academic Planner TVET College',
        departmentName: 'Nutrition & Dietetics',
        academicPeriodName: 'Jan - Apr 2026',
        unitCode: 'CHN 2309',
        unitName: 'Agricultural Production',
        cohortName: 'CHN Jan 2026',
        trainerName: 'Mr. Kiprono',
        totalNominalHours: 66,
        weeklyHours: 5,
      };

      const outline = generateTVETCourseOutline(header);
      expect(outline.isAvailable).toBe(false);
      expect(outline.weeklySchedule).toHaveLength(0);
      expect(outline.notReadyMessage).toContain('not yet available');

      const scheme = generateTVETSchemeOfWork(header);
      expect(scheme.isAvailable).toBe(false);
      expect(scheme.plannedWeeks).toHaveLength(0);
      expect(scheme.notReadyMessage).toContain('not yet available');
    });

    it('verifies Food Security cleanly resolves to Unit 36.3.0 without leaking to agricultural units', () => {
      const foodSec = getUnitCurriculum('DND 3101', 'Food Security');
      expect(foodSec.isAvailable !== false).toBe(true);
      expect(foodSec.unitName).toBe('Food Security');
      expect(foodSec.weeklySchedule && foodSec.weeklySchedule.length >= 12).toBe(true);
      expect(foodSec.weeklySchedule![0].topicTitle).toContain('Food Security');
    });

    it('prevents Food Science from resolving to Food Processing and Preservation', () => {
      const foodSci = getUnitCurriculum('CHN 1202', 'Food Science');
      expect(foodSci.isAvailable).toBe(false);
      expect(foodSci.weeklySchedule).toHaveLength(0);

      const cndFoodSci = getUnitCurriculum('CND 2106', 'Food Science');
      expect(cndFoodSci.isAvailable).toBe(false);
      expect(cndFoodSci.weeklySchedule).toHaveLength(0);
    });

    it('prevents Demonstration Techniques from resolving to Nutrition Education and Counselling', () => {
      const demo = getUnitCurriculum('CHN 2306', 'Demonstration Techniques');
      expect(demo.isAvailable).toBe(false);
      expect(demo.weeklySchedule).toHaveLength(0);
    });

    it('rejects partial or loose substring matching on arbitrary titles', () => {
      expect(findCanonicalCurriculum('', 'Principles of Agriculture')).toBeUndefined();
      expect(findCanonicalCurriculum('', 'Production Management')).toBeUndefined();
      expect(findCanonicalCurriculum('', 'Project Coordination')).toBeUndefined();
      expect(findCanonicalCurriculum('', 'General Science')).toBeUndefined();
    });
  });
});
