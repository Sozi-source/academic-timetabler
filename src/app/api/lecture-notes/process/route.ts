// ============================================================
// Lecture Notes — Background Material Processing
// POST /api/lecture-notes/process
//
// The file is already in Supabase Storage. This route returns
// immediately and lets Next/Vercel continue the extraction,
// chunking and embedding work after the response.
// ============================================================

export const runtime = 'nodejs';
export const maxDuration = 300;

import { after, type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { chunkText } from '@/features/lecture-notes/ingest/chunker';
import { extractTextFromPdf } from '@/features/lecture-notes/ingest/pdf-parser';
import { extractTextFromDocx } from '@/features/lecture-notes/ingest/docx-parser';
import { embedTexts } from '@/features/lecture-notes/embeddings/gemini-embeddings';

const BUCKET = 'lecture-notes';
const EMBEDDING_BATCH_SIZE = 50;

async function processMaterial(materialId: string, trainerId: string) {
  const db = createAdminClient();

  try {
    const { data: material, error: materialError } = await db
      .from('lecture_materials')
      .select('id, trainer_id, source_type, storage_bucket, storage_path')
      .eq('id', materialId)
      .maybeSingle();

    if (materialError || !material) {
      throw new Error(materialError?.message ?? 'Material was not found.');
    }

    if (material.trainer_id !== trainerId) {
      throw new Error('You are not allowed to process this material.');
    }

    if (!material.storage_path) {
      throw new Error('Material has no uploaded storage file.');
    }

    const { data: file, error: downloadError } = await db.storage
      .from(material.storage_bucket || BUCKET)
      .download(material.storage_path);

    if (downloadError || !file) {
      throw new Error(`Could not read uploaded material: ${downloadError?.message ?? 'Storage file not found.'}`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let extractedText = '';
    if (material.source_type === 'pdf') {
      extractedText = await extractTextFromPdf(buffer);
    } else if (material.source_type === 'docx') {
      extractedText = await extractTextFromDocx(buffer);
    } else {
      throw new Error(`Unsupported uploaded source type: ${material.source_type}`);
    }

    extractedText = extractedText.trim();
    if (!extractedText) {
      throw new Error('No text could be extracted. The file may be scanned or contain no readable text.');
    }

    const chunks = chunkText(extractedText);
    if (chunks.length === 0) {
      throw new Error('No usable text chunks were created from the material.');
    }

    // Idempotent retry: rebuild this material's chunks from scratch.
    await db.from('lecture_material_chunks').delete().eq('material_id', materialId);

    for (let start = 0; start < chunks.length; start += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(start, start + EMBEDDING_BATCH_SIZE);
      const embeddings = await embedTexts(batch);

      if (embeddings.length !== batch.length) {
        throw new Error(`Embedding service returned ${embeddings.length} vectors for ${batch.length} chunks.`);
      }

      const rows = batch.map((content, index) => ({
        material_id: materialId,
        chunk_index: start + index,
        content,
        embedding: embeddings[index],
        token_count: Math.ceil(content.split(/\s+/).length * 1.3),
      }));

      const { error: chunksError } = await db
        .from('lecture_material_chunks')
        .insert(rows);

      if (chunksError) {
        throw new Error(`Failed to store chunk batch: ${chunksError.message}`);
      }

      await db
        .from('lecture_materials')
        .update({
          chunk_count: Math.min(start + batch.length, chunks.length),
        })
        .eq('id', materialId);
    }

    const { error: completeError } = await db
      .from('lecture_materials')
      .update({
        content_text: extractedText,
        chunk_count: chunks.length,
        ingested_at: new Date().toISOString(),
      })
      .eq('id', materialId);

    if (completeError) {
      throw new Error(`Failed to mark material ready: ${completeError.message}`);
    }
  } catch (error) {
    console.error('[lecture-notes/process]', error);

    // A failed material is removed so the UI cannot present an
    // incomplete/partially embedded source as usable context.
    try {
      const { data: material } = await db
        .from('lecture_materials')
        .select('storage_bucket, storage_path')
        .eq('id', materialId)
        .maybeSingle();

      if (material?.storage_path) {
        await db.storage
          .from(material.storage_bucket || BUCKET)
          .remove([material.storage_path]);
      }

      await db.from('lecture_materials').delete().eq('id', materialId);
    } catch (cleanupError) {
      console.error('[lecture-notes/process] cleanup failed', cleanupError);
    }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const profile = await requireTrainerAccess();
    const body = await req.json() as { materialId?: string };
    const materialId = body.materialId?.trim();

    if (!materialId) {
      return NextResponse.json({ error: 'materialId is required.' }, { status: 400 });
    }

    const db = createAdminClient();
    const { data: material, error } = await db
      .from('lecture_materials')
      .select('id, trainer_id, ingested_at')
      .eq('id', materialId)
      .maybeSingle();

    if (error || !material) {
      return NextResponse.json({ error: 'Material was not found.' }, { status: 404 });
    }

    if (material.trainer_id !== profile.id) {
      return NextResponse.json({ error: 'You are not allowed to process this material.' }, { status: 403 });
    }

    if (material.ingested_at) {
      return NextResponse.json({ materialId, status: 'ready' });
    }

    after(() => processMaterial(materialId, profile.id));

    return NextResponse.json(
      { materialId, status: 'processing' },
      { status: 202 },
    );
  } catch (err) {
    console.error('[lecture-notes/process/start]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not start material processing.' },
      { status: 500 },
    );
  }
}
