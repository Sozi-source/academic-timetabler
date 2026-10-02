// ============================================================
// Lecture Notes — Direct Storage Upload
// POST /api/lecture-notes/upload
// Creates the material record and a Supabase signed upload target.
// The browser sends the file directly to Storage, bypassing Vercel.
// ============================================================

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireTrainerAccess } from '@/features/auth/authorization';

const BUCKET = 'lecture-notes';
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const STORAGE_FILE_SIZE_LIMIT = '50MB';

const MIME_BY_TYPE = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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

    const {
      unitId,
      teachingAllocationId = null,
      title,
      sourceType,
      originalFilename,
      fileSize,
      mimeType,
    } = body;

    if (!unitId || !title || !sourceType || !originalFilename || !fileSize) {
      return NextResponse.json(
        { error: 'unitId, title, sourceType, originalFilename and fileSize are required.' },
        { status: 400 },
      );
    }

    if (!(sourceType in MIME_BY_TYPE)) {
      return NextResponse.json({ error: 'Only PDF and DOCX files are supported.' }, { status: 400 });
    }

    if (fileSize > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: 'File is too large. Please keep lecture materials below 25 MB.' },
        { status: 413 },
      );
    }

    const expectedMime = MIME_BY_TYPE[sourceType];
    if (mimeType && mimeType !== expectedMime) {
      return NextResponse.json({ error: 'The selected file type does not match its extension.' }, { status: 400 });
    }

    const db = await createClient();
    const adminDb = createAdminClient();

    // Provision the bucket when it is missing. This keeps the direct-upload
    // path self-healing in environments where migrations have not yet created
    // the Storage bucket. The browser still uploads the bytes directly to
    // Supabase Storage; no file body passes through this route.
    const { data: bucket, error: bucketError } = await adminDb.storage.getBucket(BUCKET);
    if (!bucket) {
      const { error: createBucketError } = await adminDb.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: STORAGE_FILE_SIZE_LIMIT,
        allowedMimeTypes: Object.values(MIME_BY_TYPE),
      });

      if (createBucketError) {
        // A concurrent request may have created the bucket between getBucket
        // and createBucket. Re-read before treating the error as fatal.
        const { data: bucketAfterCreate } = await adminDb.storage.getBucket(BUCKET);
        if (!bucketAfterCreate) {
          return NextResponse.json(
            { error: `Lecture-notes storage is not configured: ${createBucketError.message}${bucketError ? ` (${bucketError.message})` : ''}` },
            { status: 503 },
          );
        }
      }
    }

    const ext = sourceType === 'pdf' ? 'pdf' : 'docx';
    const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120);
    const storagePath = `materials/${profile.id}/${unitId}/${crypto.randomUUID()}-${safeName || `material.${ext}`}`;

    const { data: signedUpload, error: signedUploadError } = await adminDb.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signedUploadError || !signedUpload) {
      return NextResponse.json(
        { error: `Could not prepare file upload: ${signedUploadError?.message ?? 'Unknown storage error'}` },
        { status: 500 },
      );
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
      .select('id, title, source_type, source_url, original_filename, chunk_count, ingested_at, created_at')
      .single();

    if (materialError || !material) {
      return NextResponse.json(
        { error: `Failed to create material: ${materialError?.message ?? 'Unknown database error'}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      materialId: material.id,
      path: signedUpload.path,
      token: signedUpload.token,
      material,
      maxFileBytes: MAX_FILE_BYTES,
    });
  } catch (err) {
    console.error('[lecture-notes/upload]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not prepare upload.' },
      { status: 500 },
    );
  }
}
