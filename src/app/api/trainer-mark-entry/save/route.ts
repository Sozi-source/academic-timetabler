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
    const results: unknown[] = [];

    if (invite.scope_unit_id) {
      let scopeQuery = admin.from('assessment_trainer_mark_invites')
        .select('id,assessment_id,token_hash,expires_at,submitted_at,revoked_at')
        .eq('parent_invite_id', invite.id);
      scopeQuery = parsed.data.cohort_id
        ? scopeQuery.eq('cohort_id', parsed.data.cohort_id)
        : scopeQuery.is('cohort_id', null);
      const { data: scopes, error: scopeError } = await scopeQuery;
      if (scopeError || !scopes || scopes.length === 0) {
        return NextResponse.json({ message: 'That cohort is not included in this trainer link.' }, { status: 403 });
      }

      for (const scope of scopes) {
        if (scope.revoked_at || Date.parse(scope.expires_at) <= Date.now()) {
          return NextResponse.json({ message: 'This cohort link has expired or was revoked.' }, { status: 410 });
        }
        if (scope.submitted_at) {
          return NextResponse.json({ message: 'Marks for this cohort have already been submitted.' }, { status: 409 });
        }
      }

      const { data: rawEvents } = await admin
        .from('assessment_events')
        .select('id,trainer_entry_open,status,exam_marks_finalized_at')
        .in('id', scopes.map((s) => s.assessment_id));
      const isLocked = (rawEvents ?? []).some((e) => !e.trainer_entry_open || e.status === 'closed' || e.exam_marks_finalized_at !== null);
      if (isLocked) {
        return NextResponse.json({ message: 'Marks entry is currently closed by the department administration.' }, { status: 403 });
      }

      const { data: scopeRosterRows } = await admin
        .from('assessment_roster')
        .select('assessment_id,student_id')
        .in('assessment_id', scopes.map((s) => s.assessment_id));

      const studentsByAssessment = new Map<string, Set<string>>();
      for (const row of scopeRosterRows ?? []) {
        if (!studentsByAssessment.has(row.assessment_id)) {
          studentsByAssessment.set(row.assessment_id, new Set());
        }
        studentsByAssessment.get(row.assessment_id)!.add(row.student_id);
      }

      for (const scope of scopes) {
        const allowedStudentIds = studentsByAssessment.get(scope.assessment_id) ?? new Set();
        const relevantEntries = parsed.data.entries
          .filter((entry) => allowedStudentIds.has(entry.student_id))
          .map(({ assessment_id: _assessmentId, ...entry }) => entry);

        if (relevantEntries.length === 0) continue;

        const { data, error } = await admin.rpc('save_assessment_component_with_trainer_invite', {
          target_token_hash: scope.token_hash,
          target_component: parsed.data.component,
          target_entries: relevantEntries,
          submit_component: parsed.data.submit,
        });
        if (error) {
          const status = error.code === '42501' ? 403 : error.code === '23514' ? 422 : 409;
          return NextResponse.json({ message: error.message }, { status });
        }
        results.push(data);
      }
    } else {
      if (parsed.data.cohort_id) {
        return NextResponse.json({ message: 'This invitation does not support cohort-specific submission.' }, { status: 400 });
      }
      const { data: eventData } = await admin
        .from('assessment_events')
        .select('id,trainer_entry_open,status,exam_marks_finalized_at')
        .eq('id', invite.assessment_id)
        .maybeSingle();
      if (!eventData?.trainer_entry_open || eventData?.status === 'closed' || eventData?.exam_marks_finalized_at !== null) {
        return NextResponse.json({ message: 'Marks entry is currently closed by the department administration.' }, { status: 403 });
      }
      const { data, error } = await admin.rpc('save_assessment_component_with_trainer_invite', {
        target_token_hash: invite.token_hash,
        target_component: parsed.data.component,
        target_entries: parsed.data.entries.map(({ assessment_id: _assessmentId, ...entry }) => entry),
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
