import { NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  await requireHodAccess();
  const { runId } = await params;
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_release_test_run', {
    target_run_id: runId,
  });

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: error.code === '42501' ? 403 : 409 },
    );
  }

  return NextResponse.json({ success: true });
}
