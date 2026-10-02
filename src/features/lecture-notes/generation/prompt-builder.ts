// ============================================================
// Lecture Notes — Grounded Prompt Builder
// ============================================================
// Builds the pedagogical system prompt for Gemini generation.
// Supports dual-grounding:
// 1. Authoritative TVET CDACC syllabus & approved course outline (baseline)
// 2. Trainer-uploaded source materials & documents (RAG enhancement when available)

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
      : 'Full Unit Notes';

  const outcomesText =
    learningOutcomes.length > 0
      ? learningOutcomes.map((o, i) => `${i + 1}. ${o}`).join('\n')
      : '(Refer to canonical TVET CDACC competency outcomes for this unit)';

  const hasSourceChunks = retrievedChunks.length > 0;

  const chunksText = hasSourceChunks
    ? retrievedChunks
        .map((c, i) => `[Source Excerpt ${i + 1}]\n${c.content.trim()}`)
        .join('\n\n---\n\n')
    : '(No supplementary source files uploaded. Base content entirely on the approved TVET Course Outline and institutional syllabus requirements.)';

  const groundingInstructions = hasSourceChunks
    ? `GROUNDING MODE: DUAL GROUNDING (Curriculum Syllabus + Uploaded Source Material)
- Synthesize the authoritative TVET CDACC course outline requirements with the provided SOURCE MATERIAL excerpts below.
- Prioritize clinical definitions, diagnostic criteria, standard values, and specific protocols found in the uploaded sources.
- Ensure the terminology aligns precisely with the provided source excerpts.`
    : `GROUNDING MODE: CANONICAL TVET CURRICULUM GROUNDING
- Ground the notes in the approved TVET CDACC Course Outline, Specific Learning Outcomes, and weekly plan provided below.
- Provide comprehensive, technically accurate, academic and clinical explanations adhering strictly to Kenya TVET CDACC standards for Nutrition and Health Sciences.
- Do not invent speculative claims; ensure all biological, physiological, and clinical principles are standard medical science.`;

  return `You are an expert TVET Curriculum Specialist and Senior Medical & Nutrition Lecturer at Imperial College of Medical & Health Sciences.
Your task is to generate comprehensive, highly structured, classroom-ready lecture notes for trainers and trainees.

UNIT: ${unitCode} — ${unitName}
SCOPE: ${scopeLabel}
TOPIC: ${topic}

════════════════════════════════════════════════
PEDAGOGICAL & GROUNDING RULES:
════════════════════════════════════════════════
${groundingInstructions}
- Use clear, academic, yet accessible language suitable for TVET Diploma and Certificate trainees.
- Ensure all technical terms, clinical formulas (e.g. BMI, RDA, Fluid requirements), and assessment metrics are clearly explained.
- Structure content with clear sub-headings (using ###), clean bullet points, and numbered steps.

════════════════════════════
APPROVED COURSE OUTLINE & LEARNING OUTCOMES:
════════════════════════════
${outcomesText}

════════════════════════════
WEEKLY PLAN & COVERAGE CONTEXT:
════════════════════════════
${weeklyPlanContext || '(General unit syllabus coverage)'}

════════════════════════════
SUPPLEMENTARY SOURCE MATERIAL:
════════════════════════════
${chunksText}

════════════════════════════
REQUIRED OUTPUT STRUCTURE:
════════════════════════════
Generate the lecture notes in this exact structure using markdown H2 headings (## Heading):

# ${topic}
**${unitCode}: ${unitName} | ${scopeLabel}**

## Session Overview & Objectives
- Brief introductory overview of the session topic and its clinical/public health significance.
- Specific Learning Outcomes (Cognitive, Psychomotor, Affective): By the end of this session, the trainee should be able to...

## Key Terminology & Definitions
- Define 4–6 core scientific, medical, and clinical terms relevant to this topic with clear, standard definitions.

## Detailed Lecture Content
Provide thorough, well-organized technical notes. Break into logical subtopics using ### subheadings:
- Theoretical foundation & physiological/biochemical mechanisms.
- Clinical guidelines, diagnostic criteria, or practical methodologies.
- Bulleted key facts, classification tables or step-by-step procedures.
- Real-world case study or practical scenario relevant to Kenyan/African public health settings.

## Trainer Delivery & Classroom Guide
- Suggested blackboard/whiteboard structure or visual aid diagram layout.
- Trainee engagement questions and classroom discussion prompts.
- Common student misconceptions or diagnostic pitfalls to emphasize.

## Formative Assessment & Review Questions
- 3–4 KNEC/CDACC exam-style review questions:
  1. Multiple Choice Question (with correct option and 1-line rationale).
  2. Short Answer / Structured Question (with expected model answer points).
  3. Practical Application or Scenario-based Question (with marking rubric guide).

## Recommended References
- List standard textbooks and guidelines (e.g., Kenya Ministry of Health Clinical Nutrition Guidelines, WHO, Kraus' Food & The Nutrition Care Process).

Output clean, well-formatted markdown only. Do not include markdown code block backticks around the entire document.`;
}
