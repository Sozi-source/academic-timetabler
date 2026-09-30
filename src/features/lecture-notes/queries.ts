// ============================================================
// Lecture Notes — Supabase Queries
// ============================================================
import { createClient } from '@/lib/supabase/server';
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
 * Returns all teaching allocations for the current HOD/trainer,
 * enriched with material + job counts for the dashboard.
 */
export async function getLectureNotesUnitList(): Promise<LectureNotesAllocationSummary[]> {
  const db = await createClient();

  const { data: allocations, error } = await db
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

  if (error) throw new Error(`Failed to fetch allocations: ${error.message}`);
  if (!allocations || allocations.length === 0) return [];

  const unitIds = [...new Set(allocations.map((a) => a.unit_id))];

  // Fetch material counts per unit
  const { data: materialCounts } = await db
    .from('lecture_materials')
    .select('unit_id')
    .in('unit_id', unitIds);

  // Fetch job counts per unit
  const { data: jobCounts } = await db
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
 * Fetches course outline data for a unit from the curriculum registry.
 * Returns topics, learning outcomes, and weekly plan context as plain text.
 */
export async function getCourseOutlineContext(unitId: string): Promise<{
  topics: string[];
  learningOutcomes: string[];
  weeklyPlanText: string;
} | null> {
  const db = await createClient();

  // Pull from curriculum_templates — scheme_of_work or course_outline entries
  const { data } = await db
    .from('curriculum_templates')
    .select('template_data')
    .eq('unit_id', unitId)
    .in('document_type', ['course_outline', 'scheme_of_work'])
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(2);

  if (!data || data.length === 0) return null;

  const combined = data.flatMap((row) => {
    const d = row.template_data as Record<string, unknown> | null;
    if (!d) return [];
    return [d];
  });

  const topics: string[] = [];
  const learningOutcomes: string[] = [];
  const weeklyLines: string[] = [];

  for (const d of combined) {
    if (Array.isArray(d['topics'])) {
      topics.push(...(d['topics'] as string[]));
    }
    if (Array.isArray(d['learning_outcomes'])) {
      learningOutcomes.push(...(d['learning_outcomes'] as string[]));
    }
    if (Array.isArray(d['weekly_plan'])) {
      const plan = d['weekly_plan'] as Array<{ week?: number; topic?: string; activities?: string }>;
      for (const w of plan) {
        weeklyLines.push(`Week ${w.week ?? '?'}: ${w.topic ?? ''} — ${w.activities ?? ''}`);
      }
    }
  }

  return {
    topics: [...new Set(topics)],
    learningOutcomes: [...new Set(learningOutcomes)],
    weeklyPlanText: weeklyLines.join('\n'),
  };
}
