import 'server-only';

import { cache } from 'react';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

export interface HistoricalQuestion {
  key: string;
  section: string;
  number: number;
  stem: string;
  bodyText: string;
  marks: number | null;
  questionType: 'mcq' | 'short_answer' | 'structured' | 'case_study';
  topic: string;
  learningOutcome: string;
  difficulty: 'easy' | 'medium' | 'hard';
  cognitiveLevel: string;
  sourceBody: Record<string, unknown>;
}

export interface HistoricalPaper {
  id: string;
  label: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  examYear: number | null;
  series: string | null;
  paperKind: string | null;
  questions: HistoricalQuestion[];
}

export interface QuestionBankWorkspace {
  departmentName: string;
  papers: HistoricalPaper[];
  selectedPaper: HistoricalPaper | null;
  topics: string[];
  learningOutcomes: string[];
  migrationRequired: boolean;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function object(value: unknown): JsonObject | null {
  return isObject(value) ? value : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function partsText(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const part = object(candidate);
    if (!part) return [];
    const own = text(part.text);
    return [...(own ? [`${text(part.label)} ${own}`.trim()] : []), ...partsText(part.parts)];
  });
}

function markTotal(value: unknown): number | null {
  const question = object(value);
  if (!question) return null;
  if (Array.isArray(question.parts) && question.parts.length > 0) {
    const values = question.parts.map((part) => markTotal(part));
    if (values.every((mark): mark is number => mark !== null)) {
      const sum = values.reduce((total, mark) => total + mark, 0);
      return sum > 0 && sum <= 32767 ? sum : null;
    }
  }
  return typeof question.own_marks === 'number' && Number.isInteger(question.own_marks)
    && question.own_marks > 0 && question.own_marks <= 32767
    ? question.own_marks
    : null;
}

function parsedQuestions(value: unknown, tags: Map<string, JsonObject>): HistoricalQuestion[] {
  const paper = object(value);
  if (!paper || !Array.isArray(paper.sections)) return [];
  const result: HistoricalQuestion[] = [];
  for (const sectionValue of paper.sections) {
    const section = object(sectionValue);
    if (!section || !Array.isArray(section.questions)) continue;
    const sectionLabel = text(section.label);
    if (!/^[A-E]$/.test(sectionLabel)) continue;
    for (const questionValue of section.questions) {
      const question = object(questionValue);
      if (!question || typeof question.number !== 'number' || !Number.isInteger(question.number)) continue;
      const number = question.number;
      const key = `${sectionLabel}:${number}`;
      const stem = text(question.text);
      const bodyText = [stem, ...partsText(question.parts)].filter(Boolean).join('\n');
      if (!bodyText) continue;
      const hasParts = Array.isArray(question.parts) && question.parts.length > 0;
      const questionType = question.kind === 'mcq'
        ? 'mcq'
        : sectionLabel === 'B' && hasParts
          ? 'case_study'
          : hasParts ? 'structured' : 'short_answer';
      const saved = tags.get(key);
      const difficulty = saved?.difficulty === 'easy' || saved?.difficulty === 'hard'
        ? saved.difficulty : 'medium';
      result.push({
        key,
        section: sectionLabel,
        number,
        stem,
        bodyText,
        marks: markTotal(question),
        questionType,
        topic: text(saved?.topic),
        learningOutcome: text(saved?.learning_outcome),
        difficulty,
        cognitiveLevel: text(saved?.cognitive_level),
        sourceBody: {
          section: sectionLabel,
          number,
          stem,
          parts: Array.isArray(question.parts) ? question.parts : [],
        },
      });
    }
  }
  return result;
}

export function getParsedHistoricalQuestions(extractedText: string): HistoricalQuestion[] {
  try {
    return parsedQuestions(JSON.parse(extractedText), new Map());
  } catch {
    return [];
  }
}

export function getHistoricalQuestionDetails(extractedText: string, key: string) {
  let value: unknown;
  try {
    value = JSON.parse(extractedText);
  } catch {
    return null;
  }
  const questions = parsedQuestions(value, new Map());
  const parsed = questions.find((question) => question.key === key);
  if (!parsed) return null;
  const paper = object(value);
  if (!paper || !Array.isArray(paper.sections)) return null;
  for (const sectionValue of paper.sections) {
    const section = object(sectionValue);
    if (!section || !Array.isArray(section.questions) || text(section.label) !== parsed.section) continue;
    for (const questionValue of section.questions) {
      const question = object(questionValue);
      if (!question || question.number !== parsed.number) continue;
      return {
        parsed,
        body: { section: parsed.section, number: parsed.number, stem: text(question.text), parts: Array.isArray(question.parts) ? question.parts : [] },
      };
    }
  }
  return null;
}

export const getQuestionBankWorkspace = cache(async (requestedPaperId?: string): Promise<QuestionBankWorkspace> => {
  const profile = await requireHodAccess();
  const empty: QuestionBankWorkspace = {
    departmentName: profile.departmentName,
    papers: [],
    selectedPaper: null,
    topics: [],
    learningOutcomes: [],
    migrationRequired: false,
  };
  if (!profile.activeDepartmentId) return empty;

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from('exam_source_files')
    .select('id,unit_id,exam_year,series,paper_kind,original_filename,extracted_text,units!inner(code,name,department_id)')
    .eq('department_id', profile.activeDepartmentId)
    .eq('source_type', 'past_paper')
    .in('parse_status', ['parsed', 'needs_review'])
    .order('exam_year', { ascending: false })
    .limit(100);
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return { ...empty, migrationRequired: true };
    throw new Error(`Unable to load historical exam papers: ${error.message}`);
  }

  const files = rows ?? [];
  const ids = files.map((file) => file.id);
  const { data: questionRows, error: questionError } = ids.length
    ? await supabase.from('exam_questions')
      .select('source_file_id,source_question_key,topic,learning_outcome,difficulty,cognitive_level')
      .in('source_file_id', ids)
      .eq('origin', 'historical')
    : { data: [], error: null };
  if (questionError) {
    if (questionError.code === '42703' || questionError.code === 'PGRST204') return { ...empty, migrationRequired: true };
    throw new Error(`Unable to load question tags: ${questionError.message}`);
  }
  const tagsByFile = new Map<string, Map<string, JsonObject>>();
  for (const tag of questionRows ?? []) {
    if (!tag.source_file_id || !tag.source_question_key) continue;
    const tags = tagsByFile.get(tag.source_file_id) ?? new Map<string, JsonObject>();
    tags.set(tag.source_question_key, tag);
    tagsByFile.set(tag.source_file_id, tags);
  }

  const papers: HistoricalPaper[] = files.flatMap((file) => {
    let extracted: unknown = null;
    try {
      extracted = file.extracted_text ? JSON.parse(file.extracted_text) : null;
    } catch {
      extracted = null;
    }
    const data = object(extracted);
    const unit = Array.isArray(file.units) ? file.units[0] : file.units;
    if (!unit || !text(unit.code) || !text(unit.name)) return [];
    const questions = parsedQuestions(data, tagsByFile.get(file.id) ?? new Map());
    if (questions.length === 0) return [];
    return [{
      id: file.id,
      label: `${file.exam_year ?? 'Undated'} ${file.series ?? ''} ${file.paper_kind ?? ''} · ${unit.code} · ${file.original_filename}`.trim(),
      unitId: file.unit_id,
      unitCode: unit.code,
      unitName: unit.name,
      examYear: file.exam_year,
      series: file.series,
      paperKind: file.paper_kind,
      questions,
    }];
  });

  const selectedPaper = papers.find((paper) => paper.id === requestedPaperId) ?? papers[0] ?? null;
  if (!selectedPaper) return { ...empty, papers };

  const { data: mapping, error: mappingError } = await supabase
    .from('curriculum_unit_mappings')
    .select('curriculum_family_id')
    .eq('unit_id', selectedPaper.unitId)
    .maybeSingle();
  if (mappingError) throw new Error(`Unable to load curriculum topics: ${mappingError.message}`);
  let topics: string[] = [];
  let learningOutcomes: string[] = [];
  if (mapping?.curriculum_family_id) {
    const [topicResult, outcomeResult] = await Promise.all([
      supabase.from('curriculum_weeks').select('topic').eq('curriculum_family_id', mapping.curriculum_family_id).order('week_number'),
      supabase.from('curriculum_learning_outcomes').select('learning_outcome').eq('curriculum_family_id', mapping.curriculum_family_id).order('sequence'),
    ]);
    if (topicResult.error) throw new Error(`Unable to load curriculum topics: ${topicResult.error.message}`);
    if (outcomeResult.error) throw new Error(`Unable to load learning outcomes: ${outcomeResult.error.message}`);
    topics = [...new Set((topicResult.data ?? []).map((row) => text(row.topic)).filter(Boolean))];
    learningOutcomes = (outcomeResult.data ?? []).map((row) => text(row.learning_outcome)).filter(Boolean);
  }
  return { ...empty, papers, selectedPaper, topics, learningOutcomes };
});
