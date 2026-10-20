import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';

import { hashTrainerMarkToken } from '@/features/assessment/trainer-mark-entry';

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

const createInviteSchema = z.object({
  trainerName: z.string().trim().min(2).max(120),
  trainerEmail: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
  expiryDays: z.number().int().min(1).max(14).default(7),
});

export async function GET(_request: Request, { params }: RouteContext) {
  const profile = await requireHodAccess();
  const { assessmentId } = await params;
  if (!profile.activeDepartmentId) {
    return NextResponse.json({ message: 'Select an active department.' }, { status: 409 });
  }

  const admin = createAdminClient();
  const { data: assessment, error: assessmentError } = await admin
    .from('assessment_events')
    .select('id')
    .eq('id', assessmentId)
    .eq('department_id', profile.activeDepartmentId)
    .maybeSingle();
  if (assessmentError) return NextResponse.json({ message: 'Could not validate this markbook.' }, { status: 500 });
  if (!assessment) return NextResponse.json({ message: 'This markbook is unavailable.' }, { status: 404 });

  const { data: invites, error } = await admin
    .from('assessment_trainer_mark_invites')
    .select('id,trainer_name,trainer_email,created_at,expires_at,last_accessed_at,submitted_at,revoked_at')
    .eq('assessment_id', assessmentId)
    .eq('department_id', profile.activeDepartmentId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ message: 'Could not load trainer invitations.' }, { status: 500 });

  const { data: drafts, error: draftsError } = await admin
    .from('assessment_online_mark_drafts')
    .select('student_id,assignment_mark,presentation_mark,rat_mark,cat_mark,exam_mark,source_trainer_invite_id,updated_at')
    .eq('assessment_id', assessmentId)
    .not('source_trainer_invite_id', 'is', null)
    .order('updated_at', { ascending: false });
  if (draftsError) return NextResponse.json({ message: 'Could not load trainer mark drafts.' }, { status: 500 });

  const studentIds = [...new Set((drafts ?? []).map((draft) => draft.student_id))];
  const { data: students, error: studentsError } = studentIds.length
    ? await admin.from('students').select('id,admission_number,full_name').in('id', studentIds)
    : { data: [], error: null };
  if (studentsError) return NextResponse.json({ message: 'Could not load student details for trainer drafts.' }, { status: 500 });

  const studentById = new Map((students ?? []).map((student) => [student.id, student]));
  const inviteById = new Map((invites ?? []).map((invite) => [invite.id, invite]));

  return NextResponse.json({
    invites: (invites ?? []).map((invite) => ({
      ...invite,
      status: invite.revoked_at ? 'revoked' : invite.submitted_at ? 'submitted' : Date.parse(invite.expires_at) <= Date.now() ? 'expired' : 'active',
    })),
    reviewMarks: (drafts ?? []).map((draft) => ({
      ...draft,
      student: studentById.get(draft.student_id) ?? null,
      trainer: draft.source_trainer_invite_id ? inviteById.get(draft.source_trainer_invite_id) ?? null : null,
    })),
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  const profile = await requireHodAccess();
  const { assessmentId } = await params;
  if (!profile.activeDepartmentId) {
    return NextResponse.json({ message: 'Select an active department.' }, { status: 409 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = createInviteSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Enter a trainer name, a valid email if available, and an expiry from 1 to 14 days.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: event, error: eventError } = await admin
    .from('assessment_events')
    .select('id,department_id,assessment_type,status,exam_marks_finalized_at')
    .eq('id', assessmentId)
    .eq('department_id', profile.activeDepartmentId)
    .maybeSingle<{ id: string; department_id: string; assessment_type: string; status: string; exam_marks_finalized_at: string | null }>();
  if (eventError) return NextResponse.json({ message: 'Could not validate this markbook.' }, { status: 500 });
  if (!event || event.assessment_type !== 'exam') {
    return NextResponse.json({ message: 'This exam markbook is unavailable.' }, { status: 404 });
  }
  if (event.status === 'closed' || event.exam_marks_finalized_at) {
    return NextResponse.json({ message: 'This markbook is finalized and no longer accepts trainer marks.' }, { status: 409 });
  }

  const [{ data: workspace, error: workspaceError }, { count: rosterCount, error: rosterError }, { data: results, error: resultError }] = await Promise.all([
    admin.from('assessment_event_workspace')
      .select('workflow_status,population_locked_at,academic_period_id,unit_id')
      .eq('id', assessmentId)
      .maybeSingle<{ workflow_status: string; population_locked_at: string | null; academic_period_id: string; unit_id: string }>(),
    admin.from('assessment_roster').select('student_id', { count: 'exact', head: true }).eq('assessment_id', assessmentId),
    admin.from('assessment_results').select('id').eq('assessment_event_id', assessmentId).limit(1),
  ]);
  if (workspaceError || rosterError || resultError) {
    return NextResponse.json({ message: 'Could not validate the markbook roster.' }, { status: 500 });
  }
  if (!workspace || !workspace.population_locked_at || !rosterCount) {
    return NextResponse.json({ message: 'Lock and generate the markbook roster before inviting a trainer.' }, { status: 409 });
  }
  if (['submitted', 'finalised', 'archived'].includes(workspace.workflow_status) || results?.length) {
    return NextResponse.json({ message: 'This markbook no longer accepts trainer marks.' }, { status: 409 });
  }

  const { data: rule, error: ruleError } = await admin
    .from('assessment_rules')
    .select('maximum_mark')
    .eq('academic_period_id', workspace.academic_period_id)
    .eq('unit_id', workspace.unit_id)
    .eq('assessment_type', 'exam')
    .maybeSingle<{ maximum_mark: number }>();
  if (ruleError) return NextResponse.json({ message: 'Could not validate the final assessment rule.' }, { status: 500 });
  if (!rule || Number(rule.maximum_mark) !== 100) {
    return NextResponse.json({ message: 'Configure the final assessment rule to 100 marks before inviting a trainer.' }, { status: 409 });
  }

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + parsed.data.expiryDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: invite, error: insertError } = await admin
    .from('assessment_trainer_mark_invites')
    .insert({
      assessment_id: assessmentId,
      department_id: profile.activeDepartmentId,
      trainer_name: parsed.data.trainerName,
      trainer_email: parsed.data.trainerEmail || null,
      token_hash: hashTrainerMarkToken(token),
      expires_at: expiresAt,
      created_by: profile.id,
    })
    .select('id,expires_at')
    .single<{ id: string; expires_at: string }>();

  if (insertError || !invite) {
    return NextResponse.json({ message: 'Could not create the trainer invitation.' }, { status: 500 });
  }

  const inviteUrl = new URL('/trainer-mark-entry', request.url);
  inviteUrl.hash = token;
  return NextResponse.json({ invite: { id: invite.id, expiresAt: invite.expires_at }, inviteUrl: inviteUrl.toString() }, { status: 201 });
}
