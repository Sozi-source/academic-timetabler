// ============================================================
// Lecture Notes — Materials API Route
// GET  /api/lecture-notes/materials?unitId=...
// DELETE /api/lecture-notes/materials?materialId=...
// ============================================================

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireHodAccess } from '@/features/auth/authorization';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireHodAccess();
    const db = await createClient();
    const unitId = req.nextUrl.searchParams.get('unitId');

    if (!unitId) {
      return NextResponse.json({ error: 'unitId is required.' }, { status: 400 });
    }

    const { data, error } = await db
      .from('lecture_materials')
      .select('id, title, source_type, source_url, original_filename, chunk_count, ingested_at, created_at')
      .eq('unit_id', unitId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ materials: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch materials.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    await requireHodAccess();
    const db = await createClient();
    const materialId = req.nextUrl.searchParams.get('materialId');

    if (!materialId) {
      return NextResponse.json({ error: 'materialId is required.' }, { status: 400 });
    }

    // RLS ensures trainers can only delete their own materials
    const { error } = await db
      .from('lecture_materials')
      .delete()
      .eq('id', materialId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete material.' },
      { status: 500 }
    );
  }
}
