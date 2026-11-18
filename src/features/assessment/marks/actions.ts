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
  await requireHodAccess();
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
  const assessment = await getAssessmentById(assessmentId);
  if (!assessment) redirect('/assessment/marks?error=not-found');

  const supabase = await createClient();
  const resolvedIds = await resolveAssessmentIdsWithSiblings(supabase, assessmentId);
  const targetEventIds = resolvedIds.length > 0 ? resolvedIds : [assessmentId];

  const admin = createAdminClient();

  for (const targetId of targetEventIds) {
    const { error } = await supabase.rpc('unlock_assessment_mark_component_submission', {
      target_assessment_id: targetId,
      target_cohort_id: cohortId === 'all' ? null : cohortId,
      target_component_key: component,
    });
    if (error) {
      redirect(`/assessment/marks/${assessmentId}?error=component-unlock`);
    }

    if (component === 'cat') {
      await admin
        .from('assessment_events')
        .update({
          cat_marks_finalized_at: null,
          marks_submitted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetId);
    } else if (component === 'exam') {
      await admin
        .from('assessment_events')
        .update({
          exam_marks_finalized_at: null,
          finalised_at: null,
          marks_submitted_at: null,
          status: 'open',
          operational_workflow_status: 'open',
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetId);

      let rosterQuery = admin
        .from('assessment_roster')
        .update({ pre_assessment_status: 'expected' })
        .eq('assessment_id', targetId)
        .eq('pre_assessment_status', 'absent');
      if (cohortId !== 'all') {
        rosterQuery = rosterQuery.eq('cohort_id', cohortId);
      }
      await rosterQuery;

      await admin
        .from('assessment_population')
        .update({ attendance_status: 'present' })
        .eq('assessment_event_id', targetId)
        .eq('attendance_status', 'absent');
    }
  }

  revalidatePath('/assessment');
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
    .select('id, department_id, status, exam_marks_finalized_at')
    .eq('id', assessmentId)
    .maybeSingle();

  if (!event || (profile.activeDepartmentId && event.department_id !== profile.activeDepartmentId)) {
    return { ok: false, message: 'Assessment markbook was not found in your active department.' };
  }
  if (event.exam_marks_finalized_at || event.status === 'closed') {
    return { ok: false, message: 'Finalized markbooks cannot be edited.' };
  }

  const entry =
    component === 'cat'
      ? { student_id: studentId, cat: catAbsent ? null : (cat ?? null), cat_absent: Boolean(catAbsent) }
      : {
          student_id: studentId,
          assignment: assignment ?? null,
          presentation: presentation ?? null,
          rat: rat ?? null,
          cat: catAbsent ? null : (cat ?? null),
          cat_absent: Boolean(catAbsent),
          exam: exam ?? null,
        };

  const { error } = await supabase.rpc('save_assessment_online_component_marks', {
    target_assessment_id: assessmentId,
    target_component: component,
    target_entries: [entry],
    submit_component: false,
  });

  if (error) {
    return { ok: false, message: error.message || 'Unable to save candidate marks.' };
  }

  revalidatePath('/assessment');
  revalidatePath('/assessment/marks');
  revalidatePath(`/assessment/marks/${assessmentId}`);
  return { ok: true };
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
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('assessment_events')
    .select('id, department_id')
    .eq('id', assessmentId)
    .maybeSingle();

  if (!event || (profile.activeDepartmentId && event.department_id !== profile.activeDepartmentId)) {
    redirect(`/assessment/marks/${assessmentId}?error=not-found`);
  }

  const { error } = await supabase
    .from('assessment_events')
    .update({ exclude_from_analysis: exclude === 'true' })
    .eq('id', assessmentId);

  if (error) {
    redirect(`/assessment/marks/${assessmentId}?error=exclude-update-failed`);
  }

  revalidatePath('/assessment');
  revalidatePath('/assessment/analysis');
  revalidatePath('/assessment/reports');
  revalidatePath('/assessment/marks');
  revalidatePath(`/assessment/marks/${assessmentId}`);
  redirect(`/assessment/marks/${assessmentId}`);
}
