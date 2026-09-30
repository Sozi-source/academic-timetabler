// ============================================================
// Lecture Notes — Generate API Route
// POST /api/lecture-notes/generate
// ============================================================
// 1. Creates a job record
// 2. Embeds the topic query
// 3. Retrieves relevant chunks via pgvector
// 4. Builds grounded prompt
// 5. Calls Gemini 1.5 Pro
// 6. Exports DOCX + (optionally PDF via stream)
// 7. Uploads outputs to Supabase Storage

export const runtime = 'nodejs';
export const maxDuration = 120; // seconds — generation can take time

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireHodAccess } from '@/features/auth/authorization';
import { embedText } from '@/features/lecture-notes/embeddings/gemini-embeddings';
import { retrieveSimilarChunks, getCourseOutlineContext, getLectureMaterialsForUnit } from '@/features/lecture-notes/queries';
import { buildGroundedPrompt } from '@/features/lecture-notes/generation/prompt-builder';
import { generateLectureNotes } from '@/features/lecture-notes/generation/gemini-generator';
import { buildLectureNotesDocx } from '@/features/lecture-notes/export/docx-builder';
import type { GenerationGranularity } from '@/features/lecture-notes/types';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const db = await createClient();
  let jobId: string | null = null;

  try {
    const profile = await requireHodAccess();
    const body = await req.json() as {
      unitId: string;
      teachingAllocationId?: string | null;
      granularity: GenerationGranularity;
      sessionWeek?: number | null;
      topic: string;
    };

    const { unitId, teachingAllocationId, granularity, sessionWeek, topic } = body;

    if (!unitId || !granularity || !topic) {
      return NextResponse.json({ error: 'unitId, granularity, and topic are required.' }, { status: 400 });
    }

    // ── Create a pending job record ─────────────────────────────
    const { data: job, error: jobError } = await db
      .from('lecture_note_jobs')
      .insert({
        trainer_id: profile.id,
        teaching_allocation_id: teachingAllocationId ?? null,
        unit_id: unitId,
        department_id: profile.activeDepartmentId,
        granularity,
        session_week: sessionWeek ?? null,
        topic,
        status: 'processing',
      })
      .select('id')
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: `Failed to create job: ${jobError?.message}` }, { status: 500 });
    }
    jobId = job.id;

    // ── Fetch unit info ────────────────────────────────────────
    const { data: unit } = await db
      .from('units')
      .select('code, name')
      .eq('id', unitId)
      .single();

    const unitCode = (unit as { code: string; name: string } | null)?.code ?? unitId;
    const unitName = (unit as { code: string; name: string } | null)?.name ?? 'Unknown Unit';

    // ── Course outline context ─────────────────────────────────
    const outline = await getCourseOutlineContext(unitId);
    const learningOutcomes = outline?.learningOutcomes ?? [];
    const weeklyPlanContext = outline?.weeklyPlanText ?? '';

    // ── Embed the topic query ──────────────────────────────────
    const queryEmbedding = await embedText(topic);

    // ── Retrieve relevant chunks ───────────────────────────────
    const retrievedChunks = await retrieveSimilarChunks({
      queryEmbedding,
      unitId,
      trainerId: profile.id,
      matchCount: 10,
      similarityThreshold: 0.4,
    });

    // ── Material titles for the document footer ────────────────
    const materials = await getLectureMaterialsForUnit(unitId);
    const usedMaterialIds = new Set(retrievedChunks.map((c) => c.materialId));
    const sourceMaterialTitles = materials
      .filter((m) => usedMaterialIds.has(m.id))
      .map((m) => m.title);

    // ── Build grounded prompt ──────────────────────────────────
    const prompt = buildGroundedPrompt({
      unitCode,
      unitName,
      topic,
      sessionWeek,
      granularity,
      learningOutcomes,
      weeklyPlanContext,
      retrievedChunks,
    });

    // ── Call Gemini ────────────────────────────────────────────
    const { document: notesDocument, promptTokens, outputTokens } = await generateLectureNotes({
      prompt,
      unitCode,
      unitName,
      topic,
      granularity,
      sessionWeek,
      sourceMaterialTitles,
    });

    // ── Build DOCX ─────────────────────────────────────────────
    const docxBuffer = await buildLectureNotesDocx(notesDocument);

    // ── Upload DOCX to Supabase Storage ────────────────────────
    const timestamp = Date.now();
    const docxPath = `generated/${profile.id}/${unitId}/${jobId}/${timestamp}.docx`;

    const { error: uploadError } = await db.storage
      .from('lecture-notes')
      .upload(docxPath, docxBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      });

    const docxStoragePath = uploadError ? null : docxPath;

    if (uploadError) {
      console.warn('[lecture-notes/generate] DOCX upload failed:', uploadError.message);
    }

    // ── Mark job as done ───────────────────────────────────────
    await db.from('lecture_note_jobs').update({
      status: 'done',
      prompt_token_count: promptTokens,
      output_token_count: outputTokens,
      docx_storage_bucket: docxStoragePath ? 'lecture-notes' : null,
      docx_storage_path: docxStoragePath,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);

    // ── Return the document inline + metadata ──────────────────
    return NextResponse.json({
      jobId,
      unitCode,
      unitName,
      topic,
      granularity,
      sessionWeek: sessionWeek ?? null,
      sections: notesDocument.sections,
      sourceMaterials: sourceMaterialTitles,
      chunkCount: retrievedChunks.length,
      promptTokens,
      outputTokens,
      docxStoragePath,
      generatedAt: notesDocument.generatedAt,
    });

  } catch (err) {
    console.error('[lecture-notes/generate]', err);

    // Mark job as errored
    if (jobId) {
      const db2 = await createClient();
      await db2.from('lecture_note_jobs').update({
        status: 'error',
        error_message: err instanceof Error ? err.message : String(err),
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed.' },
      { status: 500 }
    );
  }
}
