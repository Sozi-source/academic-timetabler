'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getUnifiedUnitRoster } from '@/features/academic-roster/unified-roster';
import { getAssessmentById, getAssessmentPopulation } from '@/features/assessment/queries';
import { requireHodAccess } from '@/features/auth/authorization';
import { resolveAssessmentIdsWithSiblings } from '@/features/staff-assessment/online-marks-query';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export async function saveAssessmentAttendanceAction(formData: FormData) {
  await requireHodAccess();
  const assessmentId = text(formData, 'assessmentId');
  const absentStudentIds = formData.getAll('absentStudentId').filter((value): value is string => typeof value === 'string');
  if (!assessmentId) return;
  const assessment = await getAssessmentById(assessmentId);
  if (!assessment) redirect('/assessment/marks?error=not-found');
  if (assessment.exam_marks_finalized_at) redirect(`/assessment/marks/${assessmentId}?error=locked`);
  if (!assessment.cat_marks_finalized_at) redirect(`/assessment/marks/${assessmentId}?error=cat-required`);

  const population = await getAssessmentPopulation(assessmentId);
  if (population.length === 0) redirect(`/assessment/marks/${assessmentId}?error=population`);

  const allowedStudentIds = new Set(
    population.map((row) => row.student?.id).filter((value): value is string => Boolean(value)),
  );
  if (absentStudentIds.some((studentId) => !allowedStudentIds.has(studentId))) {
    redirect(`/assessment/marks/${assessmentId}?error=attendance`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_assessment_attendance', {
    target_assessment_event_id: assessmentId,
    absent_student_ids: absentStudentIds,
  });
  revalidatePath('/assessment');
  revalidatePath('/assessment/marks');
  revalidatePath(`/assessment/marks/${assessmentId}`);
  revalidatePath(`/assessment/population/${assessmentId}`);
  if (error) redirect(`/assessment/marks/${assessmentId}?error=attendance`);
  redirect(`/assessment/marks/${assessmentId}?attendance=saved`);
}

export async function unlockAssessmentMarkComponentAction(formData: FormData) {
  const profile = await requireHodAccess();
  const parsed = z.object({
    assessmentId: z.uuid(),
    cohortId: z.union([z.uuid(), z.literal('all')]),
    component: z.enum(['assignment', 'presentation', 'rat', 'cat', 'exam']),
  }).safeParse({
    assessmentId: formData.get('assessmentId'),
    cohortId: formData.get('cohortId'),
    component: formData.get('component'),
  });

  if (!parsed.success) return;
  const { assessmentId, cohortId, component } = parsed.data;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: event, error: eventError } = await admin
    .from('assessment_events')
    .select('id, department_id, status, exam_marks_finalized_at')
    .eq('id', assessmentId)
    .maybeSingle();

  if (eventError || !event || (profile.activeDepartmentId && event.department_id !== profile.activeDepartmentId)) {
    redirect('/assessment/marks?error=not-found');
  }
  if (component !== 'exam' && (event.exam_marks_finalized_at || event.status === 'closed')) {
    redirect(`/assessment/marks/${assessmentId}?error=locked`);
  }

  const resolvedIds = await resolveAssessmentIdsWithSiblings(supabase, assessmentId);
  const targetEventIds = resolvedIds.length > 0 ? resolvedIds : [assessmentId];
  const now = new Date().toISOString();

  // Remove per-cohort and global component submission lock rows across target + sibling events.
  let deleteSubmissionsQuery = admin
    .from('assessment_mark_component_submissions')
    .delete()
    .in('assessment_id', targetEventIds)
    .eq('component_key', component);
  if (cohortId !== 'all') {
    deleteSubmissionsQuery = deleteSubmissionsQuery.or(`cohort_id.eq.${cohortId},cohort_id.is.null`);
  }
  const { error: deleteSubmissionsError } = await deleteSubmissionsQuery;
  if (deleteSubmissionsError) {
    console.error('unlockAssessmentMarkComponentAction delete failed:', deleteSubmissionsError);
    const detail = deleteSubmissionsError.message
      ? `&detail=${encodeURIComponent(deleteSubmissionsError.message)}`
      : '';
    redirect(`/assessment/marks/${assessmentId}?error=component-unlock${detail}`);
  }

  if (component === 'cat') {
    const { error: eventUpdateError } = await admin
      .from('assessment_events')
      .update({
        cat_marks_finalized_at: null,
        marks_submitted_at: null,
        updated_at: now,
      })
      .in('id', targetEventIds);
    if (eventUpdateError) {
      console.error('unlockAssessmentMarkComponentAction cat event update failed:', eventUpdateError);
      const detail = eventUpdateError.message
        ? `&detail=${encodeURIComponent(eventUpdateError.message)}`
        : '';
      redirect(`/assessment/marks/${assessmentId}?error=component-unlock${detail}`);
    }
  } else if (component === 'exam') {
    const { error: eventUpdateError } = await admin
      .from('assessment_events')
      .update({
        exam_marks_finalized_at: null,
        finalised_at: null,
        marks_submitted_at: null,
        status: 'open',
        operational_workflow_status: 'open',
        updated_at: now,
      })
      .in('id', targetEventIds);
    if (eventUpdateError) {
      console.error('unlockAssessmentMarkComponentAction exam event update failed:', eventUpdateError);
      const detail = eventUpdateError.message
        ? `&detail=${encodeURIComponent(eventUpdateError.message)}`
        : '';
      redirect(`/assessment/marks/${assessmentId}?error=component-unlock${detail}`);
    }

    let rosterQuery = admin
      .from('assessment_roster')
      .update({ pre_assessment_status: 'expected' })
      .in('assessment_id', targetEventIds)
      .eq('pre_assessment_status', 'absent');
    if (cohortId !== 'all') {
      rosterQuery = rosterQuery.eq('cohort_id', cohortId);
    }
    await rosterQuery;

    await admin
      .from('assessment_population')
      .update({ attendance_status: 'present' })
      .in('assessment_event_id', targetEventIds)
      .eq('attendance_status', 'absent');
  }

  revalidatePath('/assessment');
  revalidatePath('/assessment/analysis');
  revalidatePath('/assessment/reports');
  revalidatePath('/assessment/marks');
  revalidatePath(`/assessment/marks/${assessmentId}`);
  redirect(`/assessment/marks/${assessmentId}?component_unlocked=${component}`);
}

/**
 * HOD "submit on behalf": submits a trainer's saved CAT drafts when the trainer
 * forgot to press Submit. Mirrors the trainer submit route exactly — unentered
 * CAT marks are recorded as AB — and runs through the same RLS-guarded RPC, so
 * `submitted_by` records the HOD who performed the submission.
 */
export async function submitCatOnBehalfAction(formData: FormData) {
  const profile = await requireHodAccess();
  const parsed = z.object({ assessmentId: z.uuid() }).safeParse({ assessmentId: formData.get('assessmentId') });
  if (!parsed.success) return;
  const { assessmentId } = parsed.data;

  const assessment = await getAssessmentById(assessmentId);
  if (!assessment) redirect('/assessment/marks?error=not-found');
  if (assessment.exam_marks_finalized_at || assessment.status === 'closed') {
    redirect(`/assessment/marks/${assessmentId}?error=locked`);
  }

  const supabase = await createClient();
  const resolvedIds = await resolveAssessmentIdsWithSiblings(supabase, assessmentId);
  const targetEventIds = resolvedIds.length > 0 ? resolvedIds : [assessmentId];

  const [eventRes, rosterRes, popRes, draftRes, subRes] = await Promise.all([
    supabase.from('assessment_events').select('department_id, unit_id, academic_period_id').eq('id', assessmentId).maybeSingle(),
    supabase.from('assessment_roster').select('assessment_id, student_id').in('assessment_id', targetEventIds),
    supabase
      .from('assessment_population')
      .select('assessment_event_id, student_id')
      .in('assessment_event_id', targetEventIds)
      .eq('population_status', 'expected'),
    supabase.from('assessment_online_mark_drafts').select('student_id, cat_mark').in('assessment_id', targetEventIds),
    supabase.from('assessment_mark_component_submissions').select('id').in('assessment_id', targetEventIds).eq('component_key', 'cat').limit(1),
  ]);

  // Tenant isolation: only markbooks in the HOD's active department.
  if (!eventRes.data || (profile.activeDepartmentId && eventRes.data.department_id !== profile.activeDepartmentId)) {
    redirect(`/assessment/marks/${assessmentId}?error=not-found`);
  }
  if ((subRes.data ?? []).length > 0) redirect(`/assessment/marks/${assessmentId}?error=cat-already-submitted`);

  const roster = rosterRes.data ?? [];
  const catByStudent = new Map<string, number | null>();
  for (const d of draftRes.data ?? []) {
    if (d.student_id && d.cat_mark !== null) catByStudent.set(d.student_id, d.cat_mark);
  }
  if (catByStudent.size === 0) redirect(`/assessment/marks/${assessmentId}?error=no-saved-cat`);

  // The component RPC owns sibling propagation. Submit the selected/root event
  // once so the RPC can atomically record the HOD as submitted_by and sync all
  // shared/equivalent sibling events. Calling it once per sibling caused the
  // later calls to re-submit an already-finalized sibling and surface the
  // generic "could not be submitted on behalf" error.
  const rootRoster = roster.filter((r) => r.assessment_id === assessmentId);
  const effectiveRoster = rootRoster.length > 0 ? rootRoster : roster;
  const studentIds = new Set(effectiveRoster.map((r) => r.student_id).filter(Boolean));
  for (const p of popRes.data ?? []) {
    if (p.student_id) studentIds.add(p.student_id);
  }
  const admin = createAdminClient();
  if (eventRes.data.unit_id && eventRes.data.academic_period_id) {
    const unifiedRoster = await getUnifiedUnitRoster({
      supabase: admin,
      unitId: eventRes.data.unit_id,
      academicPeriodId: eventRes.data.academic_period_id,
    });
    for (const candidate of unifiedRoster.students) {
      studentIds.add(candidate.studentId);
    }
  }
  if (studentIds.size === 0) redirect(`/assessment/marks/${assessmentId}?error=no-saved-cat`);

  // Filter to active in-class students (matching save_assessment_online_component_marks)
  // and ensure all of them exist in assessment_roster for the root event.
  const { data: candidateStudents } = await admin
    .from('students')
    .select('id, current_cohort_id, admission_cohort_id, lifecycle_status, academic_phase')
    .in('id', Array.from(studentIds));

  const activeStudents = (candidateStudents ?? []).filter(
    (s) =>
      ['admitted', 'active'].includes((s.lifecycle_status ?? '').toLowerCase()) &&
      (s.academic_phase ?? 'in_class').toLowerCase() === 'in_class',
  );
  if (activeStudents.length === 0) redirect(`/assessment/marks/${assessmentId}?error=no-saved-cat`);

  const existingRosterIds = new Set(rootRoster.map((r) => r.student_id));
  const missingRosterStudents = activeStudents.filter((s) => !existingRosterIds.has(s.id));
  if (missingRosterStudents.length > 0 && eventRes.data.unit_id && eventRes.data.academic_period_id) {
    const toInsert = missingRosterStudents.map((s) => ({
      assessment_id: assessmentId,
      student_id: s.id,
      cohort_id: s.current_cohort_id ?? s.admission_cohort_id,
      academic_period_id: eventRes.data.academic_period_id,
      unit_id: eventRes.data.unit_id,
      pre_assessment_status: 'expected',
    }));
    await admin
      .from('assessment_roster')
      .upsert(toInsert, { onConflict: 'assessment_id,student_id', ignoreDuplicates: true });
  }

  const entries = activeStudents.map((s) => {
    const cat = catByStudent.get(s.id) ?? null;
    return { student_id: s.id, cat, cat_absent: cat === null };
  });

  const { error } = await supabase.rpc('save_assessment_online_component_marks', {
    target_assessment_id: assessmentId,
    target_component: 'cat',
    target_entries: entries,
    submit_component: true,
  });
  if (error) {
    console.error('submitCatOnBehalfAction RPC failed:', error);
    const detail = error.message ? `&detail=${encodeURIComponent(error.message)}` : '';
    redirect(`/assessment/marks/${assessmentId}?error=cat-submit-on-behalf${detail}`);
  }

  revalidatePath('/assessment');
  revalidatePath('/assessment/marks');
  revalidatePath(`/assessment/marks/${assessmentId}`);
  redirect(`/assessment/marks/${assessmentId}?cat_submitted_on_behalf=1`);
}

const hodCandidateMarkSchema = z.object({
  assessmentId: z.uuid(),
  studentId: z.uuid(),
  component: z.enum(['cat', 'all']),
  assignment: z.number().min(0).max(5).nullable().optional(),
  presentation: z.number().min(0).max(10).nullable().optional(),
  rat: z.number().min(0).max(15).nullable().optional(),
  cat: z.number().min(0).max(15).nullable().optional(),
  catAbsent: z.boolean().optional(),
  exam: z.number().min(0).max(70).nullable().optional(),
});

export type UpdateHodCandidateMarksInput = z.infer<typeof hodCandidateMarkSchema>;

/**
 * Allows an HOD to enter or update marks for an individual candidate (such as a
 * reassigned/skipped student) directly from the markbook before finalization.
 */
export async function updateHodCandidateMarksAction(
  input: UpdateHodCandidateMarksInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const profile = await requireHodAccess();
  const parsed = hodCandidateMarkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || 'Invalid mark values.' };
  }

  const { assessmentId, studentId, component, assignment, presentation, rat, cat, catAbsent, exam } = parsed.data;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('assessment_events')
    .select('id, department_id, unit_id, academic_period_id, status, exam_marks_finalized_at')
    .eq('id', assessmentId)
    .maybeSingle();

  if (!event || (profile.activeDepartmentId && event.department_id !== profile.activeDepartmentId)) {
    return { ok: false, message: 'Assessment markbook was not found in your active department.' };
  }
  if (event.exam_marks_finalized_at || event.status === 'closed') {
    return { ok: false, message: 'Finalized markbooks cannot be edited.' };
  }

  const resolvedIds = await resolveAssessmentIdsWithSiblings(supabase, assessmentId);
  const targetEventIds = resolvedIds.length > 0 ? resolvedIds : [assessmentId];
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const [{ data: student, error: studentError }, { data: existingRosterRows }, { data: existingDrafts }, { data: existingResults }] =
    await Promise.all([
      admin
        .from('students')
        .select('id, current_cohort_id, admission_cohort_id')
        .eq('id', studentId)
        .maybeSingle(),
      admin
        .from('assessment_roster')
        .select('assessment_id, cohort_id, pre_assessment_status')
        .in('assessment_id', targetEventIds)
        .eq('student_id', studentId),
      admin
        .from('assessment_online_mark_drafts')
        .select('assessment_id, cohort_id, assignment_mark, presentation_mark, rat_mark, cat_mark, exam_mark, updated_at')
        .in('assessment_id', targetEventIds)
        .eq('student_id', studentId)
        .order('updated_at', { ascending: false }),
      admin
        .from('assessment_results')
        .select('id, assessment_event_id, component_marks')
        .in('assessment_event_id', targetEventIds)
        .eq('student_id', studentId),
    ]);

  if (studentError || !student) {
    return { ok: false, message: 'Student record was not found.' };
  }

  const primaryRoster = (existingRosterRows ?? []).find((r) => r.assessment_id === assessmentId);
  const resolvedCohortId =
    primaryRoster?.cohort_id ??
    (existingRosterRows ?? [])[0]?.cohort_id ??
    student.current_cohort_id ??
    student.admission_cohort_id ??
    null;

  if (!primaryRoster && event.unit_id && event.academic_period_id) {
    const { error: rosterInsertError } = await admin
      .from('assessment_roster')
      .upsert(
        {
          assessment_id: assessmentId,
          student_id: studentId,
          cohort_id: resolvedCohortId,
          academic_period_id: event.academic_period_id,
          unit_id: event.unit_id,
          pre_assessment_status: 'expected',
          cat_absent: Boolean(catAbsent),
        },
        { onConflict: 'assessment_id,student_id' },
      );
    if (rosterInsertError) {
      return { ok: false, message: rosterInsertError.message || 'Unable to register student on the assessment roster.' };
    }
  }

  // Keep CAT absence synchronized across target and sibling assessment roster rows.
  const { error: rosterUpdateError } = await admin
    .from('assessment_roster')
    .update({ cat_absent: Boolean(catAbsent) })
    .in('assessment_id', targetEventIds)
    .eq('student_id', studentId);
  if (rosterUpdateError) {
    return { ok: false, message: rosterUpdateError.message || 'Unable to update CAT attendance status.' };
  }

  const primaryDraft =
    (existingDrafts ?? []).find((d) => d.assessment_id === assessmentId) ?? (existingDrafts ?? [])[0] ?? null;

  const nextCat = catAbsent ? null : (cat ?? null);
  const nextAssignment = component === 'all' ? (assignment ?? null) : (primaryDraft?.assignment_mark ?? null);
  const nextPresentation = component === 'all' ? (presentation ?? null) : (primaryDraft?.presentation_mark ?? null);
  const nextRat = component === 'all' ? (rat ?? null) : (primaryDraft?.rat_mark ?? null);
  const nextExam = component === 'all' ? (exam ?? null) : (primaryDraft?.exam_mark ?? null);

  const { error: draftUpsertError } = await admin
    .from('assessment_online_mark_drafts')
    .upsert(
      {
        assessment_id: assessmentId,
        student_id: studentId,
        cohort_id: resolvedCohortId,
        assignment_mark: nextAssignment,
        presentation_mark: nextPresentation,
        rat_mark: nextRat,
        cat_mark: nextCat,
        exam_mark: nextExam,
        updated_by: profile.id,
        updated_at: now,
      },
      { onConflict: 'assessment_id,student_id' },
    );
  if (draftUpsertError) {
    return { ok: false, message: draftUpsertError.message || 'Unable to save candidate marks.' };
  }

  // Keep any existing sibling draft rows in sync so sibling reads never pick stale values.
  const siblingDraftIds = (existingDrafts ?? [])
    .map((d) => d.assessment_id)
    .filter((id): id is string => Boolean(id) && id !== assessmentId);
  if (siblingDraftIds.length > 0) {
    const siblingDraftUpdate =
      component === 'cat'
        ? { cat_mark: nextCat, updated_by: profile.id, updated_at: now }
        : {
            assignment_mark: nextAssignment,
            presentation_mark: nextPresentation,
            rat_mark: nextRat,
            cat_mark: nextCat,
            exam_mark: nextExam,
            updated_by: profile.id,
            updated_at: now,
          };
    const { error: siblingDraftError } = await admin
      .from('assessment_online_mark_drafts')
      .update(siblingDraftUpdate)
      .in('assessment_id', siblingDraftIds)
      .eq('student_id', studentId);
    if (siblingDraftError) {
      return { ok: false, message: siblingDraftError.message || 'Unable to sync sibling candidate marks.' };
    }
  }

  // If pre-finalization official result rows already exist for this student, update their component_marks too.
  for (const existingResult of existingResults ?? []) {
    const currentCm =
      existingResult.component_marks &&
      typeof existingResult.component_marks === 'object' &&
      !Array.isArray(existingResult.component_marks)
        ? { ...(existingResult.component_marks as Record<string, unknown>) }
        : {};
    currentCm.cat = nextCat;
    currentCm.cat1 = nextCat;
    if (component === 'all') {
      currentCm.assignment = nextAssignment;
      currentCm.presentation = nextPresentation;
      currentCm.rat = nextRat;
      currentCm.exam = nextExam;
    }
    const { error: resultUpdateError } = await admin
      .from('assessment_results')
      .update({ component_marks: currentCm, updated_at: now })
      .eq('id', existingResult.id);
    if (resultUpdateError) {
      return { ok: false, message: resultUpdateError.message || 'Unable to update candidate result record.' };
    }
  }

  revalidatePath('/assessment');
  revalidatePath('/assessment/analysis');
  revalidatePath('/assessment/reports');
  revalidatePath('/assessment/marks');
  revalidatePath(`/assessment/marks/${assessmentId}`);
  return { ok: true };
}

const hodBulkCandidateEntrySchema = z.object({
  studentId: z.uuid(),
  assignment: z.number().min(0).max(5).nullable().optional(),
  presentation: z.number().min(0).max(10).nullable().optional(),
  rat: z.number().min(0).max(15).nullable().optional(),
  cat: z.number().min(0).max(15).nullable().optional(),
  catAbsent: z.boolean().optional(),
  exam: z.number().min(0).max(70).nullable().optional(),
});

const hodBulkCandidateMarksSchema = z.object({
  assessmentId: z.uuid(),
  component: z.enum(['cat', 'all']),
  entries: z.array(hodBulkCandidateEntrySchema).min(1, 'No mark changes to save.').max(1000),
});

export type BulkUpdateHodCandidateMarksInput = z.infer<typeof hodBulkCandidateMarksSchema>;

function chunkArray<T>(items: T[], size = 150): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Allows an HOD or system administrator to bulk-enter or update marks for
 * multiple candidates at once (e.g., on behalf of a trainer with technology
 * access challenges) directly from the markbook before finalization.
 */
export async function bulkUpdateHodCandidateMarksAction(
  input: BulkUpdateHodCandidateMarksInput,
): Promise<{ ok: true; savedCount: number } | { ok: false; message: string }> {
  const profile = await requireHodAccess();
  const parsed = hodBulkCandidateMarksSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || 'Invalid mark values.' };
  }

  const { assessmentId, component } = parsed.data;
  // Deduplicate by studentId (last entry wins)
  const entryByStudent = new Map<string, (typeof parsed.data.entries)[number]>();
  for (const entry of parsed.data.entries) {
    entryByStudent.set(entry.studentId, entry);
  }
  const entries = Array.from(entryByStudent.values());
  const studentIds = entries.map((e) => e.studentId);

  const supabase = await createClient();
  const { data: event } = await supabase
    .from('assessment_events')
    .select('id, department_id, unit_id, academic_period_id, status, exam_marks_finalized_at')
    .eq('id', assessmentId)
    .maybeSingle();

  if (!event || (profile.activeDepartmentId && event.department_id !== profile.activeDepartmentId)) {
    return { ok: false, message: 'Assessment markbook was not found in your active department.' };
  }
  if (event.exam_marks_finalized_at || event.status === 'closed') {
    return { ok: false, message: 'Finalized markbooks cannot be edited.' };
  }

  const resolvedIds = await resolveAssessmentIdsWithSiblings(supabase, assessmentId);
  const targetEventIds = resolvedIds.length > 0 ? resolvedIds : [assessmentId];
  const admin = createAdminClient();
  const now = new Date().toISOString();

  type StudentCohortRow = { id: string; current_cohort_id: string | null; admission_cohort_id: string | null };
  type RosterRow = { assessment_id: string; student_id: string; cohort_id: string | null };
  type DraftRow = {
    assessment_id: string;
    student_id: string;
    cohort_id: string | null;
    assignment_mark: number | null;
    presentation_mark: number | null;
    rat_mark: number | null;
    cat_mark: number | null;
    exam_mark: number | null;
    updated_at: string | null;
  };
  type ResultRow = {
    id: string;
    assessment_event_id: string;
    student_id: string;
    component_marks: unknown;
  };

  const studentsList: StudentCohortRow[] = [];
  const rosterList: RosterRow[] = [];
  const draftList: DraftRow[] = [];
  const resultList: ResultRow[] = [];

  for (const idBatch of chunkArray(studentIds)) {
    const [studentsRes, rosterRes, draftsRes, resultsRes] = await Promise.all([
      admin
        .from('students')
        .select('id, current_cohort_id, admission_cohort_id')
        .in('id', idBatch),
      admin
        .from('assessment_roster')
        .select('assessment_id, student_id, cohort_id')
        .in('assessment_id', targetEventIds)
        .in('student_id', idBatch),
      admin
        .from('assessment_online_mark_drafts')
        .select('assessment_id, student_id, cohort_id, assignment_mark, presentation_mark, rat_mark, cat_mark, exam_mark, updated_at')
        .in('assessment_id', targetEventIds)
        .in('student_id', idBatch)
        .order('updated_at', { ascending: false }),
      admin
        .from('assessment_results')
        .select('id, assessment_event_id, student_id, component_marks')
        .in('assessment_event_id', targetEventIds)
        .in('student_id', idBatch),
    ]);

    if (studentsRes.error) {
      return { ok: false, message: studentsRes.error.message || 'Unable to load student records.' };
    }
    if (rosterRes.error) {
      return { ok: false, message: rosterRes.error.message || 'Unable to load assessment roster.' };
    }
    if (draftsRes.error) {
      return { ok: false, message: draftsRes.error.message || 'Unable to load existing mark drafts.' };
    }
    if (resultsRes.error) {
      return { ok: false, message: resultsRes.error.message || 'Unable to load existing result records.' };
    }

    studentsList.push(...(studentsRes.data ?? []));
    rosterList.push(...(rosterRes.data ?? []));
    draftList.push(...(draftsRes.data ?? []));
    resultList.push(...(resultsRes.data ?? []));
  }

  const studentById = new Map(studentsList.map((s) => [s.id, s]));
  const primaryRosterByStudent = new Map<string, RosterRow>();
  const anyRosterByStudent = new Map<string, RosterRow>();
  for (const r of rosterList) {
    if (!anyRosterByStudent.has(r.student_id)) {
      anyRosterByStudent.set(r.student_id, r);
    }
    if (r.assessment_id === assessmentId) {
      primaryRosterByStudent.set(r.student_id, r);
    }
  }

  const primaryDraftByStudent = new Map<string, DraftRow>();
  const latestDraftByStudent = new Map<string, DraftRow>();
  const siblingDraftsByStudent = new Map<string, DraftRow[]>();
  for (const d of draftList) {
    if (!latestDraftByStudent.has(d.student_id)) {
      latestDraftByStudent.set(d.student_id, d);
    }
    if (d.assessment_id === assessmentId) {
      primaryDraftByStudent.set(d.student_id, d);
    } else {
      const list = siblingDraftsByStudent.get(d.student_id) ?? [];
      list.push(d);
      siblingDraftsByStudent.set(d.student_id, list);
    }
  }

  const missingRosterRows: Array<{
    assessment_id: string;
    student_id: string;
    cohort_id: string | null;
    academic_period_id: string;
    unit_id: string;
    pre_assessment_status: string;
    cat_absent: boolean;
  }> = [];

  const absentTrueIds: string[] = [];
  const absentFalseIds: string[] = [];

  const primaryDraftUpserts: Array<{
    assessment_id: string;
    student_id: string;
    cohort_id: string | null;
    assignment_mark: number | null;
    presentation_mark: number | null;
    rat_mark: number | null;
    cat_mark: number | null;
    exam_mark: number | null;
    updated_by: string;
    updated_at: string;
  }> = [];

  const siblingDraftUpserts: Array<{
    assessment_id: string;
    student_id: string;
    cohort_id: string | null;
    assignment_mark: number | null;
    presentation_mark: number | null;
    rat_mark: number | null;
    cat_mark: number | null;
    exam_mark: number | null;
    updated_by: string;
    updated_at: string;
  }> = [];

  const resolvedMarksByStudent = new Map<
    string,
    {
      assignment: number | null;
      presentation: number | null;
      rat: number | null;
      cat: number | null;
      exam: number | null;
    }
  >();

  for (const entry of entries) {
    const student = studentById.get(entry.studentId);
    if (!student) continue;

    const primaryRoster = primaryRosterByStudent.get(entry.studentId);
    const resolvedCohortId =
      primaryRoster?.cohort_id ??
      anyRosterByStudent.get(entry.studentId)?.cohort_id ??
      student.current_cohort_id ??
      student.admission_cohort_id ??
      null;

    const isCatAbsent = Boolean(entry.catAbsent);
    if (isCatAbsent) {
      absentTrueIds.push(entry.studentId);
    } else {
      absentFalseIds.push(entry.studentId);
    }

    if (!primaryRoster && event.unit_id && event.academic_period_id) {
      missingRosterRows.push({
        assessment_id: assessmentId,
        student_id: entry.studentId,
        cohort_id: resolvedCohortId,
        academic_period_id: event.academic_period_id,
        unit_id: event.unit_id,
        pre_assessment_status: 'expected',
        cat_absent: isCatAbsent,
      });
    }

    const baseDraft = primaryDraftByStudent.get(entry.studentId) ?? latestDraftByStudent.get(entry.studentId) ?? null;
    const nextCat = isCatAbsent ? null : (entry.cat ?? null);
    const nextAssignment = component === 'all' ? (entry.assignment ?? null) : (baseDraft?.assignment_mark ?? null);
    const nextPresentation = component === 'all' ? (entry.presentation ?? null) : (baseDraft?.presentation_mark ?? null);
    const nextRat = component === 'all' ? (entry.rat ?? null) : (baseDraft?.rat_mark ?? null);
    const nextExam = component === 'all' ? (entry.exam ?? null) : (baseDraft?.exam_mark ?? null);

    resolvedMarksByStudent.set(entry.studentId, {
      assignment: nextAssignment,
      presentation: nextPresentation,
      rat: nextRat,
      cat: nextCat,
      exam: nextExam,
    });

    primaryDraftUpserts.push({
      assessment_id: assessmentId,
      student_id: entry.studentId,
      cohort_id: resolvedCohortId,
      assignment_mark: nextAssignment,
      presentation_mark: nextPresentation,
      rat_mark: nextRat,
      cat_mark: nextCat,
      exam_mark: nextExam,
      updated_by: profile.id,
      updated_at: now,
    });

    for (const sibDraft of siblingDraftsByStudent.get(entry.studentId) ?? []) {
      siblingDraftUpserts.push({
        assessment_id: sibDraft.assessment_id,
        student_id: entry.studentId,
        cohort_id: sibDraft.cohort_id ?? resolvedCohortId,
        assignment_mark: component === 'all' ? nextAssignment : sibDraft.assignment_mark,
        presentation_mark: component === 'all' ? nextPresentation : sibDraft.presentation_mark,
        rat_mark: component === 'all' ? nextRat : sibDraft.rat_mark,
        cat_mark: nextCat,
        exam_mark: component === 'all' ? nextExam : sibDraft.exam_mark,
        updated_by: profile.id,
        updated_at: now,
      });
    }
  }

  if (primaryDraftUpserts.length === 0) {
    return { ok: false, message: 'No matching student records were found to save.' };
  }

  if (missingRosterRows.length > 0) {
    for (const batch of chunkArray(missingRosterRows)) {
      const { error } = await admin
        .from('assessment_roster')
        .upsert(batch, { onConflict: 'assessment_id,student_id' });
      if (error) {
        return { ok: false, message: error.message || 'Unable to register students on the assessment roster.' };
      }
    }
  }

  for (const idBatch of chunkArray(absentTrueIds)) {
    const { error } = await admin
      .from('assessment_roster')
      .update({ cat_absent: true })
      .in('assessment_id', targetEventIds)
      .in('student_id', idBatch);
    if (error) {
      return { ok: false, message: error.message || 'Unable to update CAT absent statuses.' };
    }
  }

  for (const idBatch of chunkArray(absentFalseIds)) {
    const { error } = await admin
      .from('assessment_roster')
      .update({ cat_absent: false })
      .in('assessment_id', targetEventIds)
      .in('student_id', idBatch);
    if (error) {
      return { ok: false, message: error.message || 'Unable to clear CAT absent statuses.' };
    }
  }

  for (const batch of chunkArray(primaryDraftUpserts)) {
    const { error } = await admin
      .from('assessment_online_mark_drafts')
      .upsert(batch, { onConflict: 'assessment_id,student_id' });
    if (error) {
      return { ok: false, message: error.message || 'Unable to save candidate marks.' };
    }
  }

  if (siblingDraftUpserts.length > 0) {
    for (const batch of chunkArray(siblingDraftUpserts)) {
      const { error } = await admin
        .from('assessment_online_mark_drafts')
        .upsert(batch, { onConflict: 'assessment_id,student_id' });
      if (error) {
        return { ok: false, message: error.message || 'Unable to sync sibling candidate marks.' };
      }
    }
  }

  for (const existingResult of resultList) {
    const resolved = resolvedMarksByStudent.get(existingResult.student_id);
    if (!resolved) continue;
    const currentCm =
      existingResult.component_marks &&
      typeof existingResult.component_marks === 'object' &&
      !Array.isArray(existingResult.component_marks)
        ? { ...(existingResult.component_marks as Record<string, unknown>) }
        : {};
    currentCm.cat = resolved.cat;
    currentCm.cat1 = resolved.cat;
    if (component === 'all') {
      currentCm.assignment = resolved.assignment;
      currentCm.presentation = resolved.presentation;
      currentCm.rat = resolved.rat;
      currentCm.exam = resolved.exam;
    }
    const { error } = await admin
      .from('assessment_results')
      .update({ component_marks: currentCm, updated_at: now })
      .eq('id', existingResult.id);
    if (error) {
      return { ok: false, message: error.message || 'Unable to update candidate result records.' };
    }
  }

  revalidatePath('/assessment');
  revalidatePath('/assessment/analysis');
  revalidatePath('/assessment/reports');
  revalidatePath('/assessment/marks');
  revalidatePath(`/assessment/marks/${assessmentId}`);
  return { ok: true, savedCount: primaryDraftUpserts.length };
}

/**
 * Toggles whether an assessment markbook (e.g. non-exam unit like Trade Project
 * or testing data) is excluded from CAT & Exam analysis and period reports.
 */
export async function toggleAssessmentExcludeFromAnalysisAction(formData: FormData) {
  const profile = await requireHodAccess();
  const parsed = z
    .object({
      assessmentId: z.uuid(),
      exclude: z.enum(['true', 'false']),
    })
    .safeParse({
      assessmentId: formData.get('assessmentId'),
      exclude: formData.get('exclude'),
    });
  if (!parsed.success) return;

  const { assessmentId, exclude } = parsed.data;
  const admin = createAdminClient();
  const { data: event } = await admin
    .from('assessment_events')
    .select('id, department_id')
    .eq('id', assessmentId)
    .maybeSingle();

  if (!event || (profile.activeDepartmentId && event.department_id !== profile.activeDepartmentId)) {
    redirect(`/assessment/marks/${assessmentId}?error=not-found`);
  }

  // Sync exclude_from_analysis across all shared/equivalent sibling markbooks in this department
  const siblingIds = await resolveAssessmentIdsWithSiblings(admin, assessmentId);
  const candidateIds = siblingIds.length > 0 ? siblingIds : [assessmentId];
  const { data: deptEvents } = await admin
    .from('assessment_events')
    .select('id')
    .in('id', candidateIds)
    .eq('department_id', event.department_id);
  const targetIds = (deptEvents ?? []).map((row) => row.id);
  const idsToUpdate = targetIds.length > 0 ? targetIds : [assessmentId];

  const { error } = await admin
    .from('assessment_events')
    .update({ exclude_from_analysis: exclude === 'true' })
    .in('id', idsToUpdate);

  if (error) {
    redirect(`/assessment/marks/${assessmentId}?error=exclude-update-failed`);
  }

  revalidatePath('/assessment');
  revalidatePath('/assessment/analysis');
  revalidatePath('/assessment/missing-marks');
  revalidatePath('/assessment/reports');
  revalidatePath('/assessment/marks');
  for (const id of idsToUpdate) {
    revalidatePath(`/assessment/marks/${id}`);
  }
  redirect(`/assessment/marks/${assessmentId}`);
}
