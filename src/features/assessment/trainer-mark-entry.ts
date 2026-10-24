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

function isMissingComponentSubmissionsTable(error: { code?: string; message: string } | null) {
  return Boolean(error && (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || error.message.includes('assessment_mark_component_submissions')
  ));
}

function componentSubmissionsMigrationError() {
  return new Error('The database is missing the component marks update. Apply migration 20261021160000_component_level_trainer_mark_submissions.sql, then reload this link.');
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
    const [{ data: events, error: eventsError }, { data: rosterRows, error: rosterError }, { data: assessmentEvents }] = await Promise.all([
      admin.from('assessment_event_workspace')
        .select('id,assessment_type,workflow_status,population_locked_at,academic_period_id,unit_id')
        .in('id', assessmentIds),
      admin.from('assessment_roster')
        .select('assessment_id,student_id,cohort_id,pre_assessment_status')
        .in('assessment_id', assessmentIds),
      admin.from('assessment_events')
        .select('id,trainer_entry_open,status,exam_marks_finalized_at')
        .in('id', assessmentIds),
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
    if (isMissingComponentSubmissionsTable(componentSubmissionsError)) throw componentSubmissionsMigrationError();
    if (unitsError || periodsError || studentsError || draftsError || cohortsError || componentSubmissionsError) throw new Error('Could not load the assigned unit roster.');
    const unitById = new Map((units ?? []).map((unit) => [unit.id, unit]));
    const periodNames = [...new Set((periods ?? []).map((period) => period.name))];
    const studentById = new Map((students ?? []).map((student) => [student.id, student]));
    const draftByKey = new Map((drafts ?? []).map((draft) => [`${draft.assessment_id}:${draft.student_id}`, draft]));
    const draftByStudentId = new Map<string, (typeof drafts extends (infer T)[] | null ? T : never)>();
    for (const draft of drafts ?? []) {
      const existing = draftByStudentId.get(draft.student_id);
      if (!existing) {
        draftByStudentId.set(draft.student_id, draft);
      } else {
        const hasExistingMarks = existing.assignment_mark !== null || existing.presentation_mark !== null || existing.rat_mark !== null || existing.cat_mark !== null || existing.exam_mark !== null;
        const hasNewMarks = draft.assignment_mark !== null || draft.presentation_mark !== null || draft.rat_mark !== null || draft.cat_mark !== null || draft.exam_mark !== null;
        if (!hasExistingMarks && hasNewMarks) {
          draftByStudentId.set(draft.student_id, draft);
        }
      }
    }
    const assessmentEventById = new Map((assessmentEvents ?? []).map((e) => [e.id, e]));
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
      trainerEntryOpen: boolean;
    }>();
    const seenStudentIdsByCohort = new Map<string, Set<string>>();

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
          trainerEntryOpen: true,
        });
        seenStudentIdsByCohort.set(cohortKey, new Set());
      }
      const cohort = cohorts.get(cohortKey)!;
      if (!cohort.scopeRows.some((row) => row.id === scope.id)) cohort.scopeRows.push(scope);
      const rawEvent = assessmentEventById.get(scope.assessment_id);
      const isEntryOpen = rawEvent?.trainer_entry_open === true;
      cohort.trainerEntryOpen = isEntryOpen;
      cohort.locked ||= !isEntryOpen || ['submitted', 'finalised', 'archived'].includes(event.workflow_status) || rawEvent?.status === 'closed' || Boolean(rawEvent?.exam_marks_finalized_at) || scope.revoked_at !== null || Date.parse(scope.expires_at) <= Date.now();

      const seenStudents = seenStudentIdsByCohort.get(cohortKey)!;
      const draft = draftByKey.get(`${roster.assessment_id}:${roster.student_id}`) ?? draftByStudentId.get(roster.student_id);

      if (seenStudents.has(roster.student_id)) {
        // Deduplicate: If already added from another equivalent/sibling event, backfill any non-null marks
        const existingStudent = cohort.students.find((s) => s.studentId === roster.student_id);
        if (existingStudent && draft) {
          existingStudent.assignment = existingStudent.assignment ?? draft.assignment_mark ?? null;
          existingStudent.presentation = existingStudent.presentation ?? draft.presentation_mark ?? null;
          existingStudent.rat = existingStudent.rat ?? draft.rat_mark ?? null;
          existingStudent.cat = existingStudent.cat ?? draft.cat_mark ?? null;
          if (existingStudent.attendanceStatus !== 'absent') {
            existingStudent.exam = existingStudent.exam ?? draft.exam_mark ?? null;
          }
        }
        continue;
      }
      seenStudents.add(roster.student_id);

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
      trainerEntryOpen: cohort.trainerEntryOpen,
      componentSubmissions: Object.fromEntries((['assignment', 'presentation', 'rat', 'cat', 'exam'] as TrainerMarkComponentKey[]).flatMap((component) => {
        const timestamps = cohort.scopeRows
          .map((scope) => componentSubmissionByKey.get(`${scope.assessment_id}:${scope.cohort_id ?? 'all'}:${component}`))
          .filter((timestamp): timestamp is string => typeof timestamp === 'string');
        return timestamps.length > 0
          ? [[component, [...timestamps].sort().at(-1) as string]]
          : [];
      })) as TrainerMarkComponentSubmissions,
      submittedAt: cohort.scopeRows.some((scope) => scope.submitted_at)
        ? [...cohort.scopeRows.map((scope) => scope.submitted_at)].filter(Boolean).sort().pop() ?? null
        : null,
    })).sort((first, second) => first.name.localeCompare(second.name));
    const firstEvent = eventRows[0];
    if (!firstEvent || !periodNames.length) throw new Error('This unit invitation has no available markbooks.');
    const firstUnit = unitById.get(firstEvent.unit_id);
    if (!firstUnit) throw new Error('Could not load the assigned unit.');
    const allCohortsLocked = cohortPayload.length === 0 || cohortPayload.every((cohort) => cohort.locked);
    const anyEntryOpen = cohortPayload.some((cohort) => cohort.trainerEntryOpen);
    return {
      trainerName: invite.trainer_name,
      trainerEmail: invite.trainer_email,
      expiresAt: invite.expires_at,
      submittedAt: null,
      locked: allCohortsLocked,
      trainerEntryOpen: anyEntryOpen,
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
      .select('status,exam_marks_finalized_at,trainer_entry_open')
      .eq('id', invite.assessment_id)
      .maybeSingle<{ status: string; exam_marks_finalized_at: string | null; trainer_entry_open: boolean }>(),
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
  if (isMissingComponentSubmissionsTable(componentError)) throw componentSubmissionsMigrationError();
  if (studentsError || draftsError || componentError) throw new Error('Could not load current draft marks.');

  const studentById = new Map((students ?? []).map((student) => [student.id, student]));
  const draftByStudentId = new Map((drafts ?? []).map((draft) => [draft.student_id, draft]));
  const seenStudentIds = new Set<string>();
  const roster: TrainerMarkEntryRow[] = rosterRows.flatMap((row) => {
    const studentId = row.student_id as string;
    if (seenStudentIds.has(studentId)) return [];
    seenStudentIds.add(studentId);
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
  const isTrainerEntryOpen = assessmentResult.data?.trainer_entry_open === true;
  const locked = !isTrainerEntryOpen || ['submitted', 'finalised', 'archived'].includes(event.workflow_status) || assessmentResult.data?.status === 'closed' || Boolean(assessmentResult.data?.exam_marks_finalized_at);
  return {
    trainerName: invite.trainer_name,
    trainerEmail: invite.trainer_email,
    expiresAt: invite.expires_at,
    submittedAt: invite.submitted_at,
    locked,
    trainerEntryOpen: isTrainerEntryOpen,
    unit: { code: unitResult.data.code, name: unitResult.data.name },
    academicPeriod: periodResult.data.name,
    students: roster,
    cohorts: [{ id: invite.cohort_id ?? null, name: 'All cohorts', students: roster, submittedAt: invite.submitted_at, locked, trainerEntryOpen: isTrainerEntryOpen, componentSubmissions }],
  };
}
