// ============================================================
// Lecture Notes — Text / URL Ingest API
// POST /api/lecture-notes/ingest
//
// File uploads deliberately use /upload + /process so large PDFs
// and DOCX files never pass through the Vercel request body.
// ============================================================

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { chunkText } from '@/features/lecture-notes/ingest/chunker';
import { scrapeUrl } from '@/features/lecture-notes/ingest/url-scraper';
import { embedTexts } from '@/features/lecture-notes/embeddings/gemini-embeddings';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const profile = await requireTrainerAccess();
    const db = await createClient();
    const formData = await req.formData();

    const unitId = formData.get('unitId') as string | null;
    const teachingAllocationId = formData.get('teachingAllocationId') as string | null;
    const title = formData.get('title') as string | null;
    const sourceType = formData.get('sourceType') as string | null;
    const sourceUrl = formData.get('sourceUrl') as string | null;
    const textContent = formData.get('textContent') as string | null;

    if (!unitId || !title || !sourceType) {
      return NextResponse.json({ error: 'unitId, title, and sourceType are required.' }, { status: 400 });
    }

    if (sourceType !== 'text' && sourceType !== 'url') {
      return NextResponse.json(
        { error: 'PDF and DOCX files use the direct upload flow. Please select the file again.' },
        { status: 400 },
      );
    }

    let extractedText = '';

    if (sourceType === 'text') {
      if (!textContent?.trim()) {
        return NextResponse.json({ error: 'textContent is required for text source type.' }, { status: 400 });
      }
      extractedText = textContent.trim();
    } else {
      if (!sourceUrl?.trim()) {
        return NextResponse.json({ error: 'sourceUrl is required for url source type.' }, { status: 400 });
      }
      extractedText = (await scrapeUrl(sourceUrl.trim())).trim();
    }

    if (!extractedText) {
      return NextResponse.json(
        { error: 'No readable text was found in the source.' },
        { status: 422 },
      );
    }

    const chunks = chunkText(extractedText);
    if (chunks.length === 0) {
      return NextResponse.json({ error: 'No usable text chunks were created.' }, { status: 422 });
    }

    const { data: material, error: materialError } = await db
      .from('lecture_materials')
      .insert({
        trainer_id: profile.id,
        teaching_allocation_id: teachingAllocationId || null,
        unit_id: unitId,
        department_id: profile.activeDepartmentId,
        title: title.trim(),
        source_type: sourceType,
        source_url: sourceUrl || null,
        original_filename: null,
        storage_bucket: null,
        storage_path: null,
        content_text: extractedText,
        chunk_count: chunks.length,
      })
      .select('id, title, source_type, source_url, original_filename, chunk_count, ingested_at, created_at')
      .single();

    if (materialError || !material) {
      return NextResponse.json(
        { error: `Failed to save material: ${materialError?.message ?? 'Unknown error'}` },
        { status: 500 },
      );
    }

    try {
      const embeddings = await embedTexts(chunks);

      if (embeddings.length !== chunks.length) {
        throw new Error(`Embedding service returned ${embeddings.length} vectors for ${chunks.length} chunks.`);
      }

      const chunkRows = chunks.map((content, index) => ({
        material_id: material.id,
        chunk_index: index,
        content,
        embedding: embeddings[index],
        token_count: Math.ceil(content.split(/\s+/).length * 1.3),
      }));

      const { error: chunksError } = await db.from('lecture_material_chunks').insert(chunkRows);
      if (chunksError) throw new Error(chunksError.message);

      await db.from('lecture_materials')
        .update({ ingested_at: new Date().toISOString() })
        .eq('id', material.id);
    } catch (embeddingError) {
      await db.from('lecture_materials').delete().eq('id', material.id);
      throw embeddingError;
    }

    return NextResponse.json({
      materialId: material.id,
      chunkCount: chunks.length,
      material: {
        ...material,
        ingested_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[lecture-notes/ingest]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ingestion failed.' },
      { status: 500 },
    );
  }
}
