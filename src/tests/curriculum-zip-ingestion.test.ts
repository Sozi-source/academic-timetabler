import { describe, expect, it } from 'vitest';
import {
  extractTextFromDocx,
  parseCurriculumText,
  unpackZipBuffer,
} from '@/features/teaching-documents/zip-ingestion';
import { generateTVETSchemeOfWork } from '@/features/teaching-documents/tvet-standards';

/**
 * Creates a minimal uncompressed (stored) ZIP buffer for testing
 */
function createMockZipBuffer(filename: string, content: string): Buffer {
  const contentBuf = Buffer.from(content, 'utf8');
  const filenameBuf = Buffer.from(filename, 'utf8');

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
  localHeader.writeUInt16LE(20, 4); // version
  localHeader.writeUInt16LE(0, 6); // flags
  localHeader.writeUInt16LE(0, 8); // compression: 0 (Stored)
  localHeader.writeUInt16LE(0, 10); // time
  localHeader.writeUInt16LE(0, 12); // date
  localHeader.writeUInt32LE(0, 14); // crc32
  localHeader.writeUInt32LE(contentBuf.length, 18); // compressed size
  localHeader.writeUInt32LE(contentBuf.length, 22); // uncompressed size
  localHeader.writeUInt16LE(filenameBuf.length, 26); // filename length
  localHeader.writeUInt16LE(0, 28); // extra field length

  return Buffer.concat([localHeader, filenameBuf, contentBuf]);
}

describe('TVET Curriculum ZIP Ingestion & Scheme Auto-Generation', () => {
  describe('ZIP Extraction', () => {
    it('unpacks uncompressed file entries from ZIP buffer', () => {
      const mockZip = createMockZipBuffer(
        'cnd_1101_outline.txt',
        'Unit Code: CND 1101\nUnit Name: Anatomy & Physiology\nWeek 1: Body systems'
      );

      const entries = unpackZipBuffer(mockZip);
      expect(entries).toHaveLength(1);
      expect(entries[0].filename).toBe('cnd_1101_outline.txt');
      expect(entries[0].buffer.toString('utf8')).toContain('CND 1101');
    });
  });

  describe('Curriculum Document Text Parsing & TVET Normalization', () => {
    it('extracts unit code, unit name, and weekly schedule from raw text', () => {
      const rawCurriculum = `
        REPUBLIC OF KENYA - TVET CURRICULUM
        Unit Code: NUT 201
        Unit Title: Clinical Nutrition Assessment
        
        Learning Outcomes:
        - Assess nutritional status using anthropometric measurements
        - Interpret biochemical lab indicators
        - Formulate nutritional care plans
        
        Weekly Schedule:
        Week 1: Introduction to Nutritional Assessment
        Week 2: Anthropometric Measurements & Tools
        Week 3: Biochemical & Clinical Indicators
        Week 4: Dietary Assessment & 24h Recall
        Week 5: Continuous Assessment (RAT 1)
        Week 6: Pediatric & Maternal Nutrition
        Week 7: Geriatric Assessment
        Week 8: Continuous Assessment (Official CAT)
        Week 9: Hospital Patient Case Studies
        Week 10: Trainee Clinical Presentations
        Week 11: Community Nutrition Surveys
        Week 12: Nutritional Software & Calculations
        Week 13: Syllabus Revision & Practice
        Week 14: Final Examination
      `;

      const parsed = parseCurriculumText(rawCurriculum, 'NUT_201_outline.txt');

      expect(parsed.unitCode).toBe('NUT 201');
      expect(parsed.unitName).toBe('Clinical Nutrition Assessment');
      expect(parsed.learningOutcomes?.length).toBeGreaterThanOrEqual(3);
      expect(parsed.weeklySchedule).toHaveLength(14);
      expect(parsed.weeklySchedule?.[0].topicTitle).toContain('Introduction to Nutritional Assessment');
      expect(parsed.weeklySchedule?.[4].topicTitle).toContain('RAT 1');
      expect(parsed.weeklySchedule?.[7].topicTitle).toContain('CAT');
    });
  });

  describe('Scheme-to-Record Auto Generation', () => {
    it('pre-populates 14-week Record of Work delivery roadmap from Scheme of Work', () => {
      const scheme = generateTVETSchemeOfWork({
        institutionName: 'Academic Planner TVET College',
        departmentName: 'Health Sciences',
        academicPeriodName: 'Jan - Apr 2026',
        unitCode: 'CLIN 101',
        unitName: 'Clinical Medicine Foundations',
        cohortName: 'DND Jan 2026',
        trainerName: 'Dr. Mwangi',
        totalNominalHours: 56,
        weeklyHours: 4,
      });

      expect(scheme.plannedWeeks).toHaveLength(14);

      // Verify that every week has specific learning outcomes and assessment strategies
      for (const week of scheme.plannedWeeks) {
        expect(week.weekNumber).toBeGreaterThanOrEqual(1);
        expect(week.weekNumber).toBeLessThanOrEqual(14);
        expect(week.topic).toBeTruthy();
        expect(week.specificLearningOutcomes).toContain('By the end of the week');
      }

      // Check milestones
      expect(scheme.plannedWeeks[4].assessmentAndRemarks).toContain('RAT');
      expect(scheme.plannedWeeks[7].assessmentAndRemarks).toContain('CAT');
      expect(scheme.plannedWeeks[13].assessmentAndRemarks).toContain('Final Examination');
    });
  });
});
