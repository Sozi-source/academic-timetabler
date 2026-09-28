import { describe, expect, it } from 'vitest';
import {
  getContiguousTopicSpan,
  isCurriculumArtifactToken,
  normalizeCurriculumLearningOutcomes,
  normalizeCurriculumSubtopics,
  normalizeCurriculumTopicTitle,
  normalizeWeeklySchedule,
  serializeCurriculumSubtopics,
  stripCurriculumListPrefix,
} from '@/features/teaching-documents/curriculum-content-normalizer';
import {
  cleanTopicTitle,
  isPureAssessmentTopic,
} from '@/features/teaching-documents/distribution-engine';
import { parseCourseOutlineApproaches } from '@/features/teaching-documents/tvet-standards';

describe('curriculum content normalization', () => {
  describe('Problem 1: Contiguous topic visual grouping', () => {
    it('merges contiguous identical topic titles and assigns correct rowSpan', () => {
      const schedule = [
        { topicTitle: 'Introduction to Biochemistry' },
        { topicTitle: 'Carbohydrate Metabolism' },
        { topicTitle: 'Carbohydrate Metabolism' },
        { topicTitle: 'Carbohydrate Metabolism' },
        { topicTitle: 'Lipid Metabolism' },
      ];

      expect(schedule.map((_, index) => getContiguousTopicSpan(schedule, index))).toEqual([
        { isStart: true, rowSpan: 1 },
        { isStart: true, rowSpan: 3 },
        { isStart: false, rowSpan: 1 },
        { isStart: false, rowSpan: 1 },
        { isStart: true, rowSpan: 1 },
      ]);
    });

    it('does NOT merge non-contiguous identical topics (prevents W2 and W4 merging if W3 differs)', () => {
      const schedule = [
        { topicTitle: 'Carbohydrate Metabolism' },
        { topicTitle: 'Protein Metabolism' },
        { topicTitle: 'Carbohydrate Metabolism' },
      ];

      expect(schedule.map((_, index) => getContiguousTopicSpan(schedule, index))).toEqual([
        { isStart: true, rowSpan: 1 },
        { isStart: true, rowSpan: 1 },
        { isStart: true, rowSpan: 1 },
      ]);
    });

    it('preserves underlying weekly records in normalizeWeeklySchedule without removing weeks', () => {
      const schedule = [
        { weekNumber: 2, topicTitle: 'Carbohydrate Metabolism', subTopics: ['Glycolysis and gluconeogenesis'] },
        { weekNumber: 3, topicTitle: 'Carbohydrate Metabolism', subTopics: ['Tricarboxylic acid (TCA) cycle'] },
        { weekNumber: 4, topicTitle: 'Carbohydrate Metabolism', subTopics: ['Glycogen metabolism and pentose phosphate pathway'] },
      ];

      const normalized = normalizeWeeklySchedule(schedule);
      expect(normalized).toHaveLength(3);
      expect(normalized[0].weekNumber).toBe(2);
      expect(normalized[1].weekNumber).toBe(3);
      expect(normalized[2].weekNumber).toBe(4);
      expect(normalized[0].subTopics).toEqual(['Glycolysis and gluconeogenesis']);
      expect(normalized[1].subTopics).toEqual(['Tricarboxylic acid (TCA) cycle']);
      expect(normalized[2].subTopics).toEqual(['Glycogen metabolism and pentose phosphate pathway']);
    });
  });

  describe('Problem 2: DOCX formatting artifacts removed from content', () => {
    it('strips bad subtopic list artifacts like ["1", "1-2", "• Meaning of terms", "• Overview of metabolism"]', () => {
      const raw = ['1', '1-2', '• Meaning of terms', '• Overview of metabolism'];
      expect(normalizeCurriculumSubtopics(raw)).toEqual([
        'Meaning of terms',
        'Overview of metabolism',
      ]);
    });

    it('strips artifacts like ["1", "3-4", "• Coenzymes in carbohydrate metabolism"]', () => {
      const raw = ['1', '3-4', '• Coenzymes in carbohydrate metabolism'];
      expect(normalizeCurriculumSubtopics(raw)).toEqual([
        'Coenzymes in carbohydrate metabolism',
      ]);
    });

    it('cleans middle-dot joined strings with sequence and range tokens', () => {
      expect(
        normalizeCurriculumSubtopics('1 · 1-2 · • Meaning of terms · • Overview of metabolism'),
      ).toEqual(['Meaning of terms', 'Overview of metabolism']);
    });

    it('correctly identifies isolated artifact tokens', () => {
      expect(isCurriculumArtifactToken('1')).toBe(true);
      expect(isCurriculumArtifactToken('1-2')).toBe(true);
      expect(isCurriculumArtifactToken('1.')).toBe(true);
      expect(isCurriculumArtifactToken('1)')).toBe(true);
      expect(isCurriculumArtifactToken('(1)')).toBe(true);
      expect(isCurriculumArtifactToken('• •')).toBe(true);
      expect(isCurriculumArtifactToken('• 1-2')).toBe(true);
      expect(isCurriculumArtifactToken('Week 1')).toBe(true);
      expect(isCurriculumArtifactToken('CAT')).toBe(true);

      expect(isCurriculumArtifactToken('Vitamin B12 deficiency')).toBe(false);
      expect(isCurriculumArtifactToken('1–2 μg/day recommended intake')).toBe(false);
    });
  });

  describe('Problem 3: Subtopics each occupy their own line', () => {
    it('serializes subtopics to separate lines without combining them into one paragraph', () => {
      const result = serializeCurriculumSubtopics([
        'Glycolysis and gluconeogenesis',
        'Tricarboxylic acid (TCA) cycle',
        'Electron transport chain and oxidative phosphorylation',
      ]);
      expect(result).toBe(
        'Glycolysis and gluconeogenesis\nTricarboxylic acid (TCA) cycle\nElectron transport chain and oxidative phosphorylation',
      );
    });
  });

  describe('Problem 4: Conservative normalization preserving legitimate content', () => {
    it('preserves legitimate numbers, ranges, and chemical formulas in subtopics', () => {
      expect(normalizeCurriculumSubtopics('Vitamin B12 deficiency')).toEqual([
        'Vitamin B12 deficiency',
      ]);
      expect(normalizeCurriculumSubtopics('Type 1 and Type 2 diabetes')).toEqual([
        'Type 1 and Type 2 diabetes',
      ]);
      expect(normalizeCurriculumSubtopics('1–2 μg/day recommended intake')).toEqual([
        '1–2 μg/day recommended intake',
      ]);
      expect(normalizeCurriculumSubtopics('Stage 1 pressure ulcers')).toEqual([
        'Stage 1 pressure ulcers',
      ]);
      expect(normalizeCurriculumSubtopics('CO2 and H2O production')).toEqual([
        'CO2 and H2O production',
      ]);
    });

    it('strips list markers while preserving the underlying text with numbers', () => {
      expect(normalizeCurriculumSubtopics('1. Vitamin B12 deficiency')).toEqual([
        'Vitamin B12 deficiency',
      ]);
      expect(normalizeCurriculumSubtopics('a) Type 1 and Type 2 diabetes')).toEqual([
        'Type 1 and Type 2 diabetes',
      ]);
      expect(normalizeCurriculumSubtopics('(1) Stage 1 pressure ulcers')).toEqual([
        'Stage 1 pressure ulcers',
      ]);
      expect(normalizeCurriculumSubtopics('• 1-2 • Coenzymes and vitamins')).toEqual([
        'Coenzymes and vitamins',
      ]);
    });
  });

  describe('Problem 5: Do not use commas as automatic subtopic separators', () => {
    it('keeps "Classification, structure and functions of carbohydrates" as ONE subtopic', () => {
      const subtopics = normalizeCurriculumSubtopics(
        'Classification, structure and functions of carbohydrates',
      );
      expect(subtopics).toEqual([
        'Classification, structure and functions of carbohydrates',
      ]);
    });

    it('splits on bullets, newlines, and semicolons, but never on internal commas', () => {
      const input =
        '• Digestion, absorption, and transport of lipids\n• Classification, structure, and functions of proteins;\n• Fluid, electrolyte, and acid-base balance';
      const result = normalizeCurriculumSubtopics(input);
      expect(result).toEqual([
        'Digestion, absorption, and transport of lipids',
        'Classification, structure, and functions of proteins',
        'Fluid, electrolyte, and acid-base balance',
      ]);
    });

    it('parses Section 4 approaches without splitting internal "and" phrases', () => {
      const approaches = parseCourseOutlineApproaches(
        'Interactive lectures and illustrated tutorials, Guided classroom discussions and seminar presentations, Practical laboratory demonstrations and hands-on exercises',
      );
      expect(approaches).toEqual([
        'Interactive lectures and illustrated tutorials',
        'Guided classroom discussions and seminar presentations',
        'Practical laboratory demonstrations and hands-on exercises',
      ]);
    });
  });

  describe('Topic title normalization and assessment cleaning', () => {
    it('normalizes numbered topic headings and strips outline prefixes', () => {
      expect(normalizeCurriculumTopicTitle('3.19 Lipids')).toBe('Lipids');
      expect(normalizeCurriculumTopicTitle('1-2 Carbohydrate Metabolism')).toBe('Carbohydrate Metabolism');
      expect(normalizeCurriculumTopicTitle('Topic 1: Introduction to Biochemistry')).toBe('Introduction to Biochemistry');
      expect(normalizeCurriculumTopicTitle('Week 3: Protein Synthesis (Part 1)')).toBe('Protein Synthesis');
    });

    it('identifies End Term Examination and variants as pure assessment topics', () => {
      expect(isPureAssessmentTopic('End Term Examination')).toBe(true);
      expect(isPureAssessmentTopic('End-Term Examination')).toBe(true);
      expect(isPureAssessmentTopic('End Term Exam')).toBe(true);
      expect(isPureAssessmentTopic('End of Term Examination')).toBe(true);
      expect(isPureAssessmentTopic('Summative Examination')).toBe(true);
      expect(isPureAssessmentTopic('Continuous Assessment Test (CAT)')).toBe(true);
      expect(isPureAssessmentTopic('Enzymes')).toBe(false);
      expect(isPureAssessmentTopic('Carbohydrate Metabolism')).toBe(false);
    });

    it('cleans compound assessment suffixes in cleanTopicTitle', () => {
      expect(cleanTopicTitle('Enzymes & End Term Examination')).toBe('Enzymes');
      expect(cleanTopicTitle('Enzymes and Final Examination')).toBe('Enzymes');
      expect(cleanTopicTitle('Carbohydrate Metabolism (CAT)')).toBe('Carbohydrate Metabolism');
      expect(cleanTopicTitle('Protein Metabolism (RAT 1)')).toBe('Protein Metabolism');
    });
  });

  describe('Section 2: Learning outcomes discrete splitting and normalization', () => {
    it('splits a single blob of numbered learning outcomes into discrete items', () => {
      const blob =
        '1. Explain the biochemical concepts and metabolism of biomolecules. 2. Describe carbohydrate and protein metabolic pathways. 3. Discuss clinical conditions associated with inborn errors of metabolism.';
      const result = normalizeCurriculumLearningOutcomes(blob);
      expect(result).toEqual([
        'Explain the biochemical concepts and metabolism of biomolecules.',
        'Describe carbohydrate and protein metabolic pathways.',
        'Discuss clinical conditions associated with inborn errors of metabolism.',
      ]);
    });

    it('strips introductory clauses before splitting outcomes', () => {
      const blob =
        'By the end of the unit, the trainee should be able to: 1. Apply nutritional principles in disease management. 2. Formulate therapeutic diets for metabolic conditions.';
      const result = normalizeCurriculumLearningOutcomes(blob);
      expect(result).toEqual([
        'Apply nutritional principles in disease management.',
        'Formulate therapeutic diets for metabolic conditions.',
      ]);
    });

    it('handles arrays of outcomes and preserves discrete entries', () => {
      const input = [
        '1. Explain the role of enzymes in metabolic regulation',
        '2. Analyze lipid profiles and cardiovascular risk',
      ];
      const result = normalizeCurriculumLearningOutcomes(input);
      expect(result).toEqual([
        'Explain the role of enzymes in metabolic regulation',
        'Analyze lipid profiles and cardiovascular risk',
      ]);
    });
  });

  describe('Tightened list prefix rules', () => {
    it('preserves uppercase domain acronyms like "ATP: production" without stripping "ATP"', () => {
      expect(stripCurriculumListPrefix('ATP: production and regulation')).toBe('ATP: production and regulation');
      expect(stripCurriculumListPrefix('DNA: structure and replication')).toBe('DNA: structure and replication');
      expect(stripCurriculumListPrefix('BMI: classification and assessment')).toBe('BMI: classification and assessment');
    });

    it('strips "1-2 Meaning of terms" while preserving "1–2 μg/day recommended intake"', () => {
      expect(stripCurriculumListPrefix('1-2 Meaning of terms')).toBe('Meaning of terms');
      expect(stripCurriculumListPrefix('1–2 Overview of metabolism')).toBe('Overview of metabolism');
      expect(stripCurriculumListPrefix('1–2 μg/day recommended intake')).toBe('1–2 μg/day recommended intake');
      expect(stripCurriculumListPrefix('10-15 mg/100g')).toBe('10-15 mg/100g');
    });
  });
});
