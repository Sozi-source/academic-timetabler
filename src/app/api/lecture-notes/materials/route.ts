// ============================================================
// Lecture Notes — Materials API
// ============================================================

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireTrainerAccess } from '@/features/auth/authorization';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireTrainerAccess();
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
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const profile = await requireTrainerAccess();
    const db = await createClient();
    const adminDb = createAdminClient();
    const materialId = req.nextUrl.searchParams.get('materialId');

    if (!materialId) {
      return NextResponse.json({ error: 'materialId is required.' }, { status: 400 });
    }

    // Fetch through the authenticated client first so RLS enforces ownership.
    const { data: material, error: materialLookupError } = await db
      .from('lecture_materials')
      .select('id, trainer_id, storage_bucket, storage_path')
      .eq('id', materialId)
      .maybeSingle();

    if (materialLookupError) {
      return NextResponse.json({ error: materialLookupError.message }, { status: 500 });
    }

    if (!material) {
      return NextResponse.json({ error: 'Material not found.' }, { status: 404 });
    }

    if (material.trainer_id !== profile.id) {
      return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
    }

    if (material.storage_path) {
      await adminDb.storage
        .from(material.storage_bucket || 'lecture-notes')
        .remove([material.storage_path]);
    }

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
      { status: 500 },
    );
  }
}
