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
  const { data, error } = await supabase.rpc('complete_release_test_run', {
    target_run_id: runId,
  });

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: error.code === '42501' ? 403 : 409 },
    );
  }

  const result = data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};

  return NextResponse.json({
    success: true,
    outcome: typeof result.outcome === 'string' ? result.outcome : 'failed',
    result: data,
  });
}
