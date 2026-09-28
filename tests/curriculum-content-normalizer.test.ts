import { describe, expect, it } from 'vitest';
import {
  getContiguousTopicSpan,
  normalizeCurriculumSubtopics,
  normalizeCurriculumTopicTitle,
  serializeCurriculumSubtopics,
} from '@/features/teaching-documents/curriculum-content-normalizer';

describe('curriculum content normalization', () => {
  it('removes Word bullets and sequence labels such as 1-2', () => {
    expect(
      normalizeCurriculumSubtopics('• 1-2 • Meaning of terms • Overview of metabolism'),
    ).toEqual(['Meaning of terms', 'Overview of metabolism']);
  });

  it('keeps each subtopic as a separate line without splitting legitimate commas or and', () => {
    expect(
      serializeCurriculumSubtopics('• Lipid hydrolysis\n• Digestion, absorption, metabolism, and excretion'),
    ).toBe('Lipid hydrolysis\nDigestion, absorption, metabolism, and excretion');
  });

  it('normalizes numbered topic headings', () => {
    expect(normalizeCurriculumTopicTitle('3.19 Lipids')).toBe('Lipids');
    expect(normalizeCurriculumTopicTitle('1-2 Carbohydrate Metabolism')).toBe('Carbohydrate Metabolism');
  });

  it('merges only contiguous identical topic titles for presentation', () => {
    const schedule = [
      { topicTitle: 'Carbohydrate Metabolism' },
      { topicTitle: 'Carbohydrate Metabolism' },
      { topicTitle: 'Protein Metabolism' },
      { topicTitle: 'Carbohydrate Metabolism' },
    ];

    expect(schedule.map((_, index) => getContiguousTopicSpan(schedule, index))).toEqual([
      { isStart: true, rowSpan: 2 },
      { isStart: false, rowSpan: 1 },
      { isStart: true, rowSpan: 1 },
      { isStart: true, rowSpan: 1 },
    ]);
  });
});
