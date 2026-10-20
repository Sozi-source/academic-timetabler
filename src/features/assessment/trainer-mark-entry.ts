import { createHash } from 'node:crypto';

import { createAdminClient } from '@/lib/supabase/admin';
import type { TrainerMarkEntryRow, TrainerMarkInviteRow } from './trainer-mark-entry-types';

export function hashTrainerMarkToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isTrainerMarkToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{40,60}$/.test(value);
}

export async function getTrainerMarkInvite(token: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('assessment_trainer_mark_invites')
    .select('id,assessment_id,department_id,trainer_name,trainer_email,token_hash,expires_at,created_by,created_at,last_accessed_at,submitted_at,revoked_at')
    .eq('token_hash', hashTrainerMarkToken(token))
    .maybeSingle<TrainerMarkInviteRow>();

  if (error) throw new Error(`Could not validate trainer access: ${error.message}`);
  if (!data || data.revoked_at || Date.parse(data.expires_at) <= Date.now()) return null;
  return data;
}

export async function loadTrainerMarkSession(invite: TrainerMarkInviteRow) {
  const admin = createAdminClient();
  const { data: event, error: eventError } = await admin
    .from('assessment_event_workspace')
    .select('id,assessment_type,workflow_status,population_locked_at,academic_period_id,unit_id')
    .eq('id', invite.assessment_id)
    .maybeSingle<{
      id: string;
      assessment_type: string;
      workflow_status: string;
      population_locked_at: string | null;
      academic_period_id: string;
      unit_id: string;
    }>();
  if (eventError) throw new Error(`Could not load the assigned markbook: ${eventError.message}`);
  if (!event || event.assessment_type !== 'exam' || !event.population_locked_at) {
    throw new Error('This markbook is not available for trainer entry.');
  }

  const [unitResult, periodResult, rosterResult, assessmentResult] = await Promise.all([
    admin.from('units').select('code,name').eq('id', event.unit_id).maybeSingle<{ code: string | null; name: string }>(),
    admin.from('academic_periods').select('name').eq('id', event.academic_period_id).maybeSingle<{ name: string }>(),
    admin.from('assessment_roster')
      .select('student_id,cohort_id,pre_assessment_status')
      .eq('assessment_id', invite.assessment_id),
    admin.from('assessment_events')
      .select('status,exam_marks_finalized_at')
      .eq('id', invite.assessment_id)
      .maybeSingle<{ status: string; exam_marks_finalized_at: string | null }>(),
  ]);
  const rosterRows = rosterResult.data ?? [];
  if (unitResult.error || periodResult.error || rosterResult.error || assessmentResult.error) {
    throw new Error('Could not load the assigned markbook roster.');
  }
  if (!unitResult.data || !periodResult.data || !rosterRows.length) {
    throw new Error('The assigned markbook does not have a complete roster.');
  }

  const studentIds = rosterRows.map((row) => row.student_id as string);
  const [{ data: students, error: studentsError }, { data: drafts, error: draftsError }] = await Promise.all([
    admin.from('students').select('id,admission_number,full_name').in('id', studentIds),
    admin.from('assessment_online_mark_drafts')
      .select('student_id,assignment_mark,presentation_mark,rat_mark,cat_mark,exam_mark')
      .eq('assessment_id', invite.assessment_id),
  ]);
  if (studentsError || draftsError) throw new Error('Could not load current draft marks.');

  const studentById = new Map((students ?? []).map((student) => [student.id, student]));
  const draftByStudentId = new Map((drafts ?? []).map((draft) => [draft.student_id, draft]));
  const roster: TrainerMarkEntryRow[] = rosterRows.flatMap((row) => {
    const studentId = row.student_id as string;
    const student = studentById.get(studentId);
    if (!student) return [];
    const draft = draftByStudentId.get(studentId);
    return [{
      studentId,
      admissionNumber: student.admission_number,
      fullName: student.full_name,
      attendanceStatus: row.pre_assessment_status === 'absent' ? 'absent' : 'expected',
      assignment: draft?.assignment_mark ?? null,
      presentation: draft?.presentation_mark ?? null,
      rat: draft?.rat_mark ?? null,
      cat: draft?.cat_mark ?? null,
      exam: row.pre_assessment_status === 'absent' ? null : draft?.exam_mark ?? null,
    }];
  }).sort((first, second) => first.admissionNumber.localeCompare(second.admissionNumber, undefined, { numeric: true }));

  return {
    trainerName: invite.trainer_name,
    trainerEmail: invite.trainer_email,
    expiresAt: invite.expires_at,
    submittedAt: invite.submitted_at,
    locked: ['submitted', 'finalised', 'archived'].includes(event.workflow_status) || assessmentResult.data?.status === 'closed' || Boolean(assessmentResult.data?.exam_marks_finalized_at),
    unit: { code: unitResult.data.code, name: unitResult.data.name },
    academicPeriod: periodResult.data.name,
    students: roster,
  };
}
