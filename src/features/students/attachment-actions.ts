'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';

const transitionAttachmentSchema = z.object({
  entries: z
    .array(
      z.object({
        studentId: z.uuid(),
        targetStageId: z.uuid().nullable().optional(),
      }),
    )
    .min(1, 'Select at least one approved student to transition to attachment.')
    .max(500),
});

export type TransitionStudentsToAttachmentInput = z.infer<typeof transitionAttachmentSchema>;

/**
 * Transitions HOD-approved students to the `attachment` academic phase and
 * optionally advances their `current_stage_id` to their curriculum attachment stage.
 */
export async function transitionStudentsToAttachmentAction(
  input: TransitionStudentsToAttachmentInput,
): Promise<{ ok: true; updatedCount: number } | { ok: false; message: string }> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) {
    return { ok: false, message: 'No active working department selected.' };
  }

  const parsed = transitionAttachmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || 'Invalid attachment transition payload.' };
  }

  const admin = createAdminClient();
  const departmentId = profile.activeDepartmentId;
  const studentIds = [...new Set(parsed.data.entries.map((e) => e.studentId))];

  // Tenant isolation: verify all students belong to the HOD's active department.
  const { data: deptStudents, error: fetchError } = await admin
    .from('students')
    .select('id, programme_id')
    .eq('department_id', departmentId)
    .in('id', studentIds);

  if (fetchError) {
    return { ok: false, message: fetchError.message || 'Unable to verify student records.' };
  }

  const allowedStudentIds = new Set((deptStudents ?? []).map((s) => s.id));
  const validEntries = parsed.data.entries.filter((e) => allowedStudentIds.has(e.studentId));
  if (validEntries.length === 0) {
    return { ok: false, message: 'No matching students were found in your active department.' };
  }

  // Group updates by targetStageId to minimize DB calls while advancing stage accurately
  const byStage = new Map<string | null, string[]>();
  for (const entry of validEntries) {
    const key = entry.targetStageId ?? null;
    const list = byStage.get(key) ?? [];
    list.push(entry.studentId);
    byStage.set(key, list);
  }

  const now = new Date().toISOString();
  let updatedCount = 0;

  for (const [targetStageId, ids] of byStage.entries()) {
    const payload: {
      academic_phase: 'attachment';
      lifecycle_status: 'active';
      updated_at: string;
      current_stage_id?: string;
    } = {
      academic_phase: 'attachment',
      lifecycle_status: 'active',
      updated_at: now,
    };
    if (targetStageId) {
      payload.current_stage_id = targetStageId;
    }

    const { error: updateError } = await admin
      .from('students')
      .update(payload)
      .eq('department_id', departmentId)
      .in('id', ids);

    if (updateError) {
      return { ok: false, message: updateError.message || 'Unable to transition students to attachment.' };
    }
    updatedCount += ids.length;
  }

  revalidatePath('/students');
  revalidatePath('/students/registry');
  revalidatePath('/students/status');
  revalidatePath('/students/reports');
  revalidatePath('/students/attachment');
  return { ok: true, updatedCount };
}
