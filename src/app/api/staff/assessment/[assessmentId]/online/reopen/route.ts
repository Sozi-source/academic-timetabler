import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireTrainerAccess } from '@/features/auth/authorization';
import { trainerCanAccessAssessment } from '@/features/staff-assessment/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{
    assessmentId: string;
  }>;
}

const reopenSchema = z.object({
  component: z.enum(['all', 'assignment', 'presentation', 'rat', 'cat', 'exam']).default('all'),
  cohortId: z.string().uuid().nullable().optional(),
  reason: z.string().min(3, 'Provide a reason of at least 3 characters for the audit log.').max(500),
});

export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  const profile = await requireTrainerAccess();
  const { assessmentId } = await params;

  if (!(await trainerCanAccessAssessment(assessmentId))) {
    return NextResponse.json(
      { message: 'This assessment is outside your teaching allocations.' },
      { status: 403 },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = reopenSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Invalid request data.' },
      { status: 400 },
    );
  }

  const { component, cohortId, reason } = parsed.data;

  // Resolve target assessment id if allocation id
  let targetAssessmentId = assessmentId;
  const admin = createAdminClient();

  if (targetAssessmentId.startsWith('alloc-')) {
    const allocId = targetAssessmentId.replace('alloc-', '');
    const { data: alloc } = await admin
      .from('teaching_allocations')
      .select('academic_period_id, unit_id')
      .eq('id', allocId)
      .maybeSingle();

    if (alloc) {
      const { data: eventData } = await admin
        .from('assessment_events')
        .select('id')
        .eq('academic_period_id', alloc.academic_period_id)
        .eq('unit_id', alloc.unit_id)
        .eq('assessment_type', 'exam')
        .maybeSingle();

      if (eventData?.id) {
        targetAssessmentId = eventData.id;
      }
    }
  }

  // Find any sibling equivalent events
  const targetAssessmentIds = [targetAssessmentId];
  const { data: currentEvent } = await admin
    .from('assessment_events')
    .select('id, unit_id, academic_period_id, trainer_entry_open, status, exam_marks_finalized_at')
    .eq('id', targetAssessmentId)
    .maybeSingle();

  if (!currentEvent) {
    return NextResponse.json({ message: 'Markbook assessment not found.' }, { status: 404 });
  }

  if (!currentEvent.trainer_entry_open) {
    return NextResponse.json(
      { message: 'Marks entry is currently closed by the department administration.' },
      { status: 403 },
    );
  }

  if (currentEvent.status === 'closed' || currentEvent.exam_marks_finalized_at !== null) {
    return NextResponse.json(
      { message: 'This markbook has been finalised and can no longer be revised.' },
      { status: 403 },
    );
  }

  if (currentEvent.unit_id && currentEvent.academic_period_id) {
    const { data: equivRow } = await admin
      .from('unit_equivalence_members')
      .select('equivalence_group_id')
      .eq('unit_id', currentEvent.unit_id)
      .eq('status', 'approved')
      .maybeSingle();

    if (equivRow?.equivalence_group_id) {
      const { data: siblingUnits } = await admin
        .from('unit_equivalence_members')
        .select('unit_id')
        .eq('equivalence_group_id', equivRow.equivalence_group_id)
        .eq('status', 'approved');

      const siblingUnitIds = (siblingUnits ?? []).map((u) => u.unit_id);
      if (siblingUnitIds.length > 0) {
        const { data: siblingEvents } = await admin
          .from('assessment_events')
          .select('id')
          .eq('academic_period_id', currentEvent.academic_period_id)
          .eq('assessment_type', 'exam')
          .in('unit_id', siblingUnitIds);

        for (const ev of siblingEvents ?? []) {
          if (ev.id && !targetAssessmentIds.includes(ev.id)) {
            targetAssessmentIds.push(ev.id);
          }
        }
      }
    }
  }

  const supabase = await createClient();

  // Try RPC function first
  let rpcSuccess = false;
  try {
    const { error: rpcError } = await supabase.rpc('reopen_assessment_component_submission', {
      p_assessment_id: targetAssessmentId,
      p_cohort_id: cohortId ?? null,
      p_component_key: component,
      p_reason: reason,
      p_unlocked_by_name: profile.fullName,
    });
    if (!rpcError) {
      rpcSuccess = true;
    }
  } catch {
    // Fall back to direct queries below
  }

  if (!rpcSuccess) {
    // Direct admin client execution
    for (const eventId of targetAssessmentIds) {
      let deleteQuery = admin
        .from('assessment_mark_component_submissions')
        .delete()
        .eq('assessment_id', eventId);

      if (component !== 'all') {
        deleteQuery = deleteQuery.eq('component_key', component);
      }
      if (cohortId) {
        deleteQuery = deleteQuery.eq('cohort_id', cohortId);
      }

      await deleteQuery;

      await admin
        .from('assessment_events')
        .update({ marks_submitted_at: null, updated_at: new Date().toISOString() })
        .eq('id', eventId)
        .not('marks_submitted_at', 'is', null);

      try {
        await admin.from('assessment_mark_revisions').insert({
          assessment_id: eventId,
          cohort_id: cohortId ?? null,
          component_key: component,
          unlocked_by_user_id: profile.id,
          unlocked_by_name: profile.fullName,
          reason,
        });
      } catch {
        // Revision table might not exist yet if migration pending
      }
    }
  }

  return NextResponse.json({
    success: true,
    component,
    unlocked: true,
    message: `${component.toUpperCase()} marks unlocked for revision.`,
  });
}
