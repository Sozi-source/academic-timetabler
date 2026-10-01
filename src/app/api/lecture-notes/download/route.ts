// ============================================================
// Lecture Notes — Download API Route
// GET /api/lecture-notes/download?jobId=...&format=docx
// ============================================================
// Generates a signed download URL from Supabase Storage
// for a completed lecture note job.

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireTrainerAccess } from '@/features/auth/authorization';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireTrainerAccess();
    const db = await createClient();

    const jobId = req.nextUrl.searchParams.get('jobId');
    const format = (req.nextUrl.searchParams.get('format') ?? 'docx').toLowerCase();

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required.' }, { status: 400 });
    }

    const { data: job, error } = await db
      .from('lecture_note_jobs')
      .select('id, status, docx_storage_bucket, docx_storage_path, pdf_storage_bucket, pdf_storage_path, topic, unit_id')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }

    if (job.status !== 'done') {
      return NextResponse.json({ error: `Job is not complete (status: ${job.status})` }, { status: 400 });
    }

    const isPdf = format === 'pdf';
    const bucket = (isPdf ? job.pdf_storage_bucket : job.docx_storage_bucket) as string | null;
    const path = (isPdf ? job.pdf_storage_path : job.docx_storage_path) as string | null;

    if (!bucket || !path) {
      return NextResponse.json(
        { error: `${format.toUpperCase()} file not found for this job. The file may have been cleaned up.` },
        { status: 404 }
      );
    }

    // Generate a signed URL valid for 5 minutes
    const { data: signedUrl, error: signError } = await db.storage
      .from(bucket)
      .createSignedUrl(path, 300);

    if (signError || !signedUrl) {
      return NextResponse.json({ error: 'Failed to generate download URL.' }, { status: 500 });
    }

    const topic = (job.topic as string | null) ?? 'lecture-notes';
    const filename = `${topic.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.${format}`;

    return NextResponse.json({
      downloadUrl: signedUrl.signedUrl,
      filename,
      expiresIn: 300,
    });

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Download failed.' },
      { status: 500 }
    );
  }
}
