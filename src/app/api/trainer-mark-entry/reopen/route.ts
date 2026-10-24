import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getTrainerMarkInvite } from '@/features/assessment/trainer-mark-entry';
import { createAdminClient } from '@/lib/supabase/admin';

const inviteCookieName = 'trainer_mark_invite';

const reopenSchema = z.object({
  component: z.enum(['all', 'assignment', 'presentation', 'rat', 'cat', 'exam']).default('all'),
  cohort_id: z.string().uuid().nullable().optional(),
  reason: z.string().min(3, 'Provide a reason of at least 3 characters for the audit log.').max(500),
});

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(inviteCookieName)?.value;
  if (!token) {
    return NextResponse.json({ message: 'Open your invitation link to access this markbook.' }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = reopenSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Invalid request data.' },
      { status: 400 },
    );
  }

  const { component, cohort_id: cohortId, reason } = parsed.data;

  try {
    const invite = await getTrainerMarkInvite(token);
    if (!invite) {
      return NextResponse.json({ message: 'This trainer link has expired or was revoked.' }, { status: 410 });
    }

    const admin = createAdminClient();

    // Verify marks entry is open on assessment_events
    const { data: currentEvent } = await admin
      .from('assessment_events')
      .select('id, trainer_entry_open, status, exam_marks_finalized_at')
      .eq('id', invite.assessment_id)
      .maybeSingle();

    if (!currentEvent?.trainer_entry_open) {
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

    // Try RPC function first
    let rpcDone = false;
    try {
      const { error: rpcError } = await admin.rpc('reopen_assessment_component_with_trainer_invite', {
        target_token_hash: invite.token_hash,
        target_cohort_id: cohortId ?? null,
        target_component: component,
        target_reason: reason,
      });
      if (!rpcError) {
        rpcDone = true;
      }
    } catch {
      // Fallback
    }

    if (!rpcDone) {
      // Fallback direct execution
      let assessmentIds = [invite.assessment_id];
      if (invite.scope_unit_id) {
        let scopeQuery = admin
          .from('assessment_trainer_mark_invites')
          .select('id, assessment_id')
          .eq('parent_invite_id', invite.id);

        if (cohortId) {
          scopeQuery = scopeQuery.eq('cohort_id', cohortId);
        }

        const { data: scopes } = await scopeQuery;
        if (scopes?.length) {
          assessmentIds = [...new Set(scopes.map((s) => s.assessment_id))];
        }
      }

      for (const assessmentId of assessmentIds) {
        let deleteQuery = admin
          .from('assessment_mark_component_submissions')
          .delete()
          .eq('assessment_id', assessmentId);

        if (component !== 'all') {
          deleteQuery = deleteQuery.eq('component_key', component);
        }
        if (cohortId) {
          deleteQuery = deleteQuery.eq('cohort_id', cohortId);
        }

        await deleteQuery;

        await admin
          .from('assessment_trainer_mark_invites')
          .update({ submitted_at: null })
          .or(`id.eq.${invite.id},parent_invite_id.eq.${invite.id}`);

        await admin
          .from('assessment_events')
          .update({ marks_submitted_at: null, updated_at: new Date().toISOString() })
          .eq('id', assessmentId)
          .not('marks_submitted_at', 'is', null);

        try {
          await admin.from('assessment_mark_revisions').insert({
            assessment_id: assessmentId,
            cohort_id: cohortId ?? invite.cohort_id ?? null,
            component_key: component,
            unlocked_by_user_id: null,
            unlocked_by_name: invite.trainer_name,
            reason,
          });
        } catch {
          // table might not exist yet
        }
      }
    }

    return NextResponse.json({
      success: true,
      component,
      unlocked: true,
      message: `${component.toUpperCase()} marks unlocked for revision.`,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to unlock marks.' },
      { status: 500 },
    );
  }
}
