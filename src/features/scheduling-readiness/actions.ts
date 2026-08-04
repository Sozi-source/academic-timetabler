'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

const assignmentSchema = z.object({
  offeringId: z.string().uuid(),
  academicPeriodId: z.string().uuid(),
  trainerId: z.union([z.string().uuid(), z.literal('')]),
  preferredRoomId: z.union([z.string().uuid(), z.literal('')]),
  status: z.enum(['draft', 'active', 'suspended', 'completed', 'archived']),
  isTimetableEnabled: z.enum(['true', 'false']),
});

export async function updateTeachingOfferingReadinessAction(formData: FormData): Promise<void> {
  await requireHodAccess();

  const parsed = assignmentSchema.safeParse({
    offeringId: formData.get('offeringId'),
    academicPeriodId: formData.get('academicPeriodId'),
    trainerId: formData.get('trainerId'),
    preferredRoomId: formData.get('preferredRoomId'),
    status: formData.get('status'),
    isTimetableEnabled: formData.get('isTimetableEnabled'),
  });

  if (!parsed.success) {
    throw new Error('Invalid teaching offering allocation request.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('teaching_offerings')
    .update({
      trainer_id: parsed.data.trainerId || null,
      preferred_room_id: parsed.data.preferredRoomId || null,
      status: parsed.data.status,
      is_timetable_enabled: parsed.data.isTimetableEnabled === 'true',
    })
    .eq('id', parsed.data.offeringId)
    .eq('academic_period_id', parsed.data.academicPeriodId)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('The teaching offering was not updated.');

  revalidatePath('/timetable/readiness');
  revalidatePath('/timetable/generator');
  revalidatePath('/timetable/teaching-allocations');
}
