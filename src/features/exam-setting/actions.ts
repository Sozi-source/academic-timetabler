'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

const blueprintInput = z.object({
  name: z.string().trim().min(2).max(120),
  programmeId: z.union([z.uuid(), z.literal('')]),
  versionNumber: z.coerce.number().int().min(1).max(999),
  durationMinutes: z.coerce.number().int().min(30).max(360),
});

function blueprintPath(message: string): never {
  redirect(`/assessment/exam-setting?${message}`);
}

export async function createExamBlueprintAction(formData: FormData) {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) blueprintPath('error=department');

  const parsed = blueprintInput.safeParse({
    name: formData.get('name'),
    programmeId: formData.get('programmeId'),
    versionNumber: formData.get('versionNumber'),
    durationMinutes: formData.get('durationMinutes'),
  });
  if (!parsed.success) blueprintPath('error=invalid');

  const supabase = await createClient();
  const programmeId = parsed.data.programmeId || null;
  if (programmeId) {
    const { data: programme, error: programmeError } = await supabase
      .from('programmes')
      .select('id')
      .eq('id', programmeId)
      .eq('department_id', profile.activeDepartmentId)
      .eq('is_active', true)
      .maybeSingle();
    if (programmeError || !programme) blueprintPath('error=programme');
  }

  const layout = {
    instructions: [
      'Answer all questions in Section A.',
      'Answer any three questions in Section B.',
    ],
    sections: [
      {
        label: 'A',
        title: 'Multiple Choice Questions',
        question_type: 'mcq',
        question_count: 40,
        marks_each: 1,
        choice: { answer: 40, of: 40 },
      },
      {
        label: 'B',
        title: 'Structured Questions',
        question_type: 'structured',
        question_count: 4,
        marks_each: 20,
        choice: { answer: 3, of: 4 },
      },
    ],
  };

  const { error } = await supabase.from('exam_blueprints').insert({
    department_id: profile.activeDepartmentId,
    name: parsed.data.name,
    programme_id: programmeId,
    version_number: parsed.data.versionNumber,
    status: 'draft',
    total_marks: 100,
    duration_minutes: parsed.data.durationMinutes,
    layout,
    coverage_rules: {},
    created_by: profile.id,
  });

  if (error) {
    blueprintPath(error.code === '23505' ? 'error=duplicate' : 'error=save');
  }

  revalidatePath('/assessment/exam-setting');
  blueprintPath('created=1');
}

export async function setExamBlueprintStatusAction(formData: FormData) {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) blueprintPath('error=department');

  const blueprintId = formData.get('blueprintId');
  const status = formData.get('status');
  if (
    typeof blueprintId !== 'string'
    || !z.uuid().safeParse(blueprintId).success
    || (status !== 'active' && status !== 'retired')
  ) {
    blueprintPath('error=invalid');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('exam_set_blueprint_status', {
    requested_blueprint: blueprintId,
    requested_status: status,
  });
  if (error) blueprintPath('error=status');

  revalidatePath('/assessment/exam-setting');
  blueprintPath(`status=${status}`);
}
