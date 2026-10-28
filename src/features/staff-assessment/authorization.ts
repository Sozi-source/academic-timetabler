import 'server-only';

import {
  createClient,
} from '@/lib/supabase/server';
import { getAuthenticatedProfile } from '@/features/auth/queries';
import { getStaffWorkspace } from './queries';

export async function trainerCanAccessAssessment(
  assessmentId: string,
): Promise<boolean> {
  if (!assessmentId) {
    return false;
  }

  const supabase = await createClient();

  if (assessmentId.startsWith('alloc-')) {
    const allocId = assessmentId.replace('alloc-', '');
    const profile = await getAuthenticatedProfile();

    if (profile?.role === 'trainer') {
      const workspace = await getStaffWorkspace(profile.id).catch(() => null);
      return Boolean(workspace?.allocations.some((allocation) => allocation.allocationId === allocId));
    }

    // For HOD / system_admin: verify the allocation exists AND belongs to their active department.
    // Using the user (RLS-scoped) client so department isolation is enforced.
    if (!profile?.activeDepartmentId) return false;

    const { data: alloc } = await supabase
      .from('teaching_allocations')
      .select('id, unit:units!inner(department_id, programme:programmes!inner(department_id))')
      .eq('id', allocId)
      .maybeSingle();

    if (!alloc) return false;

    // Resolve the effective department id from the unit or its programme.
    const unit = Array.isArray(alloc.unit) ? alloc.unit[0] : alloc.unit;
    const programme = unit
      ? (Array.isArray(unit.programme) ? unit.programme[0] : unit.programme)
      : null;
    const effectiveDeptId = unit?.department_id ?? programme?.department_id ?? null;

    return effectiveDeptId === profile.activeDepartmentId;
  }

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assessmentId);
  if (!isUUID) {
    return false;
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    'trainer_can_access_assessment',
    {
      target_assessment_id:
        assessmentId,
    },
  );

  return (
    !error &&
    data ===
      true
  );
}

export async function trainerCanAccessBatch(
  batchId: string,
): Promise<boolean> {
  if (!batchId) {
    return false;
  }

  const supabase =
    await createClient();

  const {
    data: batch,
    error: batchError,
  } = await supabase
    .from(
      'assessment_markbook_import_batches',
    )
    .select(
      'root_assessment_id',
    )
    .eq(
      'id',
      batchId,
    )
    .maybeSingle();

  if (
    batchError ||
    !batch?.root_assessment_id
  ) {
    return false;
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    'trainer_can_access_assessment',
    {
      target_assessment_id:
        batch.root_assessment_id,
    },
  );

  return (
    !error &&
    data ===
      true
  );
}
