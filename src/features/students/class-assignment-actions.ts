'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

export async function addStudentClassAssignment(formData: FormData) {
  await requireHodAccess();
  const studentId = formData.get('studentId');
  const registrationId = formData.get('registrationId');
  const allocationId = formData.get('allocationId');
  const reasonValue = formData.get('reason');
  const reason = typeof reasonValue === 'string' ? reasonValue.trim() : '';
  if ([studentId, registrationId, allocationId].some((value) => typeof value !== 'string') || reason.length < 3) {
    redirect(`/students/registry/${String(studentId)}/class-assignments?error=invalid`);
  }

  const supabase = await createClient();
  const { data: student } = await supabase.from('students').select('id, programme_id').eq('id', studentId as string).maybeSingle();
  if (!student) redirect('/students/registry?error=student');

  const { data: registration } = await supabase
    .from('student_unit_registrations')
    .select('id, academic_period_id')
    .eq('id', registrationId as string)
    .eq('student_id', student.id)
    .eq('registration_status', 'registered')
    .maybeSingle();
  if (!registration) redirect(`/students/registry/${student.id}/class-assignments?error=registration`);

  const { error } = await supabase.from('student_class_assignments').insert({
    student_id: student.id,
    academic_period_id: registration.academic_period_id,
    source_registration_id: registration.id,
    teaching_allocation_id: allocationId as string,
    reason,
  });
  if (error?.code === '23505') {
    redirect(`/students/registry/${student.id}/class-assignments?error=duplicate`);
  }
  if (error) redirect(`/students/registry/${student.id}/class-assignments?error=${encodeURIComponent(error.message)}`);

  revalidatePath(`/students/registry/${student.id}`);
  revalidatePath(`/students/registry/${student.id}/class-assignments`);
  redirect(`/students/registry/${student.id}/class-assignments?saved=1`);
}

export async function deactivateStudentClassAssignment(formData: FormData) {
  await requireHodAccess();
  const studentId = formData.get('studentId');
  const assignmentId = formData.get('assignmentId');
  if (typeof studentId !== 'string' || typeof assignmentId !== 'string') return;
  const supabase = await createClient();
  const { error } = await supabase
    .from('student_class_assignments')
    .update({ is_active: false })
    .eq('id', assignmentId)
    .eq('student_id', studentId)
    .eq('is_active', true);
  if (error) redirect(`/students/registry/${studentId}/class-assignments?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/students/registry/${studentId}`);
  revalidatePath(`/students/registry/${studentId}/class-assignments`);
  redirect(`/students/registry/${studentId}/class-assignments?removed=1`);
}
