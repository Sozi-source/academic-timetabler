// ============================================================
// Lecture Notes — Job Status API
// GET /api/lecture-notes/jobs/:jobId
// ============================================================

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireTrainerAccess } from '@/features/auth/authorization';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  try {
    const profile = await requireTrainerAccess();
    const { jobId } = await params;
    const db = await createClient();

    const { data: job, error } = await db
      .from('lecture_note_jobs')
      .select('id, trainer_id, unit_id, topic, granularity, status, error_message, docx_storage_bucket, docx_storage_path, pdf_storage_bucket, pdf_storage_path, result_json, created_at, completed_at')
      .eq('id', jobId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    if (job.trainer_id !== profile.id) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });

    const result = (job.result_json ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      topic: job.topic,
      granularity: job.granularity,
      error: job.error_message,
      docxStoragePath: job.docx_storage_path,
      pdfStoragePath: job.pdf_storage_path,
      completedAt: job.completed_at,
      sections: Array.isArray(result.sections) ? result.sections : [],
      sourceMaterials: Array.isArray(result.sourceMaterials) ? result.sourceMaterials : [],
      materialCount: result.materialCount ?? 0,
      sourceWordCount: result.sourceWordCount ?? 0,
      retainedWordCount: result.retainedWordCount ?? 0,
      duplicateParagraphCount: result.duplicateParagraphCount ?? 0,
      generationMode: result.generationMode ?? 'unified',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch job status.' },
      { status: 500 },
    );
  }
}
