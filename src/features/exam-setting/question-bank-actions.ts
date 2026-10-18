'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import { getHistoricalQuestionDetails } from './question-bank';

const inputSchema = z.object({
  paperId: z.uuid(),
  questionKey: z.string().regex(/^[A-E]:\d{1,2}$/),
  topic: z.string().trim().min(2).max(240),
  learningOutcome: z.string().trim().max(1000),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  cognitiveLevel: z.enum(['', 'recall', 'comprehension', 'application', 'analysis']),
});

const bulkInputSchema = z.object({
  paperId: z.uuid(),
  questionKeys: z.array(z.string().regex(/^[A-E]:\d{1,2}$/)).min(1).max(100),
  topic: z.string().trim().min(2).max(240),
  learningOutcome: z.string().trim().max(1000),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  cognitiveLevel: z.enum(['', 'recall', 'comprehension', 'application', 'analysis']),
});

function questionBankPath(paperId: string, result: string): never {
  redirect(`/assessment/exam-setting/question-bank?paperId=${encodeURIComponent(paperId)}&${result}`);
}

export async function saveHistoricalQuestionTagAction(formData: FormData) {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) questionBankPath('', 'error=department');
  const parsed = inputSchema.safeParse({
    paperId: formData.get('paperId'),
    questionKey: formData.get('questionKey'),
    topic: formData.get('topic'),
    learningOutcome: formData.get('learningOutcome') ?? '',
    difficulty: formData.get('difficulty'),
    cognitiveLevel: formData.get('cognitiveLevel') ?? '',
  });
  if (!parsed.success) questionBankPath('', 'error=invalid');

  const supabase = await createClient();
  const { data: source, error: sourceError } = await supabase
    .from('exam_source_files')
    .select('id,unit_id,exam_year,paper_kind,extracted_text')
    .eq('id', parsed.data.paperId)
    .eq('department_id', profile.activeDepartmentId)
    .eq('source_type', 'past_paper')
    .in('parse_status', ['parsed', 'needs_review'])
    .maybeSingle();
  if (sourceError || !source) questionBankPath(parsed.data.paperId, 'error=source');
  const details = getHistoricalQuestionDetails(source.extracted_text ?? '', parsed.data.questionKey);
  if (!details || !details.parsed.marks) questionBankPath(parsed.data.paperId, 'error=question');

  const { error } = await supabase.from('exam_questions').upsert({
    department_id: profile.activeDepartmentId,
    unit_id: source.unit_id,
    topic: parsed.data.topic,
    learning_outcome: parsed.data.learningOutcome || null,
    question_type: details.parsed.questionType,
    marks: details.parsed.marks,
    difficulty: parsed.data.difficulty,
    cognitive_level: parsed.data.cognitiveLevel || null,
    body: details.body,
    body_text: details.parsed.bodyText,
    origin: 'historical',
    source_file_id: source.id,
    source_question_key: parsed.data.questionKey,
    historical_year: source.exam_year,
    historical_paper_kind: source.paper_kind,
    status: 'draft',
    created_by: profile.id,
  }, { onConflict: 'source_file_id,source_question_key' });
  if (error) questionBankPath(parsed.data.paperId, 'error=save');

  revalidatePath('/assessment/exam-setting/question-bank');
  questionBankPath(parsed.data.paperId, 'saved=1');
}

export async function bulkSaveHistoricalQuestionTagsAction(formData: FormData) {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) questionBankPath('', 'error=department');
  const parsed = bulkInputSchema.safeParse({
    paperId: formData.get('paperId'),
    questionKeys: formData.getAll('questionKeys').filter((value): value is string => typeof value === 'string'),
    topic: formData.get('topic'),
    learningOutcome: formData.get('learningOutcome') ?? '',
    difficulty: formData.get('difficulty'),
    cognitiveLevel: formData.get('cognitiveLevel') ?? '',
  });
  if (!parsed.success) {
    questionBankPath('', 'error=invalid');
  }
  if (new Set(parsed.data.questionKeys).size !== parsed.data.questionKeys.length) {
    questionBankPath(parsed.data.paperId, 'error=invalid');
  }

  const supabase = await createClient();
  const { data: source, error: sourceError } = await supabase
    .from('exam_source_files')
    .select('id,unit_id,exam_year,paper_kind,extracted_text')
    .eq('id', parsed.data.paperId)
    .eq('department_id', profile.activeDepartmentId)
    .eq('source_type', 'past_paper')
    .in('parse_status', ['parsed', 'needs_review'])
    .maybeSingle();
  if (sourceError || !source) questionBankPath(parsed.data.paperId, 'error=source');

  const rows = [];
  for (const questionKey of parsed.data.questionKeys) {
    const details = getHistoricalQuestionDetails(source.extracted_text ?? '', questionKey);
    if (!details || !details.parsed.marks) questionBankPath(parsed.data.paperId, 'error=question');
    rows.push({
      department_id: profile.activeDepartmentId,
      unit_id: source.unit_id,
      topic: parsed.data.topic,
      learning_outcome: parsed.data.learningOutcome || null,
      question_type: details.parsed.questionType,
      marks: details.parsed.marks,
      difficulty: parsed.data.difficulty,
      cognitive_level: parsed.data.cognitiveLevel || null,
      body: details.body,
      body_text: details.parsed.bodyText,
      origin: 'historical',
      source_file_id: source.id,
      source_question_key: questionKey,
      historical_year: source.exam_year,
      historical_paper_kind: source.paper_kind,
      status: 'draft',
      created_by: profile.id,
    });
  }

  const { error } = await supabase.from('exam_questions').upsert(rows, {
    onConflict: 'source_file_id,source_question_key',
  });
  if (error) questionBankPath(parsed.data.paperId, 'error=bulk');

  revalidatePath('/assessment/exam-setting/question-bank');
  questionBankPath(parsed.data.paperId, `bulkSaved=${rows.length}`);
}
