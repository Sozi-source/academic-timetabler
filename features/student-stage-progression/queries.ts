import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type { StageProgressionContext } from './types';

export async function getStageProgressionContext(): Promise<StageProgressionContext> {
  const profile = await requireHodAccess();

  if (!profile.activeDepartmentId) {
    return { cohorts: [], students: [] };
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
    return { cohorts: [], students: [] };
  }

  const codeByProgramme = new Map(
    (programmes ?? []).map((programme) => [programme.id, programme.code]),
  );

  const [studentResult, stageResult] = await Promise.all([
    supabase
      .from('students')
      .select(`
        id,
        admission_number,
        full_name,
        programme_id,
        current_cohort_id,
        current_stage_id,
        lifecycle_status,
        current_cohort:cohorts!students_current_cohort_id_fkey(id, name)
      `)
      .in('programme_id', programmeIds)
      .in('lifecycle_status', ['admitted', 'active'])
      .order('full_name', { ascending: true }),
    supabase
      .from('programme_stages')
      .select('id, programme_id, code, name, sequence_number')
      .in('programme_id', programmeIds)
      .eq('is_active', true)
      .order('sequence_number', { ascending: true }),
  ]);

  if (studentResult.error) {
    throw new Error(`Unable to load students: ${studentResult.error.message}`);
  }

  if (stageResult.error) {
    throw new Error(`Unable to load programme stages: ${stageResult.error.message}`);
  }

  const stageById = new Map(
    (stageResult.data ?? []).map((stage) => [stage.id, stage]),
  );

  const nextStageById = new Map<
    string,
    { id: string; code: string; name: string }
  >();

  for (const stage of stageResult.data ?? []) {
    const next = (stageResult.data ?? []).find(
      (candidate) =>
        candidate.programme_id === stage.programme_id &&
        candidate.sequence_number === stage.sequence_number + 1,
    );

    if (next) {
      nextStageById.set(stage.id, {
        id: next.id,
        code: next.code,
        name: next.name,
      });
    }
  }

  const students = (studentResult.data ?? []).map((student) => {
    const cohort = Array.isArray(student.current_cohort)
      ? student.current_cohort[0]
      : student.current_cohort;

    const currentStage = student.current_stage_id
      ? stageById.get(student.current_stage_id) ?? null
      : null;

    const nextStage = student.current_stage_id
      ? nextStageById.get(student.current_stage_id) ?? null
      : null;

    return {
      id: student.id,
      admissionNumber: student.admission_number,
      fullName: student.full_name,
      programmeCode: codeByProgramme.get(student.programme_id) ?? '-',
      cohortId: student.current_cohort_id,
      cohortName: cohort?.name ?? null,
      currentStageCode: currentStage?.code ?? null,
      currentStageName: currentStage?.name ?? null,
      nextStageCode: nextStage?.code ?? null,
      nextStageName: nextStage?.name ?? null,
      eligible: Boolean(nextStage),
      terminal: Boolean(currentStage) && !nextStage,
    };
  });

  const cohortMap = new Map<
    string,
    StageProgressionContext['cohorts'][number]
  >();

  for (const student of students) {
    if (!student.cohortId || !student.cohortName) continue;

    const current = cohortMap.get(student.cohortId);

    cohortMap.set(student.cohortId, {
      id: student.cohortId,
      name: student.cohortName,
      studentCount: (current?.studentCount ?? 0) + 1,
    });
  }

  return {
    cohorts: [...cohortMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    students,
  };
}
