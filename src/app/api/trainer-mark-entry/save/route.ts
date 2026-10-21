import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getTrainerMarkInvite } from '@/features/assessment/trainer-mark-entry';
import { createAdminClient } from '@/lib/supabase/admin';

const inviteCookieName = 'trainer_mark_invite';
const markValue = z.number().finite().nullable();
const entriesSchema = z.array(z.object({
  assessment_id: z.string().uuid(),
  student_id: z.string().uuid(),
  assignment: markValue,
  presentation: markValue,
  rat: markValue,
  cat: markValue,
  exam: markValue,
})).min(1).max(2000);
const saveSchema = z.object({ cohort_id: z.string().uuid().nullable().optional(), component: z.enum(['all', 'assignment', 'presentation', 'rat', 'cat', 'exam']).default('all'), entries: entriesSchema.min(1).max(2000), submit: z.boolean().default(false) });

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(inviteCookieName)?.value;
  if (!token) return NextResponse.json({ message: 'Open your invitation link to access this markbook.' }, { status: 401 });

  const rawBody = await request.json().catch(() => null);
  const parsed = saveSchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ message: 'Check the marks and try again.' }, { status: 400 });

  try {
    const invite = await getTrainerMarkInvite(token);
    if (!invite) return NextResponse.json({ message: 'This trainer link has expired or was revoked.' }, { status: 410 });

    const admin = createAdminClient();
    const entriesByAssessment = new Map<string, typeof parsed.data.entries>();
    for (const entry of parsed.data.entries) {
      entriesByAssessment.set(entry.assessment_id, [...(entriesByAssessment.get(entry.assessment_id) ?? []), entry]);
    }
    const results: unknown[] = [];
    for (const [assessmentId, entries] of entriesByAssessment) {
      let scopeTokenHash = invite.token_hash;
      if (invite.scope_unit_id) {
        let scopeQuery = admin.from('assessment_trainer_mark_invites')
          .select('token_hash,expires_at,submitted_at,revoked_at')
          .eq('parent_invite_id', invite.id)
          .eq('assessment_id', assessmentId);
        scopeQuery = parsed.data.cohort_id
          ? scopeQuery.eq('cohort_id', parsed.data.cohort_id)
          : scopeQuery.is('cohort_id', null);
        const { data: scope, error: scopeError } = await scopeQuery.maybeSingle();
        if (scopeError || !scope) return NextResponse.json({ message: 'That cohort is not included in this trainer link.' }, { status: 403 });
        if (scope.revoked_at || Date.parse(scope.expires_at) <= Date.now()) return NextResponse.json({ message: 'This cohort link has expired or was revoked.' }, { status: 410 });
        if (scope.submitted_at) return NextResponse.json({ message: 'Marks for this cohort have already been submitted.' }, { status: 409 });
        scopeTokenHash = scope.token_hash;
      } else if (parsed.data.cohort_id) {
        return NextResponse.json({ message: 'This invitation does not support cohort-specific submission.' }, { status: 400 });
      }

      const { data, error } = await admin.rpc('save_assessment_component_with_trainer_invite', {
        target_token_hash: scopeTokenHash,
        target_component: parsed.data.component,
        target_entries: entries.map(({ assessment_id: _assessmentId, ...entry }) => entry),
        submit_component: parsed.data.submit,
      });
      if (error) {
        const status = error.code === '42501' ? 403 : error.code === '23514' ? 422 : 409;
        return NextResponse.json({ message: error.message }, { status });
      }
      results.push(data);
    }
    const savedCount = results.reduce<number>((total, result) => {
      if (typeof result !== 'object' || result === null || !('savedCount' in result)) return total;
      const count = result.savedCount;
      return total + (typeof count === 'number' ? count : 0);
    }, 0);
    return NextResponse.json({ success: true, result: { scopes: results, savedCount } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Unable to save trainer marks.' }, { status: 500 });
  }
}
