// ============================================================
// Lecture Notes — Grounded Prompt Builder
// ============================================================
// Two generation modes are supported:
//
// 1. FULL UNIT / UNIFIED SYNTHESIS
//    Every successfully ingested source file for the unit is supplied
//    to Gemini as a labelled source corpus. This is deliberately NOT
//    a top-k RAG excerpt. It allows the model to compare different
//    versions of the same lecture notes, remove repetition, reconcile
//    overlap, and build one coherent set of notes.
//
// 2. TOPIC-FOCUSED
//    Uses semantically retrieved excerpts for a narrower topic.
//
// The full-unit path exists specifically to avoid the previous failure
// mode where only 10 vector chunks were sent to the model.

import type { RetrievedChunk } from '../types';

export interface UnifiedSourceMaterial {
  id: string;
  title: string;
  originalFilename?: string | null;
  contentText: string;
  wordCount: number;
}

export interface PromptInput {
  unitCode: string;
  unitName: string;
  topic: string;
  sessionWeek?: number | null;
  granularity: 'session' | 'unit';
  learningOutcomes: string[];
  weeklyPlanContext: string;
  retrievedChunks: RetrievedChunk[];
  sourceMaterials?: UnifiedSourceMaterial[];
}

function cleanSourceText(text: string): string {
  return text
    .replace(/\u0000/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n')
    .trim();
}

function buildUnifiedSourceCorpus(materials: UnifiedSourceMaterial[]): string {
  if (materials.length === 0) {
    return '(No successfully ingested source files are available.)';
  }

  return materials
    .map((material, index) => {
      const filename = material.originalFilename
        ? ` | File: ${material.originalFilename}`
        : '';

      return [
        `===== SOURCE ${index + 1}: ${material.title}${filename} =====`,
        `SOURCE WORD COUNT: ${material.wordCount}`,
        cleanSourceText(material.contentText),
        `===== END SOURCE ${index + 1} =====`,
      ].join('\n');
    })
    .join('\n\n');
}

function buildSourceCoverage(materials: UnifiedSourceMaterial[]): string {
  if (materials.length === 0) return '(No source coverage available.)';

  return materials
    .map((m, i) => `${i + 1}. ${m.title} — approximately ${m.wordCount.toLocaleString()} words`)
    .join('\n');
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
    sourceMaterials = [],
  } = input;

  const isFullUnit = granularity === 'unit';
  const scopeLabel =
    isFullUnit
      ? 'Unified Full Unit Notes'
      : sessionWeek != null
        ? `Week ${sessionWeek} Topic/Session`
        : 'Topic-Focused Notes';

  const outcomesText =
    learningOutcomes.length > 0
      ? learningOutcomes.map((o, i) => `${i + 1}. ${o}`).join('\n')
      : '(Refer to the supplied source corpus and approved curriculum context.)';

  const sourceCorpus = isFullUnit
    ? buildUnifiedSourceCorpus(sourceMaterials)
    : retrievedChunks.length > 0
      ? retrievedChunks
          .map((c, i) => `[Retrieved Source Excerpt ${i + 1}]\n${c.content.trim()}`)
          .join('\n\n---\n\n')
      : '(No supplementary source excerpts were retrieved.)';

  const sourceCoverage = isFullUnit
    ? buildSourceCoverage(sourceMaterials)
    : retrievedChunks.length > 0
      ? `${retrievedChunks.length} semantically retrieved excerpts`
      : 'No supplementary source excerpts';

  const groundingInstructions = isFullUnit
    ? `GROUNDING MODE: FULL-CORPUS UNIFIED SYNTHESIS

You have been given the COMPLETE extracted text of every successfully ingested source file for this unit. You MUST read and synthesize the entire corpus before drafting the notes.

The source files are different versions/editions of related lecture notes. They may:
- repeat the same material;
- use different wording or levels of detail;
- cover different lessons;
- contain overlapping or occasionally inconsistent statements.

Your job is to produce ONE authoritative, coherent teaching document — NOT a summary of each file and NOT a copy-and-paste compilation.

SOURCE RECONCILIATION RULES:
1. Read across ALL labelled sources before drafting.
2. Preserve useful detail that appears in only one source when it is relevant to the unit.
3. Remove duplicated explanations while retaining the clearest and most pedagogically useful version.
4. Where sources overlap, synthesize the common substance rather than repeating it.
5. Where sources differ, prefer the clearer, more internally consistent and curriculum-aligned treatment. Do not silently invent a resolution for a material disagreement; state the distinction briefly when it matters.
6. Do not attribute facts to a source unless the source actually supports them.
7. Do not omit later lessons simply because an earlier source version stops earlier.
8. Build the final structure around the complete subject coverage discovered across the corpus, not around the order of a single source file.
9. Preserve formulas, definitions, classifications, worked examples, tables, procedures, study designs, screening concepts, outbreak investigation, surveillance, ethics, and other substantive material present in the sources.
10. Do not let the shortest or oldest source determine the scope of the final document.`
    : `GROUNDING MODE: TOPIC-FOCUSED SOURCE SYNTHESIS
- Use the supplied retrieved excerpts as the primary source material.
- Synthesize overlapping excerpts rather than repeating them.
- Do not introduce unsupported claims merely to make the notes longer.`;

  return `You are an expert TVET Curriculum Specialist and Senior Medical & Nutrition Lecturer at Imperial College of Medical & Health Sciences.

Your task is to generate high-quality, comprehensive, classroom-ready lecture notes from the supplied curriculum context and source material.

UNIT: ${unitCode} — ${unitName}
SCOPE: ${scopeLabel}
FOCUS/TITLE: ${topic}

============================================================
CRITICAL SOURCE-USE REQUIREMENT
============================================================
${groundingInstructions}

SOURCE FILES AVAILABLE:
${sourceCoverage}

This is a source-grounded synthesis task. The uploaded source corpus is more important than generic model memory. Use general knowledge only to improve wording, structure, transitions, or explanations where it does not contradict the supplied material.

============================================================
CURRICULUM CONTEXT
============================================================
APPROVED LEARNING OUTCOMES:
${outcomesText}

WEEKLY PLAN / COVERAGE CONTEXT:
${weeklyPlanContext || '(No additional weekly plan was supplied.)'}

============================================================
REQUIRED CONTENT QUALITY
============================================================
For a FULL UNIT:
- Cover the complete epidemiology unit represented across the source corpus.
- Do not stop after the introductory lessons.
- Identify and include all substantive lesson areas found across the sources, including later lessons even if some older files omit them.
- Produce a logically ordered teaching sequence and merge duplicate lessons/topics.
- Retain useful Kenyan, African, public-health, nutrition and TVET examples from the sources.
- Include important definitions, classifications, formulas, worked examples, tables, procedures, study designs, screening methods, outbreak investigation, surveillance, ethics, record keeping, programme planning/evaluation, and emerging issues when supported by the sources.
- Use enough detail that the result can function as a standalone learner handout.

For a TOPIC-FOCUSED document:
- Stay tightly focused on the selected topic while using the strongest relevant source material.
- Do not unnecessarily reproduce unrelated unit content.

For all documents:
- Explain concepts rather than merely listing them.
- Preserve formulas accurately and explain every variable.
- Use tables where a comparison is clearer than prose.
- Use numbered procedures for sequential methods.
- Include practical Kenyan examples where the sources provide them.
- Avoid filler, generic motivational language, or invented references.
- Do not mention that you are an AI.
- Do not describe the source files in the body of the lecture notes.
- Do not produce a source-by-source summary.

============================================================
OUTPUT STRUCTURE
============================================================
Return clean markdown only.

# ${topic}
**${unitCode}: ${unitName} | ${scopeLabel}**

## Session Overview & Learning Outcomes
Provide a concise overview followed by specific learning outcomes.

## Key Terminology & Definitions
Include the important terms required to understand the unit/scope.

## Detailed Lecture Content
Organize the entire substantive content into numbered major sections and ### subheadings. For a full unit, use a coherent sequence based on the complete source corpus rather than arbitrarily stopping at the first few lessons.

For each major section, where supported:
- explain the concept;
- provide classifications/types;
- provide formulas and define variables;
- include tables/comparisons;
- include practical or Kenyan examples;
- include procedures/steps;
- identify strengths, limitations, advantages, disadvantages and common errors where relevant.

## Practical Applications & Kenyan Context
Consolidate important Kenyan public-health and nutrition applications from the sources.

## Trainer Delivery & Classroom Guide
Provide suggested teaching emphasis, board/visual-aid ideas, discussion prompts and common misconceptions.

## Formative Assessment & Review Questions
Provide a meaningful set of KNEC/CDACC-style questions covering the breadth of the generated unit, including:
- MCQs with answers and brief rationales;
- short-answer/structured questions with expected points;
- calculation/application questions where formulas are taught;
- scenario/case questions with marking guidance.

## Key Takeaways
Summarize the major examinable and practical points.

## Recommended References
List references explicitly supported or named by the supplied material. Do not fabricate bibliographic details.

============================================================
COMPLETE SOURCE CORPUS
============================================================
${sourceCorpus}
`;
}
