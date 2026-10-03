// ============================================================
// Lecture Notes — Background Material Processing
// POST /api/lecture-notes/process
//
// Files are already in Supabase Storage. The route returns 202 and
// performs extraction/chunking/embedding after the response.
// ZIP archives are treated as source containers: every supported
// PDF/DOCX/TXT/MD member is read in full and consolidated into the
// parent material's content_text before indexing.
// ============================================================

export const runtime = 'nodejs';
export const maxDuration = 300;

import { after, type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { chunkText } from '@/features/lecture-notes/ingest/chunker';
import { extractTextFromPdf } from '@/features/lecture-notes/ingest/pdf-parser';
import { extractTextFromDocx } from '@/features/lecture-notes/ingest/docx-parser';
import { extractTextFromPptx } from '@/features/lecture-notes/ingest/pptx-parser';
import { unpackLectureSourceZip } from '@/features/lecture-notes/ingest/zip-parser';
import { embedTexts } from '@/features/lecture-notes/embeddings/gemini-embeddings';

const BUCKET = 'lecture-notes';
const EMBEDDING_BATCH_SIZE = 50;
const CHUNK_INSERT_BATCH_SIZE = 50;

function cleanExtractedText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractZipContents(buffer: Buffer): Promise<string> {
  const entries = await unpackLectureSourceZip(buffer);
  const parts: string[] = [];

  for (const entry of entries) {
    const lower = entry.filename.toLowerCase();
    let text = '';

    try {
      if (lower.endsWith('.pdf')) {
        text = await extractTextFromPdf(entry.buffer);
      } else if (lower.endsWith('.docx')) {
        text = await extractTextFromDocx(entry.buffer);
      } else if (lower.endsWith('.pptx')) {
        text = await extractTextFromPptx(entry.buffer);
      } else if (lower.endsWith('.txt') || lower.endsWith('.md')) {
        text = entry.buffer.toString('utf8');
      }
    } catch (fileErr) {
      console.warn(`[lecture-notes/process] Failed to extract text from ${entry.filename}:`, fileErr);
    }

    text = cleanExtractedText(text);
    if (text) {
      parts.push(`SOURCE FILE: ${entry.filename}\n\n${text}`);
    }
  }

  if (parts.length === 0) {
    throw new Error('The ZIP contained supported files, but no readable text could be extracted from them (e.g. scanned image-only PDFs or empty files).');
  }

  return parts.join('\n\n==============================\n\n');
}

async function processMaterial(materialId: string, trainerId: string) {
  const db = createAdminClient();

  try {
    const { data: material, error: materialError } = await db
      .from('lecture_materials')
      .select('id, trainer_id, source_type, storage_bucket, storage_path')
      .eq('id', materialId)
      .maybeSingle();

    if (materialError || !material) throw new Error(materialError?.message ?? 'Material was not found.');
    if (material.trainer_id !== trainerId) throw new Error('You are not allowed to process this material.');
    if (!material.storage_path) throw new Error('Material has no uploaded storage file.');

    const { data: file, error: downloadError } = await db
      .storage
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
    } else if (material.source_type === 'pptx') {
      extractedText = await extractTextFromPptx(buffer);
    } else if (material.source_type === 'zip') {
      extractedText = await extractZipContents(buffer);
    } else {
      throw new Error(`Unsupported uploaded source type: ${material.source_type}`);
    }

    extractedText = cleanExtractedText(extractedText);
    if (!extractedText) throw new Error('No text could be extracted from the material.');

    const chunks = chunkText(extractedText);
    if (chunks.length === 0) throw new Error('No usable text chunks were created from the material.');

    // Idempotent retry: rebuild this material's chunks from scratch.
    await db.from('lecture_material_chunks').delete().eq('material_id', materialId);

    for (let start = 0; start < chunks.length; start += CHUNK_INSERT_BATCH_SIZE) {
      const batch = chunks.slice(start, start + CHUNK_INSERT_BATCH_SIZE);
      let embeddings: number[][] | null = null;

      try {
        const generated = await embedTexts(batch);
        if (generated.length === batch.length) {
          embeddings = generated;
        } else {
          console.warn('[lecture-notes/process] Embedding service returned an unexpected batch size; continuing without embeddings.');
        }
      } catch (embeddingError) {
        // Unified notes do not depend on Gemini/vector embeddings. A temporary
        // Gemini outage must not prevent source material from becoming Ready.
        console.warn('[lecture-notes/process] Embeddings unavailable; preserving source text without vectors:', embeddingError);
      }

      const rows = batch.map((content, index) => ({
        material_id: materialId,
        chunk_index: start + index,
        content,
        embedding: embeddings ? embeddings[index] : null,
        token_count: Math.ceil(content.split(/\s+/).length * 1.3),
      }));

      const { error: chunksError } = await db.from('lecture_material_chunks').insert(rows);
      if (chunksError) throw new Error(`Failed to store chunk batch: ${chunksError.message}`);

      await db.from('lecture_materials').update({
        chunk_count: Math.min(start + batch.length, chunks.length),
      }).eq('id', materialId);
    }

    const { error: completeError } = await db.from('lecture_materials').update({
      content_text: extractedText,
      chunk_count: chunks.length,
      ingested_at: new Date().toISOString(),
      processing_error: null,
    }).eq('id', materialId);

    if (completeError) throw new Error(`Failed to mark material ready: ${completeError.message}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[lecture-notes/process] Failed to process material', materialId, errorMessage);

    try {
      await db.from('lecture_materials').update({
        processing_error: errorMessage,
        ingested_at: null,
      }).eq('id', materialId);
    } catch (recordError) {
      console.error('[lecture-notes/process] failed to record error on material:', recordError);
    }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const profile = await requireTrainerAccess();
    const body = await req.json() as { materialId?: string };
    const materialId = body.materialId?.trim();

    if (!materialId) return NextResponse.json({ error: 'materialId is required.' }, { status: 400 });

    const db = createAdminClient();
    const { data: material, error } = await db
      .from('lecture_materials')
      .select('id, trainer_id, ingested_at')
      .eq('id', materialId)
      .maybeSingle();

    if (error || !material) return NextResponse.json({ error: 'Material was not found.' }, { status: 404 });
    if (material.trainer_id !== profile.id) return NextResponse.json({ error: 'You are not allowed to process this material.' }, { status: 403 });
    if (material.ingested_at) return NextResponse.json({ materialId, status: 'ready' });

    after(async () => {
      try {
        await processMaterial(materialId, profile.id);
      } catch (processErr) {
        console.error('[lecture-notes/process/after]', processErr);
      }
    });
    return NextResponse.json({ materialId, status: 'processing' }, { status: 202 });
  } catch (err) {
    console.error('[lecture-notes/process/start]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Could not start material processing.',
    }, { status: 500 });
  }
}
