import { NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

interface CasePayload {
  result?: unknown;
  note?: unknown;
}

const allowedResults = new Set(['pending', 'pass', 'fail', 'blocked']);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string; caseKey: string }> },
) {
  await requireHodAccess();

  const { runId, caseKey } = await params;
  const payload = (await request.json().catch(() => null)) as CasePayload | null;

  if (!payload || typeof payload.result !== 'string' || !allowedResults.has(payload.result)) {
    return NextResponse.json(
      { message: 'Choose Pending, Pass, Fail or Blocked.' },
      { status: 400 },
    );
  }

  const note = typeof payload.note === 'string' ? payload.note.trim() : '';

  if (note.length > 2000) {
    return NextResponse.json(
      { message: 'Test evidence notes must be 2000 characters or fewer.' },
      { status: 400 },
    );
  }

  if ((payload.result === 'fail' || payload.result === 'blocked') && !note) {
    return NextResponse.json(
      { message: 'A note is required when a test fails or is blocked.' },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('update_release_test_case', {
    target_run_id: runId,
    target_case_key: decodeURIComponent(caseKey),
    target_result: payload.result,
    target_note: note || null,
  });

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: error.code === '42501' ? 403 : 409 },
    );
  }

  return NextResponse.json({ success: true });
}
