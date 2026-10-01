// ============================================================
// Lecture Notes — Supabase Queries
// ============================================================
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getApprovedCurriculumForUnitCode } from '@/features/teaching-documents/curriculum-content/queries';
import type { AuthenticatedProfile } from '@/features/auth/types';
import type {
  LectureMaterial,
  LectureNoteJob,
  LectureNotesAllocationSummary,
  RetrievedChunk,
} from './types';

// ── Materials ─────────────────────────────────────────────────

export async function getLectureMaterialsForUnit(unitId: string): Promise<LectureMaterial[]> {
  const db = await createClient();
  const { data, error } = await db
    .from('lecture_materials')
    .select('*')
    .eq('unit_id', unitId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch lecture materials: ${error.message}`);
  return (data ?? []) as unknown as LectureMaterial[];
}

export async function getLectureMaterial(id: string): Promise<LectureMaterial | null> {
  const db = await createClient();
  const { data, error } = await db
    .from('lecture_materials')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch lecture material: ${error.message}`);
  return data as unknown as LectureMaterial | null;
}

// ── Generation Jobs ───────────────────────────────────────────

export async function getLectureNoteJobsForUnit(unitId: string): Promise<LectureNoteJob[]> {
  const db = await createClient();
  const { data, error } = await db
    .from('lecture_note_jobs')
    .select('*')
    .eq('unit_id', unitId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch lecture note jobs: ${error.message}`);
  return (data ?? []) as unknown as LectureNoteJob[];
}

export async function getLectureNoteJob(id: string): Promise<LectureNoteJob | null> {
  const db = await createClient();
  const { data, error } = await db
    .from('lecture_note_jobs')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch lecture note job: ${error.message}`);
  return data as unknown as LectureNoteJob | null;
}

// ── Unit listing for the workspace landing page ───────────────

/**
 * Returns all teaching allocations for the current trainer or HOD,
 * enriched with material + job counts for the dashboard.
 */
export async function getLectureNotesUnitList(
  profile?: AuthenticatedProfile,
): Promise<LectureNotesAllocationSummary[]> {
  const adminDb = createAdminClient();

  let query = adminDb
    .from('teaching_allocations')
    .select(
      `id,
       unit_id,
       units (code, name),
       cohorts (name),
       academic_periods (name)`
    )
    .in('status', ['draft', 'active'])
    .order('created_at', { ascending: false });

  if (profile?.role === 'trainer') {
    const { data: trainer } = await adminDb
      .from('trainers')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!trainer) return [];
    query = query.eq('trainer_id', trainer.id);
  } else if (profile?.role === 'hod' && profile.activeDepartmentId) {
    query = query.eq('department_id', profile.activeDepartmentId);
  }

  const { data: allocations, error } = await query;

  if (error) throw new Error(`Failed to fetch allocations: ${error.message}`);
  if (!allocations || allocations.length === 0) return [];

  const unitIds = [...new Set(allocations.map((a) => a.unit_id))];

  // Fetch material counts per unit
  const { data: materialCounts } = await adminDb
    .from('lecture_materials')
    .select('unit_id')
    .in('unit_id', unitIds);

  // Fetch job counts per unit
  const { data: jobCounts } = await adminDb
    .from('lecture_note_jobs')
    .select('unit_id')
    .in('unit_id', unitIds);

  const matCountMap = new Map<string, number>();
  for (const m of materialCounts ?? []) {
    matCountMap.set(m.unit_id, (matCountMap.get(m.unit_id) ?? 0) + 1);
  }
  const jobCountMap = new Map<string, number>();
  for (const j of jobCounts ?? []) {
    jobCountMap.set(j.unit_id, (jobCountMap.get(j.unit_id) ?? 0) + 1);
  }

  return allocations.map((a) => {
    const unit = (a.units as unknown) as { code: string; name: string } | null;
    const cohort = (a.cohorts as unknown) as { name: string } | null;
    const period = (a.academic_periods as unknown) as { name: string } | null;
    return {
      allocationId: a.id,
      unitId: a.unit_id,
      unitCode: unit?.code ?? '—',
      unitName: unit?.name ?? '—',
      cohortName: cohort?.name ?? '—',
      academicPeriodName: period?.name ?? '—',
      materialCount: matCountMap.get(a.unit_id) ?? 0,
      jobCount: jobCountMap.get(a.unit_id) ?? 0,
    };
  });
}

// ── Vector retrieval (called server-side) ─────────────────────

/**
 * Calls the pgvector RPC function to retrieve the top-k most
 * semantically relevant chunks for a topic query embedding.
 */
export async function retrieveSimilarChunks({
  queryEmbedding,
  unitId,
  trainerId,
  matchCount = 8,
  similarityThreshold = 0.45,
}: {
  queryEmbedding: number[];
  unitId: string;
  trainerId: string;
  matchCount?: number;
  similarityThreshold?: number;
}): Promise<RetrievedChunk[]> {
  const db = await createClient();
  const { data, error } = await db.rpc('match_lecture_chunks', {
    query_embedding: queryEmbedding,
    p_unit_id: unitId,
    p_trainer_id: trainerId,
    match_count: matchCount,
    similarity_threshold: similarityThreshold,
  });

  if (error) throw new Error(`Vector search failed: ${error.message}`);
  return (data ?? []) as RetrievedChunk[];
}

// ── Course outline context ────────────────────────────────────

/**
 * Fetches course outline data for a unit from the authoritative curriculum registry.
 * Resolves uploaded course outlines, active versions, and canonical TVET syllabus fallbacks.
 * Returns topics, learning outcomes, and weekly plan context.
 */
export async function getCourseOutlineContext(unitId: string): Promise<{
  topics: string[];
  learningOutcomes: string[];
  weeklyPlanText: string;
} | null> {
  const adminDb = createAdminClient();

  // 1. Fetch unit code & name
  const { data: unit, error: unitError } = await adminDb
    .from('units')
    .select('code, name')
    .eq('id', unitId)
    .maybeSingle();

  if (unitError || !unit) {
    return null;
  }

  // 2. Fetch approved curriculum (handles trainer workbooks, curriculum_document_versions, and canonical syllabi)
  const curriculum = await getApprovedCurriculumForUnitCode(
    unit.code,
    unit.name,
    'course_outline',
  );

  const topics: string[] = [];
  const learningOutcomes: string[] = [...(curriculum.learningOutcomes ?? [])];
  const weeklyLines: string[] = [];

  for (const week of curriculum.weeklySchedule ?? []) {
    if (week.topicTitle) {
      topics.push(week.topicTitle);
    }
    if (week.specificLearningOutcomes) {
      learningOutcomes.push(week.specificLearningOutcomes);
    }
    const lineParts: string[] = [`Week ${week.weekNumber}: ${week.topicTitle}`];
    if (week.subTopics && week.subTopics.length > 0) {
      lineParts.push(`Coverage: ${week.subTopics.join(', ')}`);
    }
    if (week.specificLearningOutcomes) {
      lineParts.push(`Outcomes: ${week.specificLearningOutcomes}`);
    }
    if (week.learningActivities) {
      lineParts.push(`Activities: ${week.learningActivities}`);
    }
    weeklyLines.push(lineParts.join('\n  '));
  }

  return {
    topics: [...new Set(topics.filter((t) => t.trim().length > 0))],
    learningOutcomes: [...new Set(learningOutcomes.filter((o) => o.trim().length > 0))],
    weeklyPlanText: weeklyLines.join('\n\n'),
  };
}
