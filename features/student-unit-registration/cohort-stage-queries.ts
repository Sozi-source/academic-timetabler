import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type { CohortStageSetup } from './cohort-stage-types';

export async function getCohortStageSetups(): Promise<CohortStageSetup[]> {
  const profile = await requireHodAccess();

  if (!profile.activeDepartmentId) {
    return [];
  }

  const supabase = await createClient();

  const { data: programmes, error: programmeError } = await supabase
    .from('programmes')
    .select('id, code')
    .eq('department_id', profile.activeDepartmentId)
    .eq('is_active', true);

  if (programmeError) {
    throw new Error(`Unable to load programmes: ${programmeError.message}`);
  }

  const programmeIds = (programmes ?? []).map((programme) => programme.id);

  if (programmeIds.length === 0) {
    return [];
  }

  const programmeCode = new Map(
    (programmes ?? []).map((programme) => [programme.id, programme.code]),
  );

  const [cohortResult, stageResult] = await Promise.all([
    supabase
      .from('cohorts')
      .select('id, name, programme_id, current_stage_id')
      .in('programme_id', programmeIds)
      .in('status', ['planned', 'active'])
      .order('name', { ascending: true }),
    supabase
      .from('programme_stages')
      .select('id, programme_id, code, name, sequence_number')
      .in('programme_id', programmeIds)
      .eq('is_active', true)
      .order('sequence_number', { ascending: true }),
  ]);

  if (cohortResult.error) {
    throw new Error(`Unable to load cohorts: ${cohortResult.error.message}`);
  }

  if (stageResult.error) {
    throw new Error(`Unable to load programme stages: ${stageResult.error.message}`);
  }

  const stageCodeById = new Map(
    (stageResult.data ?? []).map((stage) => [stage.id, stage.code]),
  );

  return (cohortResult.data ?? []).map((cohort) => ({
    cohortId: cohort.id,
    cohortName: cohort.name,
    programmeId: cohort.programme_id,
    programmeCode: programmeCode.get(cohort.programme_id) ?? '-',
    currentStageId: cohort.current_stage_id,
    currentStageCode: cohort.current_stage_id
      ? stageCodeById.get(cohort.current_stage_id) ?? null
      : null,
    stages: (stageResult.data ?? [])
      .filter((stage) => stage.programme_id === cohort.programme_id)
      .map((stage) => ({
        id: stage.id,
        code: stage.code,
        name: stage.name,
        sequenceNumber: stage.sequence_number,
      })),
  }));
}
