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
    it('contains all 51 canonical curriculum units across Modules I, II, and III', () => {
      const allUnits = getAllCurriculumUnits();
      expect(allUnits).toHaveLength(51);

      const m1Units = allUnits.filter((u) => u.moduleNumber === 1);
      const m2Units = allUnits.filter((u) => u.moduleNumber === 2);
      const m3Units = allUnits.filter((u) => u.moduleNumber === 3);

      expect(m1Units).toHaveLength(22);
      expect(m2Units).toHaveLength(17);
      expect(m3Units).toHaveLength(12);
    });

    it('validates that all 51 canonical units have complete schedules, competencies, and references', () => {
      const allUnits = getAllCurriculumUnits();
      expect(allUnits).toHaveLength(51);

      for (const unit of allUnits) {
        expect(unit.canonicalKey).toBeTruthy();
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

    it('validates that Module 2 units (17 units) are fully populated with authentic TVET schedules', () => {
      const allUnits = getAllCurriculumUnits();
      const m2Units = allUnits.filter((u) => u.moduleNumber === 2);
      expect(m2Units).toHaveLength(17);

      for (const unit of m2Units) {
        expect(unit.isAvailable !== false).toBe(true);
        expect(unit.weeklySchedule?.length).toBeGreaterThanOrEqual(12);
        expect(unit.learningOutcomes?.length).toBeGreaterThan(0);
      }
    });

    it('generates authentic course outline and scheme of work for Food Processing and Preservation', () => {
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
      expect(outline.isAvailable !== false).toBe(true);
      expect(outline.weeklySchedule.length).toBeGreaterThanOrEqual(12);
      expect(outline.header.unitName).toContain('Food Processing and Preservation');

      const scheme = generateTVETSchemeOfWork(header);
      expect(scheme.isAvailable !== false).toBe(true);
      expect(scheme.plannedWeeks.length).toBeGreaterThanOrEqual(12);
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
    it('guarantees Agricultural Production (CHN 2309, DND 3205, CND 2306) resolves to its canonical unit without leaking to Food Security or Trade Project', () => {
      const chnAgric = getUnitCurriculum('CHN 2309', 'Agricultural Production');
      expect(chnAgric.isAvailable !== false).toBe(true);
      expect(chnAgric.unitDescription).not.toContain('Food Security');
      expect(chnAgric.unitName).toBe('Agricultural Production');

      const dndAgric = getUnitCurriculum('DND 3205', 'Agricultural Production');
      expect(dndAgric.unitName).toBe('Agricultural Production');

      const cndAgric = getUnitCurriculum('CND 2306', 'Agricultural Production');
      expect(cndAgric.unitName).toBe('Agricultural Production');

      // Verify canonical search directly returns agricultural_production
      expect(findCanonicalCurriculum('CHN 2309', 'Agricultural Production')?.canonicalKey).toBe('agricultural_production');
      expect(findCanonicalCurriculum('DND 3205', 'Agricultural Production')?.canonicalKey).toBe('agricultural_production');
      expect(findCanonicalCurriculum('CND 2306', 'Agricultural Production')?.canonicalKey).toBe('agricultural_production');
    });

    it('generates authentic TVET document states for Agricultural Production', () => {
      const header: TVETDocumentHeaderContext = {
        institutionName: 'Academic Planner TVET College',
        departmentName: 'Nutrition & Dietetics',
        academicPeriodName: 'Jan - Apr 2026',
        unitCode: 'CHN 2309',
        unitName: 'Agricultural Production',
        cohortName: 'CHN Jan 2026',
        trainerName: 'Mr. Kiprono',
        totalNominalHours: 40,
        weeklyHours: 4,
      };

      const outline = generateTVETCourseOutline(header);
      expect(outline.isAvailable !== false).toBe(true);
      expect(outline.weeklySchedule.length).toBeGreaterThanOrEqual(12);

      const scheme = generateTVETSchemeOfWork(header);
      expect(scheme.isAvailable !== false).toBe(true);
      expect(scheme.plannedWeeks.length).toBeGreaterThanOrEqual(12);
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
      expect(foodSci.isAvailable !== false).toBe(true);
      expect(foodSci.unitName).toBe('Food Science');

      const canonical = findCanonicalCurriculum('CHN 1202', 'Food Science');
      expect(canonical?.canonicalKey).toBe('food_science');
      expect(canonical?.canonicalKey).not.toBe('food_processing_preservation');

      const cndCanonical = findCanonicalCurriculum('CND 2106', 'Food Science');
      expect(cndCanonical?.canonicalKey).toBe('food_science');
    });

    it('prevents Demonstration Techniques from resolving to Nutrition Education and Counselling', () => {
      const demo = getUnitCurriculum('CHN 2306', 'Demonstration Techniques');
      expect(demo.isAvailable !== false).toBe(true);
      expect(demo.unitName).toBe('Demonstration Techniques');

      const canonical = findCanonicalCurriculum('CHN 2306', 'Demonstration Techniques');
      expect(canonical?.canonicalKey).toBe('demonstration_techniques');
      expect(canonical?.canonicalKey).not.toBe('nutrition_education_counselling');
    });

    it('rejects partial or loose substring matching on arbitrary titles', () => {
      expect(findCanonicalCurriculum('', 'Principles of Agriculture')).toBeUndefined();
      expect(findCanonicalCurriculum('', 'Production Management')).toBeUndefined();
      expect(findCanonicalCurriculum('', 'Project Coordination')).toBeUndefined();
      expect(findCanonicalCurriculum('', 'General Science')).toBeUndefined();
    });
  });
});
