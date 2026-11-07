import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const payloadSchema = z.object({
  periodId: z.string().uuid(),
  open: z.boolean(),
  component: z.enum(['cat', 'exam', 'all']).default('all'),
});

export async function POST(request: Request) {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) {
    return NextResponse.json({ message: 'Select an active department.' }, { status: 409 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Provide a valid academic period, component, and open status.' }, { status: 400 });
  }

  const { periodId, open, component } = parsed.data;
  const supabase = await createClient();

  // Try RPC function first (with p_component parameter)
  const { data: rpcData, error: rpcError } = await supabase.rpc('set_department_trainer_entry', {
    p_academic_period_id: periodId,
    p_should_open: open,
    p_component: component,
  });

  if (!rpcError && rpcData) {
    return NextResponse.json(rpcData);
  }

  // If 3-arg RPC fails, try 2-arg legacy RPC if component === 'all'
  if (component === 'all') {
    const { data: legacyRpcData, error: legacyRpcError } = await supabase.rpc('set_department_trainer_entry', {
      p_academic_period_id: periodId,
      p_should_open: open,
    });
    if (!legacyRpcError && legacyRpcData) {
      return NextResponse.json(legacyRpcData);
    }
  }

  // Graceful fallback if migration has not been pushed to remote DB yet
  const admin = createAdminClient();
  try {
    if (open) {
      // Find units with active student registrations in this department and period
      const { data: registrations } = await admin
        .from('student_unit_registrations')
        .select('unit_id,unit:units!inner(id,department_id,programme:programmes!inner(department_id))')
        .eq('academic_period_id', periodId)
        .eq('registration_status', 'registered');

      const unitIdsToProvision = new Set<string>();
      for (const reg of registrations ?? []) {
        const unit = Array.isArray(reg.unit) ? reg.unit[0] : reg.unit;
        const programme = unit ? (Array.isArray(unit.programme) ? unit.programme[0] : unit.programme) : null;
        const deptId = unit?.department_id || programme?.department_id;
        if (deptId === profile.activeDepartmentId && reg.unit_id) {
          unitIdsToProvision.add(reg.unit_id);
        }
      }

      for (const unitId of unitIdsToProvision) {
        try {
          await admin.rpc('ensure_unit_markbook_ready', {
            p_academic_period_id: periodId,
            p_unit_id: unitId,
          });
        } catch {
          // ignore individual provision failures
        }
      }
    }

    // Build update object based on targeted component
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (component === 'cat') {
      updatePayload.trainer_cat_entry_open = open;
      updatePayload.trainer_entry_open = open;
    } else if (component === 'exam') {
      updatePayload.trainer_exam_entry_open = open;
      if (open) updatePayload.trainer_entry_open = true;
    } else {
      updatePayload.trainer_cat_entry_open = open;
      updatePayload.trainer_exam_entry_open = open;
      updatePayload.trainer_entry_open = open;
    }

    // Attempt update with new columns; if error code 42703 (column doesn't exist), fall back to trainer_entry_open
    let updateResult = await admin
      .from('assessment_events')
      .update(updatePayload)
      .eq('department_id', profile.activeDepartmentId)
      .eq('academic_period_id', periodId)
      .eq('title', 'Unit Markbook')
      .eq('assessment_type', 'exam')
      .neq('status', 'closed')
      .is('exam_marks_finalized_at', null)
      .select('id,unit_id');

    if (updateResult.error && updateResult.error.code === '42703') {
      // Fallback without new columns
      updateResult = await admin
        .from('assessment_events')
        .update({
          trainer_entry_open: open,
          updated_at: new Date().toISOString(),
        })
        .eq('department_id', profile.activeDepartmentId)
        .eq('academic_period_id', periodId)
        .eq('title', 'Unit Markbook')
        .eq('assessment_type', 'exam')
        .neq('status', 'closed')
        .is('exam_marks_finalized_at', null)
        .select('id,unit_id');
    }

    if (updateResult.error) {
      return NextResponse.json({ message: updateResult.error.message }, { status: 500 });
    }

    const updated = updateResult.data;

    if (!open && component === 'all' && updated) {
      for (const row of updated) {
        if (row.unit_id) {
          try {
            await admin.rpc('ensure_unit_markbook_ready', {
              p_academic_period_id: periodId,
              p_unit_id: row.unit_id,
            });
          } catch {
            // ignore
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      open,
      component,
      updatedCount: updated?.length ?? 0,
    });
  } catch (cause) {
    return NextResponse.json({
      message: cause instanceof Error ? cause.message : 'Could not update marks entry status.',
    }, { status: 500 });
  }
}
