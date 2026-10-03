// ============================================================
// Lecture Notes — Direct Storage Upload
// POST /api/lecture-notes/upload
// ============================================================

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireTrainerAccess } from '@/features/auth/authorization';

const BUCKET = 'lecture-notes';
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_ZIP_BYTES = 50 * 1024 * 1024;

const MIME_BY_TYPE = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'],
  pptx: [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/octet-stream',
  ],
  zip: [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-zip',
    'application/octet-stream',
    'multipart/x-zip',
  ],
} as const;

type FileSourceType = keyof typeof MIME_BY_TYPE;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const profile = await requireTrainerAccess();
    const body = await req.json() as {
      unitId?: string;
      teachingAllocationId?: string | null;
      title?: string;
      sourceType?: FileSourceType;
      originalFilename?: string;
      fileSize?: number;
      mimeType?: string;
    };

    const { unitId, teachingAllocationId = null, title, sourceType, originalFilename, fileSize, mimeType } = body;

    if (!unitId || !title || !sourceType || !originalFilename || !fileSize) {
      return NextResponse.json({ error: 'unitId, title, sourceType, originalFilename and fileSize are required.' }, { status: 400 });
    }

    if (!(sourceType in MIME_BY_TYPE)) {
      return NextResponse.json({ error: 'Only PDF, DOCX, PPTX and ZIP source files are supported.' }, { status: 400 });
    }

    const maxBytes = sourceType === 'zip' ? MAX_ZIP_BYTES : MAX_FILE_BYTES;
    if (fileSize > maxBytes) {
      return NextResponse.json({
        error: `${sourceType.toUpperCase()} file is too large. Maximum size is ${Math.round(maxBytes / 1024 / 1024)} MB.`,
      }, { status: 413 });
    }

    const expectedMimes = MIME_BY_TYPE[sourceType] as readonly string[];
    if (mimeType && !expectedMimes.includes(mimeType)) {
      // Browsers occasionally report application/octet-stream for ZIP or PPTX files;
      // extension validation below remains authoritative for that case.
      if (!((sourceType === 'zip' || sourceType === 'pptx') && mimeType === 'application/octet-stream')) {
        return NextResponse.json({ error: 'The selected file type does not match its extension.' }, { status: 400 });
      }
    }

    const db = await createClient();
    const adminDb = createAdminClient();
    const { data: bucket } = await adminDb.storage.getBucket(BUCKET);
    if (!bucket) {
      return NextResponse.json({ error: 'Lecture-notes storage is not configured. Run the lecture-notes storage migration first.' }, { status: 503 });
    }

    // Auto-heal bucket allowed mime types if ZIP or PPTX types are missing
    if (bucket.allowed_mime_types && (!bucket.allowed_mime_types.includes('application/x-zip-compressed') || !bucket.allowed_mime_types.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation'))) {
      const updatedMimes = Array.from(new Set([
        ...bucket.allowed_mime_types,
        'application/zip',
        'application/x-zip-compressed',
        'application/x-zip',
        'application/octet-stream',
        'multipart/x-zip',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint',
      ]));
      await adminDb.storage.updateBucket(BUCKET, {
        public: false,
        fileSizeLimit: 52428800,
        allowedMimeTypes: updatedMimes,
      }).catch((e) => console.warn('[lecture-notes/upload] Failed to update bucket mime types:', e));
    }

    const ext = sourceType;
    const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120);
    const storagePath = `materials/${profile.id}/${unitId}/${crypto.randomUUID()}-${safeName || `material.${ext}`}`;

    const { data: signedUpload, error: signedUploadError } = await adminDb.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signedUploadError || !signedUpload) {
      return NextResponse.json({ error: `Could not prepare file upload: ${signedUploadError?.message ?? 'Unknown storage error'}` }, { status: 500 });
    }

    const { data: material, error: materialError } = await db
      .from('lecture_materials')
      .insert({
        trainer_id: profile.id,
        teaching_allocation_id: teachingAllocationId,
        unit_id: unitId,
        department_id: profile.activeDepartmentId,
        title: title.trim(),
        source_type: sourceType,
        source_url: null,
        original_filename: originalFilename,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        content_text: null,
        chunk_count: 0,
        ingested_at: null,
      })
      .select('id, title, source_type, source_url, original_filename, chunk_count, ingested_at, created_at, processing_error')
      .single();

    if (materialError || !material) {
      return NextResponse.json({ error: `Failed to create material: ${materialError?.message ?? 'Unknown database error'}` }, { status: 500 });
    }

    return NextResponse.json({
      materialId: material.id,
      path: signedUpload.path,
      token: signedUpload.token,
      material,
      maxFileBytes: maxBytes,
    });
  } catch (err) {
    console.error('[lecture-notes/upload]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not prepare upload.' }, { status: 500 });
  }
}
