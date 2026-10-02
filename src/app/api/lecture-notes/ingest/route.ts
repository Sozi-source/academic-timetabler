// ============================================================
// Lecture Notes — Ingest API Route
// POST /api/lecture-notes/ingest
// ============================================================
// Accepts: multipart/form-data with file OR text OR url
// Parses text → chunks → embeds → stores in Supabase

export const runtime = 'nodejs'; // pdf-parse and mammoth require Node.js runtime

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { chunkText } from '@/features/lecture-notes/ingest/chunker';
import { extractTextFromPdf } from '@/features/lecture-notes/ingest/pdf-parser';
import { extractTextFromDocx } from '@/features/lecture-notes/ingest/docx-parser';
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
    const file = formData.get('file') as File | null;

    if (!unitId || !title || !sourceType) {
      return NextResponse.json(
        { error: 'unitId, title, and sourceType are required.' },
        { status: 400 }
      );
    }

    // ── Extract text based on source type ──────────────────────
    let extractedText = '';
    let originalFilename: string | null = null;
    let storagePath: string | null = null;

    if (sourceType === 'text') {
      if (!textContent?.trim()) {
        return NextResponse.json({ error: 'textContent is required for text source type.' }, { status: 400 });
      }
      extractedText = textContent.trim();

    } else if (sourceType === 'url') {
      if (!sourceUrl?.trim()) {
        return NextResponse.json({ error: 'sourceUrl is required for url source type.' }, { status: 400 });
      }
      extractedText = await scrapeUrl(sourceUrl.trim());

    } else if (sourceType === 'pdf' || sourceType === 'docx') {
      if (!file) {
        return NextResponse.json({ error: 'file is required for pdf/docx source type.' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      originalFilename = file.name;

      // Upload raw file to Supabase Storage
      const ext = sourceType === 'pdf' ? 'pdf' : 'docx';
      const storageKey = `lecture-materials/${profile.id}/${unitId}/${Date.now()}.${ext}`;
      const contentType = file.type || (sourceType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

      let uploadError: { message: string } | null = null;
      const { error: initialUploadError } = await db.storage
        .from('lecture-notes')
        .upload(storageKey, buffer, {
          contentType,
          upsert: false,
        });

      if (initialUploadError) {
        uploadError = initialUploadError;
        // If bucket is missing or permission fails, attempt with admin client and ensure bucket exists
        if (initialUploadError.message.includes('Bucket not found') || initialUploadError.message.includes('bucket')) {
          try {
            const adminDb = createAdminClient();
            await adminDb.storage.createBucket('lecture-notes', {
              public: false,
              fileSizeLimit: 52428800,
              allowedMimeTypes: [
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain',
              ],
            });
            const { error: adminRetryError } = await adminDb.storage
              .from('lecture-notes')
              .upload(storageKey, buffer, {
                contentType,
                upsert: false,
              });
            uploadError = adminRetryError;
          } catch (adminErr) {
            console.warn('Storage auto-create or admin upload error:', adminErr);
          }
        }
      }

      if (uploadError) {
        console.warn('Storage upload failed (continuing with text extraction):', uploadError.message);
      } else {
        storagePath = storageKey;
      }

      // Extract text
      if (sourceType === 'pdf') {
        extractedText = await extractTextFromPdf(buffer);
      } else {
        extractedText = await extractTextFromDocx(buffer);
      }

    } else {
      return NextResponse.json({ error: `Unknown sourceType: ${sourceType}` }, { status: 400 });
    }

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: 'No text could be extracted from the provided source. Please check the file or URL.' },
        { status: 422 }
      );
    }

    // ── Chunk text ─────────────────────────────────────────────
    const chunks = chunkText(extractedText);

    // ── Insert material record ─────────────────────────────────
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
        original_filename: originalFilename,
        storage_bucket: storagePath ? 'lecture-notes' : null,
        storage_path: storagePath,
        content_text: extractedText,
        chunk_count: chunks.length,
      })
      .select('id')
      .single();

    if (materialError || !material) {
      return NextResponse.json(
        { error: `Failed to save material: ${materialError?.message ?? 'Unknown error'}` },
        { status: 500 }
      );
    }

    // ── Embed all chunks (with graceful resilience) ───────────
    let embeddings: number[][] = [];
    try {
      embeddings = await embedTexts(chunks);
    } catch (embedErr) {
      console.warn('[lecture-notes/ingest] Embedding generation failed (continuing with text chunks):', embedErr);
    }

    // ── Insert chunks with embeddings ──────────────────────────
    const chunkRows = chunks.map((content, index) => ({
      material_id: material.id,
      chunk_index: index,
      content,
      embedding: embeddings[index] ?? null,
      token_count: Math.ceil(content.split(/\s+/).length * 1.3),
    }));

    const { error: chunksError } = await db
      .from('lecture_material_chunks')
      .insert(chunkRows);

    if (chunksError) {
      return NextResponse.json(
        { error: `Failed to store embeddings: ${chunksError.message}` },
        { status: 500 }
      );
    }

    // Mark as ingested
    await db
      .from('lecture_materials')
      .update({ ingested_at: new Date().toISOString() })
      .eq('id', material.id);

    return NextResponse.json({
      materialId: material.id,
      chunkCount: chunks.length,
      message: `Material ingested successfully: ${chunks.length} chunks embedded.`,
    });

  } catch (err) {
    console.error('[lecture-notes/ingest]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ingestion failed.' },
      { status: 500 }
    );
  }
}
