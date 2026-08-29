import 'server-only';

import {
  createClient,
} from '@/lib/supabase/server';

export async function trainerCanAccessAssessment(
  assessmentId: string,
): Promise<boolean> {
  if (!assessmentId) {
    return false;
  }

  const supabase = await createClient();

  if (assessmentId.startsWith('alloc-')) {
    const allocId = assessmentId.replace('alloc-', '');
    const { data: alloc } = await supabase
      .from('teaching_allocations')
      .select('id')
      .eq('id', allocId)
      .maybeSingle();

    return Boolean(alloc);
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
