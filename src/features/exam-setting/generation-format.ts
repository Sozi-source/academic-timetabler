export interface GeneratedQuestionPartFormat {
  label: string;
  text: string;
  marks: number;
}

export interface GeneratedQuestionFormat {
  stem: string;
  parts: GeneratedQuestionPartFormat[];
}

export interface GenerationSlotFormat {
  sectionLabel: string;
  itemNumber: number;
  marks: number;
  questionType: 'short_answer' | 'structured' | 'essay' | 'case_study' | 'practical';
}

function normalizedLabel(value: string): string {
  return value.toLowerCase().replace(/[()[\].]/g, '').trim();
}

export function validateGeneratedQuestionFormat(
  question: GeneratedQuestionFormat,
  slot: GenerationSlotFormat,
): string | null {
  if (slot.questionType === 'short_answer') {
    if (question.parts.length > 0) {
      return `Section ${slot.sectionLabel} short-answer question ${slot.itemNumber} must be one direct prompt without subquestions.`;
    }
    return null;
  }

  if (slot.questionType !== 'structured') return null;

  if (question.parts.length < 2 || question.parts.length > 3) {
    return `Section ${slot.sectionLabel} structured question ${slot.itemNumber} must contain 2 or 3 subquestions.`;
  }

  const labels = question.parts.map((part) => normalizedLabel(part.label));
  if (new Set(labels).size !== labels.length || labels.some((label) => label.length === 0)) {
    return `Section ${slot.sectionLabel} structured question ${slot.itemNumber} must use distinct labels for its subquestions.`;
  }

  const totalMarks = question.parts.reduce((sum, part) => sum + part.marks, 0);
  if (totalMarks !== slot.marks) {
    return `Section ${slot.sectionLabel} structured question ${slot.itemNumber} subquestion marks must add to ${slot.marks}.`;
  }

  return null;
}

export function generationFormatInstruction(slot: GenerationSlotFormat): string {
  if (slot.questionType === 'short_answer') {
    return `Section ${slot.sectionLabel} item ${slot.itemNumber} is a ${slot.marks}-mark short-answer question: write one concise, direct question or command (for example Define, State, List, Identify, Explain, or Give) and return parts as an empty array. Do not add a scenario, lead-in case, (a)/(b) parts, or subquestions.`;
  }

  if (slot.questionType === 'structured') {
    return `Section ${slot.sectionLabel} item ${slot.itemNumber} is a ${slot.marks}-mark structured question: write one clear lead-in stem followed by exactly 2 or 3 labeled subquestions. The subquestion marks must be whole numbers adding exactly to ${slot.marks}.`;
  }

  return `Section ${slot.sectionLabel} item ${slot.itemNumber} targets the ${slot.questionType} format and carries ${slot.marks} marks.`;
}
