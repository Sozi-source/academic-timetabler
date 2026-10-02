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
import { requireTrainerAccess } from '@/features/auth/authorization';
import { embedText } from '@/features/lecture-notes/embeddings/gemini-embeddings';
import { retrieveSimilarChunks, getCourseOutlineContext, getLectureMaterialsForUnit } from '@/features/lecture-notes/queries';
import { buildGroundedPrompt } from '@/features/lecture-notes/generation/prompt-builder';
import { generateLectureNotes } from '@/features/lecture-notes/generation/gemini-generator';
import { buildLectureNotesDocx } from '@/features/lecture-notes/export/docx-builder';
import { buildLectureNotesPdf } from '@/features/lecture-notes/export/pdf-builder';
import type { GenerationGranularity } from '@/features/lecture-notes/types';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const db = await createClient();
  let jobId: string | null = null;

  try {
    const profile = await requireTrainerAccess();
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

    // ── Material titles & RAG retrieval ───────────────────────
    const materials = await getLectureMaterialsForUnit(unitId);
    let retrievedChunks: Awaited<ReturnType<typeof retrieveSimilarChunks>> = [];

    if (materials.length > 0) {
      try {
        // Expand query with outline outcomes for higher semantic precision
        const expandedQuery = `${topic} ${learningOutcomes.slice(0, 3).join(' ')}`.trim();
        const queryEmbedding = await embedText(expandedQuery);
        retrievedChunks = await retrieveSimilarChunks({
          queryEmbedding,
          unitId,
          trainerId: profile.id,
          matchCount: 10,
          similarityThreshold: 0.35,
        });
      } catch (vectorErr) {
        console.warn('[lecture-notes/generate] Vector retrieval failed, proceeding with outline grounding:', vectorErr);
      }

      // If vector search returned 0 matches or had an issue, fallback directly to stored material chunks
      if (retrievedChunks.length === 0) {
        const materialIds = materials.map((m) => m.id);
        const { data: directChunks } = await db
          .from('lecture_material_chunks')
          .select('id, material_id, content')
          .in('material_id', materialIds)
          .order('chunk_index', { ascending: true })
          .limit(10);

        if (directChunks && directChunks.length > 0) {
          retrievedChunks = directChunks.map((c) => ({
            id: c.id,
            materialId: c.material_id,
            content: c.content,
            similarity: 1.0,
          }));
        }
      }
    }

    const usedMaterialIds = new Set(retrievedChunks.map((c) => c.materialId));
    const sourceMaterialTitles = materials
      .filter((m) => usedMaterialIds.size === 0 ? true : usedMaterialIds.has(m.id))
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

    // ── Build DOCX & PDF in parallel ──────────────────────────
    const [docxBuffer, pdfBuffer] = await Promise.all([
      buildLectureNotesDocx(notesDocument),
      buildLectureNotesPdf(notesDocument),
    ]);

    // ── Upload DOCX & PDF to Supabase Storage ──────────────────
    const timestamp = Date.now();
    const docxPath = `generated/${profile.id}/${unitId}/${jobId}/${timestamp}.docx`;
    const pdfPath = `generated/${profile.id}/${unitId}/${jobId}/${timestamp}.pdf`;

    const [docxUploadResult, pdfUploadResult] = await Promise.all([
      db.storage
        .from('lecture-notes')
        .upload(docxPath, docxBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: true,
        }),
      db.storage
        .from('lecture-notes')
        .upload(pdfPath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        }),
    ]);

    const docxStoragePath = docxUploadResult.error ? null : docxPath;
    const pdfStoragePath = pdfUploadResult.error ? null : pdfPath;

    if (docxUploadResult.error) {
      console.warn('[lecture-notes/generate] DOCX upload failed:', docxUploadResult.error.message);
    }
    if (pdfUploadResult.error) {
      console.warn('[lecture-notes/generate] PDF upload failed:', pdfUploadResult.error.message);
    }

    // ── Mark job as done ───────────────────────────────────────
    await db.from('lecture_note_jobs').update({
      status: 'done',
      prompt_token_count: promptTokens,
      output_token_count: outputTokens,
      docx_storage_bucket: docxStoragePath ? 'lecture-notes' : null,
      docx_storage_path: docxStoragePath,
      pdf_storage_bucket: pdfStoragePath ? 'lecture-notes' : null,
      pdf_storage_path: pdfStoragePath,
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
      pdfStoragePath,
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
