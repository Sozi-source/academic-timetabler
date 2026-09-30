// ============================================================
// Lecture Notes — Grounded Prompt Builder
// ============================================================
// Builds the strict, grounded system prompt for Gemini generation.
// The prompt ONLY allows content from the provided source material.

import type { RetrievedChunk } from '../types';

export interface PromptInput {
  unitCode: string;
  unitName: string;
  topic: string;
  sessionWeek?: number | null;
  granularity: 'session' | 'unit';
  learningOutcomes: string[];
  weeklyPlanContext: string;
  retrievedChunks: RetrievedChunk[];
}

export function buildGroundedPrompt(input: PromptInput): string {
  const {
    unitCode,
    unitName,
    topic,
    sessionWeek,
    granularity,
    learningOutcomes,
    weeklyPlanContext,
    retrievedChunks,
  } = input;

  const scopeLabel =
    granularity === 'session' && sessionWeek != null
      ? `Week ${sessionWeek} Session`
      : 'Full Unit';

  const outcomesText =
    learningOutcomes.length > 0
      ? learningOutcomes.map((o, i) => `${i + 1}. ${o}`).join('\n')
      : '(No learning outcomes found in course outline)';

  const chunksText =
    retrievedChunks.length > 0
      ? retrievedChunks
          .map((c, i) => `[Source ${i + 1}]\n${c.content.trim()}`)
          .join('\n\n---\n\n')
      : '(No source material was uploaded for this topic)';

  return `You are a lecture notes formatter for academic staff. Your ONLY job is to structure, organise, and rephrase content from the SOURCE MATERIAL below into clear, well-formatted lecture notes.

UNIT: ${unitCode} — ${unitName}
SCOPE: ${scopeLabel}
TOPIC: ${topic}

════════════════════════════════════════════════
ABSOLUTE RULES — YOU MUST FOLLOW THESE EXACTLY:
════════════════════════════════════════════════
1. Use ONLY information present in the SOURCE MATERIAL below.
2. Do NOT add any facts, examples, statistics, definitions, or explanations that are not explicitly in the sources.
3. Do NOT draw on your training knowledge about this topic.
4. If a section has no supporting source material, write exactly: [No source material provided for this section — add relevant materials in the material library]
5. You MAY: rephrase for clarity, add headings, restructure into bullet points, add numbering, improve readability.
6. You MAY NOT: invent, synthesise, extrapolate, or expand beyond what is in the sources.

════════════════════════════
LEARNING OUTCOMES (from course outline):
════════════════════════════
${outcomesText}

════════════════════════════
WEEKLY PLAN CONTEXT (from course outline):
════════════════════════════
${weeklyPlanContext || '(No weekly plan data available)'}

════════════════════════════
SOURCE MATERIAL (trainer-uploaded documents):
════════════════════════════
${chunksText}

════════════════════════════
OUTPUT FORMAT:
════════════════════════════
Generate lecture notes in this exact structure:

# ${topic}
**${unitCode}: ${unitName} | ${scopeLabel}**

## Introduction
(Brief overview of what will be covered — from sources only)

## Key Concepts
(Main sub-sections with headings, bullet points, and explanations — sources only)

## Summary
(Concise recap of the main points covered — sources only)

## Key Takeaways
- (Bullet list of the most important points students should remember — sources only)

Output clean markdown only. Do not include preamble or meta-commentary.`;
}
