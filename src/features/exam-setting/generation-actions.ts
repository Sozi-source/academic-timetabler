'use server';

import { GoogleGenerativeAI, GoogleGenerativeAIFetchError, SchemaType, type ResponseSchema } from '@google/generative-ai';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import { getParsedHistoricalQuestions } from './question-bank';

const generationInput = z.object({
  unitId: z.uuid(),
  blueprintId: z.uuid(),
  periodId: z.uuid(),
  paperKind: z.enum(['main', 'supplementary']),
});

const generatedQuestionSchema = z.object({
  stem: z.string().trim().min(20).max(5000),
  options: z.array(z.string().trim().min(1).max(500)).length(0),
  parts: z.array(z.object({
    label: z.string().trim().min(1).max(12),
    text: z.string().trim().min(5).max(2000),
    marks: z.number().int().positive().max(100),
  })).max(20),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  cognitiveLevel: z.enum(['recall', 'comprehension', 'application', 'analysis']),
  topic: z.string().trim().min(2).max(240),
  learningOutcome: z.string().trim().max(1000),
  derivationMode: z.enum(['reword', 'rescenario', 'new_from_notes']),
});

/**
 * Structured-output schema sent to Gemini. It mirrors generatedQuestionSchema so the
 * decoder itself guarantees whole-number marks and valid enum values (past papers often
 * contain half marks such as 1.5, which the model would otherwise copy).
 */
const enumString = (values: string[]): ResponseSchema => ({ type: SchemaType.STRING, format: 'enum', enum: values });
const generatedBatchResponseSchema: ResponseSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      index: { type: SchemaType.INTEGER },
      stem: { type: SchemaType.STRING },
      options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, maxItems: 0 },
      parts: {
        type: SchemaType.ARRAY,
        maxItems: 20,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            label: { type: SchemaType.STRING },
            text: { type: SchemaType.STRING },
            marks: { type: SchemaType.INTEGER },
          },
          required: ['label', 'text', 'marks'],
        },
      },
      difficulty: enumString(['easy', 'medium', 'hard']),
      cognitiveLevel: enumString(['recall', 'comprehension', 'application', 'analysis']),
      topic: { type: SchemaType.STRING },
      learningOutcome: { type: SchemaType.STRING },
      derivationMode: enumString(['reword', 'rescenario', 'new_from_notes']),
    },
    required: ['index', 'stem', 'options', 'parts', 'difficulty', 'cognitiveLevel', 'topic', 'learningOutcome', 'derivationMode'],
  },
};

/** Thrown when Gemini answers but the content fails paper-format validation (retryable). */
class GenerationFormatError extends Error {}

type GenerationSlot = {
  sectionLabel: string;
  itemNumber: number;
  marks: number;
  questionType: 'short_answer' | 'structured' | 'essay' | 'case_study' | 'practical';
  seed: {
    id: string | null;
    sourceFileId: string;
    sourceQuestionKey: string;
    sourceYear: number | null;
    historicalPaperKind: 'main' | 'supplementary' | null;
    marks: number;
    bodyText: string;
    sourceBody: Record<string, unknown>;
    topic: string;
    learningOutcome: string;
    difficulty: 'easy' | 'medium' | 'hard';
    cognitiveLevel: string;
  };
  slotSpec: Record<string, unknown>;
};

function fail(code: string): never {
  redirect(`/assessment/exam-setting/generate?error=${encodeURIComponent(code)}`);
}

function normalizedTokens(value: string): string[] {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter((token) => token.length > 2);
}

function wordShingles(value: string): Set<string> {
  const tokens = normalizedTokens(value);
  const width = Math.min(4, tokens.length);
  const shingles = new Set<string>();
  if (width === 0) return shingles;
  for (let index = 0; index <= tokens.length - width; index += 1) {
    shingles.add(tokens.slice(index, index + width).join(' '));
  }
  return shingles;
}

function similarity(left: string, right: string): number {
  const a = wordShingles(left);
  const b = wordShingles(right);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function parseModelJson(value: string): unknown {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned) as unknown;
}

function chunk<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

async function generateBatch(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  slots: GenerationSlot[],
): Promise<Array<z.infer<typeof generatedQuestionSchema>>> {
  const input = slots.map((slot, index) => ({
    index,
    targetType: slot.questionType,
    marks: slot.marks,
    topic: slot.seed.topic,
    learningOutcome: slot.seed.learningOutcome,
    difficulty: slot.seed.difficulty,
    cognitiveLevel: slot.seed.cognitiveLevel,
    sourceQuestion: slot.seed.bodyText,
  }));
  const prompt = [
    'You write draft college-level examination questions for a Human Nutrition and Dietetics programme.',
    'Return only a valid JSON array, with exactly one object for each input item and the same index order.',
    'Use each historical item only as a guide to its topic and learning intent. Create a genuinely new question: change the scenario, data, framing, and sentence structure; never copy a sentence or merely swap synonyms. Preserve scientific meaning and the requested difficulty and cognitive level. Keep standard clinical and scientific terminology accurate.',
    'This college paper format does not allow multiple-choice questions. Never produce options or answer choices. Every item is a written short-answer or structured question.',
    'Options must always be an empty array. Provide a clear stem and numbered/lettered parts whose marks add up exactly to the requested marks when parts are used. For a short-answer item without parts, use an empty parts array.',
    'Every part mark must be a whole number (1, 2, 3, ...). Never use half or decimal marks, even if the historical item did. The historical item may carry a different mark value from the target; always scale the question to the requested marks.',
    'Include topic, learningOutcome, difficulty (easy|medium|hard), cognitiveLevel (recall|comprehension|application|analysis), and derivationMode (reword|rescenario|new_from_notes). Use rescenario when introducing a new clinical, community, laboratory, or food-service scenario; otherwise use reword.',
    'Each object must contain: index, stem, options, parts (objects with label,text,marks), topic, learningOutcome, difficulty, cognitiveLevel, derivationMode.',
    JSON.stringify(input),
  ].join('\n\n');

  const validate = (text: string): Array<z.infer<typeof generatedQuestionSchema>> => {
    let raw: unknown;
    try {
      raw = parseModelJson(text);
    } catch {
      throw new GenerationFormatError('Gemini returned malformed JSON. Try generating again.');
    }
    if (!Array.isArray(raw) || raw.length !== slots.length) throw new GenerationFormatError('Gemini returned an incomplete set of questions. Try generating again.');
    return raw.map((candidate, index) => {
      if (typeof candidate !== 'object' || candidate === null || !('index' in candidate) || candidate.index !== index) {
        throw new GenerationFormatError('Gemini returned questions in an invalid order. Try generating again.');
      }
      const parsed = generatedQuestionSchema.safeParse(candidate);
      if (!parsed.success) throw new GenerationFormatError(`A generated question did not meet the paper format (item ${slots[index].sectionLabel}${slots[index].itemNumber}). Try again.`);
      const slot = slots[index];
      if (parsed.data.parts.length > 0
        && parsed.data.parts.reduce((sum, part) => sum + part.marks, 0) !== slot.marks) {
        throw new GenerationFormatError(`Generated question ${slot.sectionLabel}${slot.itemNumber} does not add to ${slot.marks} marks. Try again.`);
      }
      return parsed.data;
    });
  };

  // Format failures are usually one-off model slips; retry the batch once before failing the paper.
  const formatAttempts = 2;
  for (let formatAttempt = 0; ; formatAttempt += 1) {
    let result: Awaited<ReturnType<typeof model.generateContent>> | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: generatedBatchResponseSchema,
            temperature: 0.75,
          },
        });
        break;
      } catch (error) {
        const canRetry = error instanceof GoogleGenerativeAIFetchError
          && (error.status === 429 || error.status === 503);
        if (!canRetry || attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      }
    }
    if (!result) throw new Error('Gemini returned no response.');
    try {
      return validate(result.response.text());
    } catch (error) {
      if (!(error instanceof GenerationFormatError) || formatAttempt >= formatAttempts - 1) throw error;
      console.warn(`[exam-generation] ${error.message} Retrying batch (attempt ${formatAttempt + 2}/${formatAttempts}).`);
    }
  }
}

export async function generateExamPaperAction(formData: FormData) {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) fail('department');
  const parsedInput = generationInput.safeParse({
    unitId: formData.get('unitId'),
    blueprintId: formData.get('blueprintId'),
    periodId: formData.get('periodId'),
    paperKind: formData.get('paperKind'),
  });
  if (!parsedInput.success) fail('invalid');
  if (!process.env.GEMINI_API_KEY) fail('provider');

  const supabase = await createClient();
  const { unitId, blueprintId, periodId, paperKind } = parsedInput.data;
  const [unitResult, blueprintResult, periodResult, sourceResult] = await Promise.all([
    supabase.from('units').select('id,name,department_id,programme_id').eq('id', unitId).eq('department_id', profile.activeDepartmentId).eq('is_active', true).maybeSingle(),
    supabase.from('exam_blueprints').select('id,name,programme_id,version_number,total_marks,duration_minutes,layout').eq('id', blueprintId).eq('department_id', profile.activeDepartmentId).eq('status', 'active').maybeSingle(),
    supabase.from('academic_periods').select('id').eq('id', periodId).in('status', ['active', 'planned']).maybeSingle(),
    supabase.from('exam_source_files').select('id,unit_id,exam_year,paper_kind,extracted_text').eq('department_id', profile.activeDepartmentId).eq('unit_id', unitId).eq('source_type', 'past_paper').in('parse_status', ['parsed', 'needs_review']).order('created_at', { ascending: true }).limit(1000),
  ]);
  if (unitResult.error || !unitResult.data) fail('unit');
  if (blueprintResult.error || !blueprintResult.data) fail('blueprint');
  if (blueprintResult.data.programme_id && blueprintResult.data.programme_id !== unitResult.data.programme_id) fail('blueprint');
  if (periodResult.error || !periodResult.data) fail('period');
  if (sourceResult.error) fail('source');

  const { data: duplicatePaper, error: duplicateError } = await supabase.from('exam_papers').select('id')
    .eq('department_id', profile.activeDepartmentId).eq('unit_id', unitId).eq('academic_period_id', periodId).eq('paper_kind', paperKind).maybeSingle();
  if (duplicateError) fail('database');
  if (duplicatePaper) fail('duplicate');

  const sourceFiles = sourceResult.data ?? [];
  const sourceIds = sourceFiles.map((source) => source.id);
  if (sourceIds.length === 0) fail('no-sources');
  const { data: savedSeeds, error: savedSeedError } = await supabase.from('exam_questions')
    .select('id,source_file_id,source_question_key,topic,learning_outcome,difficulty,cognitive_level')
    .in('source_file_id', sourceIds).eq('department_id', profile.activeDepartmentId).eq('origin', 'historical');
  if (savedSeedError) fail('database');
  const savedByKey = new Map<string, NonNullable<typeof savedSeeds>[number]>((savedSeeds ?? []).flatMap((seed) => seed.source_file_id && seed.source_question_key
    ? [[`${seed.source_file_id}:${seed.source_question_key}`, seed] as const] : []));

  const parsedSources = sourceFiles.map((source) => ({
    source,
    questions: getParsedHistoricalQuestions(source.extracted_text ?? '')
      .filter((question): question is typeof question & { marks: number } => question.marks !== null),
  }));
  const seeds = parsedSources.flatMap(({ source, questions }) => questions.flatMap((question) => {
    const persisted = savedByKey.get(`${source.id}:${question.key}`);
    return [{
      id: persisted?.id ?? null,
      sourceFileId: source.id,
      sourceQuestionKey: question.key,
      sourceYear: source.exam_year,
      bodyText: question.bodyText,
      sourceBody: question.sourceBody,
      topic: persisted?.topic || unitResult.data.name,
      learningOutcome: persisted?.learning_outcome ?? '',
      difficulty: persisted?.difficulty ?? 'medium',
      cognitiveLevel: persisted?.cognitive_level ?? '',
      marks: question.marks,
      historicalPaperKind: source.paper_kind,
      questionType: question.questionType,
    }];
  }));
  if (seeds.length === 0) fail('no-questions');

  const blueprint = blueprintResult.data;
  const layout = typeof blueprint.layout === 'object' && blueprint.layout !== null ? blueprint.layout : null;
  const sections = layout && Array.isArray(layout.sections) ? layout.sections : [];
  const slots: GenerationSlot[] = [];
  for (const sectionValue of sections) {
    if (typeof sectionValue !== 'object' || sectionValue === null) continue;
    const section = sectionValue as Record<string, unknown>;
    const label = typeof section.label === 'string' ? section.label : '';
    const questionCount = typeof section.question_count === 'number' ? section.question_count : 0;
    const marksEach = typeof section.marks_each === 'number' ? section.marks_each : 0;
    const questionType = section.question_type;
    if (!/^[A-E]$/.test(label) || !Number.isInteger(questionCount) || questionCount < 1 || questionCount > 100
      || !Number.isInteger(marksEach) || marksEach < 1 || marksEach > 100
      || !['short_answer', 'structured', 'essay', 'case_study', 'practical'].includes(String(questionType))) {
      fail('blueprint-layout');
    }
    const choice = typeof section.choice === 'object' && section.choice !== null ? section.choice as Record<string, unknown> : null;
    for (let index = 0; index < questionCount; index += 1) {
      slots.push({
        sectionLabel: label,
        itemNumber: index + 1,
        marks: marksEach,
        questionType: questionType as GenerationSlot['questionType'],
        seed: seeds[0],
        slotSpec: {
          title: typeof section.title === 'string' ? section.title : `Section ${label}`,
          questionType,
          marks: marksEach,
          choice: choice ?? undefined,
        },
      });
    }
  }
  if (slots.length === 0) fail('blueprint-layout');
  if (seeds.length < slots.length) fail('not-enough-questions');

  const { data: generatedSeedUses, error: usageError } = await supabase.from('exam_questions')
    .select('seed_question_id').eq('department_id', profile.activeDepartmentId).eq('unit_id', unitId).eq('origin', 'generated');
  if (usageError) fail('database');
  const useCounts = new Map<string, number>();
  for (const use of generatedSeedUses ?? []) if (use.seed_question_id) useCounts.set(use.seed_question_id, (useCounts.get(use.seed_question_id) ?? 0) + 1);
  const usedThisPaper = new Set<string>();
  for (let start = 0; start < slots.length; start += 1) {
    const slotMarks = slots[start].marks;
    const candidatePool = [...seeds].sort((left, right) => (left.id ? useCounts.get(left.id) ?? 0 : 0) - (right.id ? useCounts.get(right.id) ?? 0 : 0)
      // Prefer seeds sized like the slot so Gemini rewrites a comparable question instead of rescaling a mismatched one.
      || Math.abs(left.marks - slotMarks) - Math.abs(right.marks - slotMarks)
      || (left.sourceYear ?? 0) - (right.sourceYear ?? 0)
      || left.sourceQuestionKey.localeCompare(right.sourceQuestionKey));
    const seed = candidatePool.find((candidate) => !usedThisPaper.has(`${candidate.sourceFileId}:${candidate.sourceQuestionKey}`));
    if (!seed) fail('not-enough-questions');
    usedThisPaper.add(`${seed.sourceFileId}:${seed.sourceQuestionKey}`);
    slots[start].seed = seed;
  }

  let model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
  try {
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = client.getGenerativeModel({ model: process.env.EXAM_GENERATION_MODEL || 'gemini-3.8-flash' });
  } catch {
    fail('provider');
  }

  const batches = chunk(slots, 8);
  let generated: Array<z.infer<typeof generatedQuestionSchema>>;
  try {
    generated = [];
    for (const batch of batches) generated.push(...await generateBatch(model, batch));
  } catch (error) {
    console.error('[exam-generation] Generation failed:', error instanceof Error ? error.message : error);
    if (error instanceof GoogleGenerativeAIFetchError) {
      if (error.status === 401 || error.status === 403) fail('provider-auth');
      if (error.status === 404) fail('provider-model');
      if (error.status === 429) fail('provider-quota');
      if (error.status !== undefined && error.status >= 500) fail('provider-unavailable');
      fail('provider-error');
    }
    fail('generation-format');
  }

  const selectedSeedKeys = new Set(slots.map((slot) => `${slot.seed.sourceFileId}:${slot.seed.sourceQuestionKey}`));
  const selectedSeedRows = seeds.filter((seed) => selectedSeedKeys.has(`${seed.sourceFileId}:${seed.sourceQuestionKey}`)).map((seed) => ({
    department_id: profile.activeDepartmentId,
    unit_id: unitId,
    topic: seed.topic,
    learning_outcome: seed.learningOutcome || null,
    question_type: seed.questionType,
    marks: seed.marks,
    difficulty: seed.difficulty,
    cognitive_level: seed.cognitiveLevel || null,
    body: seed.sourceBody,
    body_text: seed.bodyText,
    origin: 'historical',
    source_file_id: seed.sourceFileId,
    source_question_key: seed.sourceQuestionKey,
    historical_year: seed.sourceYear,
    historical_paper_kind: seed.historicalPaperKind,
    status: 'draft',
    created_by: profile.id,
  }));
  const { data: persistedSelectedSeeds, error: persistSelectedError } = await supabase.from('exam_questions')
    .upsert(selectedSeedRows, { onConflict: 'source_file_id,source_question_key' })
    .select('id,source_file_id,source_question_key');
  if (persistSelectedError) fail('database');
  const selectedSeedIds = new Map((persistedSelectedSeeds ?? []).flatMap((seed) => seed.source_file_id && seed.source_question_key
    ? [[`${seed.source_file_id}:${seed.source_question_key}`, seed.id] as const] : []));
  if (selectedSeedIds.size !== selectedSeedKeys.size) fail('database');

  const items = slots.map((slot, index) => {
    const candidate = generated[index];
    const body = { stem: candidate.stem, parts: candidate.parts.map((part) => ({ label: part.label, text: part.text, own_marks: part.marks })) };
    const bodyText = [candidate.stem, ...candidate.parts.map((part) => part.text)].join('\n');
    const maxSimilarity = Math.max(0, ...seeds.map((seed) => similarity(bodyText, seed.bodyText)));
    return {
      section_label: slot.sectionLabel,
      item_number: slot.itemNumber,
      marks: slot.marks,
      slot_spec: slot.slotSpec,
      question: {
        topic: candidate.topic,
        learning_outcome: candidate.learningOutcome || slot.seed.learningOutcome || null,
        question_type: slot.questionType,
        difficulty: candidate.difficulty,
        cognitive_level: candidate.cognitiveLevel,
        body,
        body_text: bodyText,
        derivation_mode: candidate.derivationMode,
        seed_question_id: selectedSeedIds.get(`${slot.seed.sourceFileId}:${slot.seed.sourceQuestionKey}`),
        max_similarity: Math.round(maxSimilarity * 1000) / 1000,
      },
    };
  });

  const { data: paperId, error: commitError } = await supabase.rpc('exam_commit_generated_paper', {
    requested_unit: unitId,
    requested_period: periodId,
    requested_blueprint: blueprintId,
    requested_kind: paperKind,
    requested_items: items,
  });
  if (commitError || !paperId) fail(commitError?.code === '23505' ? 'duplicate' : 'commit');

  revalidatePath('/assessment/exam-setting/generate');
  revalidatePath('/assessment/exam-setting/moderate');
  redirect(`/assessment/exam-setting/generate?created=${encodeURIComponent(paperId)}`);
}
