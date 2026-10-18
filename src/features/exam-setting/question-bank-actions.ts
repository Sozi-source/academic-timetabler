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
