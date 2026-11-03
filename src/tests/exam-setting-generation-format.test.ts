import { describe, expect, it } from 'vitest';

import {
  generationFormatInstruction,
  validateGeneratedQuestionFormat,
} from '@/features/exam-setting/generation-format';

const shortAnswerSlot = {
  sectionLabel: 'A',
  itemNumber: 1,
  marks: 4,
  questionType: 'short_answer' as const,
};

const structuredSlot = {
  sectionLabel: 'B',
  itemNumber: 1,
  marks: 20,
  questionType: 'structured' as const,
};

describe('exam setting generation format', () => {
  it('requires Section A short-answer questions to have no subquestions', () => {
    expect(validateGeneratedQuestionFormat({
      stem: 'State four causes of malnutrition.',
      parts: [],
    }, shortAnswerSlot)).toBeNull();

    expect(validateGeneratedQuestionFormat({
      stem: 'Discuss malnutrition.',
      parts: [
        { label: 'a', text: 'Define malnutrition.', marks: 2 },
        { label: 'b', text: 'State two causes.', marks: 2 },
      ],
    }, shortAnswerSlot)).toContain('without subquestions');
  });

  it('requires Section B structured questions to have 2 or 3 parts totaling 20 marks', () => {
    expect(validateGeneratedQuestionFormat({
      stem: 'A patient presents with signs of nutrient deficiency. Explain the case.',
      parts: [
        { label: 'a', text: 'Identify the likely deficiency.', marks: 6 },
        { label: 'b', text: 'Explain the assessment findings.', marks: 7 },
        { label: 'c', text: 'Recommend dietary management.', marks: 7 },
      ],
    }, structuredSlot)).toBeNull();

    expect(validateGeneratedQuestionFormat({
      stem: 'Explain nutrient deficiency.',
      parts: [{ label: 'a', text: 'Explain the condition.', marks: 20 }],
    }, structuredSlot)).toContain('2 or 3 subquestions');

    expect(validateGeneratedQuestionFormat({
      stem: 'Explain nutrient deficiency.',
      parts: [
        { label: 'a', text: 'Define the condition.', marks: 10 },
        { label: 'b', text: 'State its causes.', marks: 5 },
      ],
    }, structuredSlot)).toContain('add to 20');

    expect(validateGeneratedQuestionFormat({
      stem: 'Explain nutrient deficiency.',
      parts: [
        { label: '(a)', text: 'Define the condition.', marks: 10 },
        { label: 'a', text: 'State its causes.', marks: 10 },
      ],
    }, structuredSlot)).toContain('distinct labels');
  });

  it('communicates the section-specific format to the model', () => {
    expect(generationFormatInstruction(shortAnswerSlot)).toContain('empty array');
    expect(generationFormatInstruction(structuredSlot)).toContain('exactly 2 or 3');
  });
});
