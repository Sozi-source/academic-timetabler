import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

const bodySchema = z.object({ open: z.boolean() });

export async function PATCH(request: Request, { params }: RouteContext) {
  const profile = await requireHodAccess();
  const { assessmentId } = await params;
  if (!profile.activeDepartmentId) return NextResponse.json({ message: 'Select an active department.' }, { status: 409 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: 'Choose whether trainer entry should be open or locked.' }, { status: 400 });

  const supabase = await createClient();
  const { data: markbook, error: markbookError } = await supabase
    .from('assessment_events')
    .select('id,academic_period_id,unit_id,status,exam_marks_finalized_at')
    .eq('id', assessmentId)
    .eq('department_id', profile.activeDepartmentId)
    .eq('title', 'Unit Markbook')
    .maybeSingle();

  if (markbookError || !markbook) return NextResponse.json({ message: 'Unit markbook was not found.' }, { status: 404 });
  if (markbook.status === 'closed' || markbook.exam_marks_finalized_at) {
    return NextResponse.json({ message: 'Finalized markbooks cannot be opened or changed.' }, { status: 409 });
  }

  if (parsed.data.open) {
    const { error } = await supabase.rpc('ensure_unit_markbook_ready', {
      p_academic_period_id: markbook.academic_period_id,
      p_unit_id: markbook.unit_id,
    });
    if (error) return NextResponse.json({ message: 'Could not prepare the registered student roster.' }, { status: 409 });
  }

  const { error } = await supabase.rpc('set_unit_markbook_trainer_entry', {
    target_assessment_id: markbook.id,
    should_open: parsed.data.open,
  });
  if (error) return NextResponse.json({ message: error.message }, { status: error.code === '42501' ? 403 : 409 });

  return NextResponse.json({ success: true, open: parsed.data.open }, { headers: { 'Cache-Control': 'no-store' } });
}
