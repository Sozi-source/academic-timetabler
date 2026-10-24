import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const payloadSchema = z.object({
  periodId: z.string().uuid(),
  open: z.boolean(),
});

export async function POST(request: Request) {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) {
    return NextResponse.json({ message: 'Select an active department.' }, { status: 409 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Provide a valid academic period and open status.' }, { status: 400 });
  }

  const { periodId, open } = parsed.data;
  const supabase = await createClient();

  // Try RPC function first
  const { data: rpcData, error: rpcError } = await supabase.rpc('set_department_trainer_entry', {
    p_academic_period_id: periodId,
    p_should_open: open,
  });

  if (!rpcError && rpcData) {
    return NextResponse.json(rpcData);
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

    // Update all active markbooks for this department and academic period
    const { data: updated, error: updateError } = await admin
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

    if (updateError) {
      return NextResponse.json({ message: updateError.message }, { status: 500 });
    }

    if (!open && updated) {
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
      updatedCount: updated?.length ?? 0,
    });
  } catch (cause) {
    return NextResponse.json({
      message: cause instanceof Error ? cause.message : 'Could not update marks entry status.',
    }, { status: 500 });
  }
}
