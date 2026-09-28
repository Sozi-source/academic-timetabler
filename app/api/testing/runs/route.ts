import { NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

interface StartPayload {
  notes?: unknown;
}

export async function POST(request: Request) {
  await requireHodAccess();

  const payload = (await request.json().catch(() => ({}))) as StartPayload;
  const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';

  if (notes.length > 2000) {
    return NextResponse.json(
      { message: 'Run notes must be 2000 characters or fewer.' },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('start_release_test_run', {
    target_notes: notes || null,
  });

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: error.code === '42501' ? 403 : 409 },
    );
  }

  return NextResponse.json({ success: true, runId: data });
}
