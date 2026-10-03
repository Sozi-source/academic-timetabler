// ============================================================
// Lecture Notes — Generate API Route
// POST /api/lecture-notes/generate
//
// Generation modes:
//   unified — deterministic full-source consolidation. Reads every
//             ready material in full; no vector retrieval and no AI.
//   ai      — topic/session synthesis using the existing Gemini RAG path.
// ============================================================

export const runtime = 'nodejs';
export const maxDuration = 120;

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { embedText } from '@/features/lecture-notes/embeddings/gemini-embeddings';
import { retrieveSimilarChunks, getCourseOutlineContext, getLectureMaterialsForUnit } from '@/features/lecture-notes/queries';
import { buildGroundedPrompt } from '@/features/lecture-notes/generation/prompt-builder';
import { generateLectureNotes } from '@/features/lecture-notes/generation/gemini-generator';
import { buildLectureNotesDocx } from '@/features/lecture-notes/export/docx-builder';
import { buildLectureNotesPdf } from '@/features/lecture-notes/export/pdf-builder';
import { buildUnifiedLectureNotesDocument } from '@/features/lecture-notes/generation/unified-consolidator';
import type { GenerationGranularity } from '@/features/lecture-notes/types';

type GenerationMode = 'unified' | 'ai';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const db = await createClient();
  let jobId: string | null = null;

  try {
    const profile = await requireTrainerAccess();
    const body = await req.json() as {
      unitId: string;
      teachingAllocationId?: string | null;
      granularity?: GenerationGranularity;
      generationMode?: GenerationMode;
      sessionWeek?: number | null;
      topic: string;
    };

    const generationMode = body.generationMode ?? 'unified';
    const granularity: GenerationGranularity = generationMode === 'unified' ? 'unit' : (body.granularity ?? 'session');
    const { unitId, teachingAllocationId, sessionWeek, topic } = body;

    if (!unitId || !topic) {
      return NextResponse.json({ error: 'unitId and topic are required.' }, { status: 400 });
    }
    if (generationMode !== 'unified' && generationMode !== 'ai') {
      return NextResponse.json({ error: 'Invalid generation mode.' }, { status: 400 });
    }

    const engineUrl = process.env.LECTURE_NOTES_ENGINE_URL?.replace(/\/$/, '');
    const engineToken = process.env.LECTURE_NOTES_ENGINE_TOKEN;
    const hasPythonEngine = Boolean(engineUrl && engineToken);

    const { data: job, error: jobError } = await db
      .from('lecture_note_jobs')
      .insert({
        trainer_id: profile.id,
        teaching_allocation_id: teachingAllocationId ?? null,
        unit_id: unitId,
        department_id: profile.activeDepartmentId,
        granularity,
        session_week: granularity === 'unit' ? null : (sessionWeek ?? null),
        topic,
        status: (generationMode === 'unified' && hasPythonEngine) ? 'pending' : 'processing',
        generation_engine: (generationMode === 'unified' && hasPythonEngine) ? 'python' : 'ai',
      })
      .select('id')
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: `Failed to create job: ${jobError?.message}` }, { status: 500 });
    }
    jobId = job.id;

    const { data: unit } = await db.from('units').select('code, name').eq('id', unitId).single();
    const unitCode = (unit as { code: string; name: string } | null)?.code ?? unitId;
    const unitName = (unit as { code: string; name: string } | null)?.name ?? 'Unknown Unit';

    const materials = await getLectureMaterialsForUnit(unitId);
    const readyMaterials = materials.filter((m) => m.ingestedAt && m.contentText?.trim());

    if (generationMode === 'unified') {
      if (readyMaterials.length === 0) {
        throw new Error('No ready source materials are available. Upload and wait for all source files to finish processing before generating unified notes.');
      }

      // If a dedicated Python engine is configured and reachable, delegate the job
      if (hasPythonEngine && engineUrl && engineToken) {
        try {
          const engineResponse = await fetch(`${engineUrl}/v1/jobs/unified/enqueue`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Notes-Engine-Token': engineToken,
            },
            body: JSON.stringify({ job_id: jobId }),
            cache: 'no-store',
          });

          if (engineResponse.ok) {
            return NextResponse.json({
              jobId,
              unitCode,
              unitName,
              topic,
              granularity: 'unit',
              generationMode: 'unified',
              status: 'pending',
              sessionWeek: null,
              sections: [],
              sourceMaterials: readyMaterials.map((m) => m.title),
              materialCount: readyMaterials.length,
              sourceWordCount: 0,
              retainedWordCount: 0,
              duplicateParagraphCount: 0,
              chunkCount: readyMaterials.reduce((sum, material) => sum + material.chunkCount, 0),
              promptTokens: 0,
              outputTokens: 0,
              docxStoragePath: null,
              pdfStoragePath: null,
              generatedAt: new Date().toISOString(),
            }, { status: 202 });
          }
          console.warn('[lecture-notes/generate] Python engine enqueue failed, falling back to native in-process consolidator');
        } catch (engineErr) {
          console.warn('[lecture-notes/generate] Python engine unreachable, falling back to native in-process consolidator:', engineErr);
        }
      }

      // ── Native in-process TypeScript consolidator ────────────────
      // Seamless zero-deployment fallback: consolidates all ready materials,
      // builds DOCX & PDF, uploads to Supabase storage, and completes the job.
      const { document: notesDocument, stats } = buildUnifiedLectureNotesDocument({
        unitCode,
        unitName,
        topic,
        materials: readyMaterials,
      });

      const [docxBuffer, pdfBuffer] = await Promise.all([
        buildLectureNotesDocx(notesDocument),
        buildLectureNotesPdf(notesDocument),
      ]);

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

      const resultJson = {
        sections: notesDocument.sections,
        sourceMaterials: notesDocument.sourceMaterials,
        materialCount: stats.materialCount,
        sourceWordCount: stats.sourceWordCount,
        retainedWordCount: stats.retainedWordCount,
        duplicateParagraphCount: stats.duplicateParagraphCount,
        generationMode: 'unified',
      };

      await db.from('lecture_note_jobs').update({
        status: 'done',
        prompt_token_count: 0,
        output_token_count: 0,
        docx_storage_bucket: docxStoragePath ? 'lecture-notes' : null,
        docx_storage_path: docxStoragePath,
        pdf_storage_bucket: pdfStoragePath ? 'lecture-notes' : null,
        pdf_storage_path: pdfStoragePath,
        result_json: resultJson,
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);

      return NextResponse.json({
        jobId,
        unitCode,
        unitName,
        topic,
        granularity: 'unit',
        generationMode: 'unified',
        status: 'done',
        sessionWeek: null,
        sections: notesDocument.sections,
        sourceMaterials: notesDocument.sourceMaterials,
        materialCount: stats.materialCount,
        sourceWordCount: stats.sourceWordCount,
        retainedWordCount: stats.retainedWordCount,
        duplicateParagraphCount: stats.duplicateParagraphCount,
        chunkCount: readyMaterials.reduce((sum, material) => sum + material.chunkCount, 0),
        promptTokens: 0,
        outputTokens: 0,
        docxStoragePath,
        pdfStoragePath,
        generatedAt: notesDocument.generatedAt,
      }, { status: 200 });
    }

    // ── Existing AI-assisted topic/session path ─────────────────
    const outline = await getCourseOutlineContext(unitId);
    const learningOutcomes = outline?.learningOutcomes ?? [];
    const weeklyPlanContext = outline?.weeklyPlanText ?? '';
    let retrievedChunks: Awaited<ReturnType<typeof retrieveSimilarChunks>> = [];

    if (readyMaterials.length > 0) {
      try {
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
        console.warn('[lecture-notes/generate] Vector retrieval failed:', vectorErr);
      }
    }

    const usedMaterialIds = new Set(retrievedChunks.map((c) => c.materialId));
    const sourceMaterialTitles = readyMaterials
      .filter((m) => usedMaterialIds.size === 0 ? true : usedMaterialIds.has(m.id))
      .map((m) => m.title);

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

    const { document: notesDocument, promptTokens, outputTokens } = await generateLectureNotes({
      prompt,
      unitCode,
      unitName,
      topic,
      granularity,
      sessionWeek,
      sourceMaterialTitles,
    });

    const [docxBuffer, pdfBuffer] = await Promise.all([
      buildLectureNotesDocx(notesDocument),
      buildLectureNotesPdf(notesDocument),
    ]);

    const timestamp = Date.now();
    const docxPath = `generated/${profile.id}/${unitId}/${jobId}/${timestamp}.docx`;
    const pdfPath = `generated/${profile.id}/${unitId}/${jobId}/${timestamp}.pdf`;
    const [docxUploadResult, pdfUploadResult] = await Promise.all([
      db.storage.from('lecture-notes').upload(docxPath, docxBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: true,
      }),
      db.storage.from('lecture-notes').upload(pdfPath, pdfBuffer, {
        contentType: 'application/pdf', upsert: true,
      }),
    ]);

    const docxStoragePath = docxUploadResult.error ? null : docxPath;
    const pdfStoragePath = pdfUploadResult.error ? null : pdfPath;

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

    return NextResponse.json({
      jobId, unitCode, unitName, topic, granularity, generationMode: 'ai', sessionWeek: sessionWeek ?? null,
      sections: notesDocument.sections, sourceMaterials: sourceMaterialTitles, chunkCount: retrievedChunks.length,
      promptTokens, outputTokens, docxStoragePath, pdfStoragePath, generatedAt: notesDocument.generatedAt,
    });
  } catch (err) {
    console.error('[lecture-notes/generate]', err);
    if (jobId) {
      const db2 = await createClient();
      await db2.from('lecture_note_jobs').update({
        status: 'error',
        error_message: err instanceof Error ? err.message : String(err),
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Generation failed.' }, { status: 500 });
  }
}
