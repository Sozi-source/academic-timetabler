import { createHash } from 'node:crypto';

import { createAdminClient } from '@/lib/supabase/admin';
import type { TrainerMarkComponentKey, TrainerMarkComponentSubmissions, TrainerMarkEntryRow, TrainerMarkInviteRow } from './trainer-mark-entry-types';

export function hashTrainerMarkToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function hashTrainerMarkScopeToken(token: string, assessmentId: string, cohortId: string | null): string {
  return hashTrainerMarkToken(`${token}:${assessmentId}:${cohortId ?? 'all'}`);
}

export function isTrainerMarkToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{40,60}$/.test(value);
}

export async function getTrainerMarkInvite(token: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('assessment_trainer_mark_invites')
    .select('id,assessment_id,department_id,trainer_name,trainer_email,token_hash,expires_at,created_by,created_at,last_accessed_at,submitted_at,revoked_at,parent_invite_id,cohort_id,scope_unit_id')
    .eq('token_hash', hashTrainerMarkToken(token))
    .maybeSingle<TrainerMarkInviteRow>();

  if (error) throw new Error(`Could not validate trainer access: ${error.message}`);
  if (!data || data.revoked_at || Date.parse(data.expires_at) <= Date.now()) return null;
  return data;
}

export async function loadTrainerMarkSession(invite: TrainerMarkInviteRow) {
  const admin = createAdminClient();
  if (invite.scope_unit_id) {
    const { data: scopes, error: scopesError } = await admin
      .from('assessment_trainer_mark_invites')
      .select('id,assessment_id,cohort_id,token_hash,expires_at,submitted_at,revoked_at')
      .eq('parent_invite_id', invite.id);
    if (scopesError) throw new Error(`Could not load unit trainer scopes: ${scopesError.message}`);
    const scopeRows = scopes ?? [];
    const assessmentIds = [...new Set(scopeRows.map((scope) => scope.assessment_id))];
    const [{ data: events, error: eventsError }, { data: rosterRows, error: rosterError }] = await Promise.all([
      admin.from('assessment_event_workspace')
        .select('id,assessment_type,workflow_status,population_locked_at,academic_period_id,unit_id')
        .in('id', assessmentIds),
      admin.from('assessment_roster')
        .select('assessment_id,student_id,cohort_id,pre_assessment_status')
        .in('assessment_id', assessmentIds),
    ]);
    if (eventsError || rosterError) throw new Error('Could not load the assigned unit markbooks.');
    const eventRows = events ?? [];
    const allRosterRows = rosterRows ?? [];
    const studentIds = [...new Set(allRosterRows.map((row) => row.student_id))];
    const cohortIds = [...new Set(allRosterRows.map((row) => row.cohort_id).filter((value): value is string => Boolean(value)))];
    const [{ data: units, error: unitsError }, { data: periods, error: periodsError }, { data: students, error: studentsError }, { data: drafts, error: draftsError }, { data: cohortRows, error: cohortsError }, { data: componentSubmissionRows, error: componentSubmissionsError }] = await Promise.all([
      admin.from('units').select('id,code,name').in('id', [...new Set(eventRows.map((event) => event.unit_id))]),
      admin.from('academic_periods').select('id,name').in('id', [...new Set(eventRows.map((event) => event.academic_period_id))]),
      studentIds.length ? admin.from('students').select('id,admission_number,full_name').in('id', studentIds) : Promise.resolve({ data: [], error: null }),
      assessmentIds.length ? admin.from('assessment_online_mark_drafts').select('assessment_id,student_id,assignment_mark,presentation_mark,rat_mark,cat_mark,exam_mark').in('assessment_id', assessmentIds) : Promise.resolve({ data: [], error: null }),
      cohortIds.length ? admin.from('cohorts').select('id,name').in('id', cohortIds) : Promise.resolve({ data: [], error: null }),
      admin.from('assessment_mark_component_submissions').select('assessment_id,cohort_id,component_key,submitted_at').in('assessment_id', assessmentIds),
    ]);
    if (unitsError || periodsError || studentsError || draftsError || cohortsError || componentSubmissionsError) throw new Error('Could not load the assigned unit roster.');
    const unitById = new Map((units ?? []).map((unit) => [unit.id, unit]));
    const periodNames = [...new Set((periods ?? []).map((period) => period.name))];
    const studentById = new Map((students ?? []).map((student) => [student.id, student]));
    const draftByKey = new Map((drafts ?? []).map((draft) => [`${draft.assessment_id}:${draft.student_id}`, draft]));
    const cohortNameById = new Map((cohortRows ?? []).map((cohort) => [cohort.id, cohort.name]));
    const eventById = new Map(eventRows.map((event) => [event.id, event]));
    const scopeByKey = new Map(scopeRows.map((scope) => [`${scope.assessment_id}:${scope.cohort_id ?? 'all'}`, scope]));
    const componentSubmissionByKey = new Map((componentSubmissionRows ?? []).map((row) => [`${row.assessment_id}:${row.cohort_id ?? 'all'}:${row.component_key}`, row.submitted_at]));
    const cohorts = new Map<string, {
      id: string | null;
      name: string;
      students: TrainerMarkEntryRow[];
      scopeRows: typeof scopeRows;
      locked: boolean;
    }>();
    for (const roster of allRosterRows) {
      const scope = scopeByKey.get(`${roster.assessment_id}:${roster.cohort_id ?? 'all'}`);
      const student = studentById.get(roster.student_id);
      const event = eventById.get(roster.assessment_id);
      if (!scope || !student || !event || event.assessment_type !== 'exam' || !event.population_locked_at) continue;
      const cohortKey = roster.cohort_id ?? 'all';
      if (!cohorts.has(cohortKey)) {
        cohorts.set(cohortKey, {
          id: roster.cohort_id,
          name: roster.cohort_id ? cohortNameById.get(roster.cohort_id) ?? 'Cohort' : 'All cohorts',
          students: [],
          scopeRows: [],
          locked: false,
        });
      }
      const cohort = cohorts.get(cohortKey)!;
      if (!cohort.scopeRows.some((row) => row.id === scope.id)) cohort.scopeRows.push(scope);
      cohort.locked ||= ['submitted', 'finalised', 'archived'].includes(event.workflow_status) || scope.revoked_at !== null || Date.parse(scope.expires_at) <= Date.now();
      const draft = draftByKey.get(`${roster.assessment_id}:${roster.student_id}`);
      cohort.students.push({
        assessmentId: roster.assessment_id,
        studentId: roster.student_id,
        admissionNumber: student.admission_number,
        fullName: student.full_name,
        attendanceStatus: roster.pre_assessment_status === 'absent' ? 'absent' : 'expected',
        assignment: draft?.assignment_mark ?? null,
        presentation: draft?.presentation_mark ?? null,
        rat: draft?.rat_mark ?? null,
        cat: draft?.cat_mark ?? null,
        exam: roster.pre_assessment_status === 'absent' ? null : draft?.exam_mark ?? null,
      });
    }
    const cohortPayload = [...cohorts.values()].map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      students: cohort.students.sort((first, second) => first.admissionNumber.localeCompare(second.admissionNumber, undefined, { numeric: true })),
      locked: cohort.locked,
      componentSubmissions: Object.fromEntries((['assignment', 'presentation', 'rat', 'cat', 'exam'] as TrainerMarkComponentKey[]).flatMap((component) => {
        const timestamps = cohort.scopeRows.map((scope) => componentSubmissionByKey.get(`${scope.assessment_id}:${scope.cohort_id ?? 'all'}:${component}`));
        return timestamps.length > 0 && timestamps.every((timestamp) => typeof timestamp === 'string')
          ? [[component, [...timestamps].sort().at(-1) as string]]
          : [];
      })) as TrainerMarkComponentSubmissions,
      submittedAt: cohort.scopeRows.length > 0 && cohort.scopeRows.every((scope) => scope.submitted_at)
        ? [...cohort.scopeRows.map((scope) => scope.submitted_at)].sort().pop() ?? null
        : null,
    })).sort((first, second) => first.name.localeCompare(second.name));
    const firstEvent = eventRows[0];
    if (!firstEvent || !periodNames.length) throw new Error('This unit invitation has no available markbooks.');
    const firstUnit = unitById.get(firstEvent.unit_id);
    if (!firstUnit) throw new Error('Could not load the assigned unit.');
    return {
      trainerName: invite.trainer_name,
      trainerEmail: invite.trainer_email,
      expiresAt: invite.expires_at,
      submittedAt: null,
      locked: false,
      unit: { code: firstUnit.code, name: firstUnit.name },
      academicPeriod: periodNames[0],
      cohorts: cohortPayload,
    };
  }

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
  const [{ data: students, error: studentsError }, { data: drafts, error: draftsError }, { data: componentRows, error: componentError }] = await Promise.all([
    admin.from('students').select('id,admission_number,full_name').in('id', studentIds),
    admin.from('assessment_online_mark_drafts')
      .select('student_id,assignment_mark,presentation_mark,rat_mark,cat_mark,exam_mark')
      .eq('assessment_id', invite.assessment_id),
    admin.from('assessment_mark_component_submissions')
      .select('component_key,submitted_at')
      .eq('assessment_id', invite.assessment_id)
      .is('cohort_id', invite.cohort_id ?? null),
  ]);
  if (studentsError || draftsError || componentError) throw new Error('Could not load current draft marks.');

  const studentById = new Map((students ?? []).map((student) => [student.id, student]));
  const draftByStudentId = new Map((drafts ?? []).map((draft) => [draft.student_id, draft]));
  const roster: TrainerMarkEntryRow[] = rosterRows.flatMap((row) => {
    const studentId = row.student_id as string;
    const student = studentById.get(studentId);
    if (!student) return [];
    const draft = draftByStudentId.get(studentId);
    const attendanceStatus: TrainerMarkEntryRow['attendanceStatus'] =
      row.pre_assessment_status === 'absent' ? 'absent' : 'expected';
    return [{
      assessmentId: invite.assessment_id,
      studentId,
      admissionNumber: student.admission_number,
      fullName: student.full_name,
      attendanceStatus,
      assignment: draft?.assignment_mark ?? null,
      presentation: draft?.presentation_mark ?? null,
      rat: draft?.rat_mark ?? null,
      cat: draft?.cat_mark ?? null,
      exam: row.pre_assessment_status === 'absent' ? null : draft?.exam_mark ?? null,
    }];
  }).sort((first, second) => first.admissionNumber.localeCompare(second.admissionNumber, undefined, { numeric: true }));

  const componentSubmissions = Object.fromEntries((componentRows ?? []).map((row) => [row.component_key, row.submitted_at])) as TrainerMarkComponentSubmissions;
  const locked = ['submitted', 'finalised', 'archived'].includes(event.workflow_status) || assessmentResult.data?.status === 'closed' || Boolean(assessmentResult.data?.exam_marks_finalized_at);
  return {
    trainerName: invite.trainer_name,
    trainerEmail: invite.trainer_email,
    expiresAt: invite.expires_at,
    submittedAt: invite.submitted_at,
    locked,
    unit: { code: unitResult.data.code, name: unitResult.data.name },
    academicPeriod: periodResult.data.name,
    students: roster,
    cohorts: [{ id: invite.cohort_id ?? null, name: 'All cohorts', students: roster, submittedAt: invite.submitted_at, locked, componentSubmissions }],
  };
}
