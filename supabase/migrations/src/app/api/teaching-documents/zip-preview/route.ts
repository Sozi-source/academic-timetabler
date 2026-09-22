import { NextResponse } from 'next/server';
import { requireHodAccess } from '@/features/auth/authorization';
import { ingestCurriculumZipArchive } from '@/features/teaching-documents/zip-ingestion';

export async function POST(request: Request) {
  try {
    await requireHodAccess();

    const arrayBuffer = await request.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return NextResponse.json(
        { ok: false, error: 'Empty or invalid file uploaded. Please select a valid .zip archive.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(arrayBuffer);
    const result = await ingestCurriculumZipArchive(buffer);

    if (result.extractedUnits.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No valid course outlines or schemes of work could be extracted from the uploaded archive. Ensure files inside are .docx, .xlsx, or .txt.',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ok: true,
      totalFilesProcessed: result.totalFilesProcessed,
      extractedUnits: result.extractedUnits,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ZIP processing error';
    return NextResponse.json(
      { ok: false, error: `Failed to process ZIP archive: ${message}` },
      { status: 500 }
    );
  }
}
