'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

const path = '/timetable/unit-equivalence';

export async function approveEquivalenceGroupAction(formData: FormData) {
  await requireHodAccess();
  const unitIds = formData.getAll('unitId').map(String).filter(Boolean);
  const canonicalName = String(formData.get('canonicalName') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();
  if (unitIds.length < 2 || !canonicalName) redirect(`${path}?error=${encodeURIComponent('Select at least two units and provide a canonical name')}`);
  const db = await createClient();
  const { error } = await db.rpc('approve_unit_equivalence_group', {
    p_unit_ids: unitIds, p_canonical_name: canonicalName, p_notes: notes || null,
  });
  if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(path);
  revalidatePath('/timetable/units');
  revalidatePath('/timetable/unit-offerings');
  redirect(`${path}?approved=${unitIds.length}`);
}
