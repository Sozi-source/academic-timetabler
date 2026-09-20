import { NextResponse } from 'next/server';
import { requireHodAccess } from '@/features/auth/authorization';
import { parseBulkCourseOutlinesAction } from '@/features/teaching-documents/bulk-curriculum-actions';

export async function POST(request: Request) {
  try {
    await requireHodAccess();

    const formData = await request.formData();
    const result = await parseBulkCourseOutlinesAction(formData);

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
