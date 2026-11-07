import { cache } from 'react';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

/**
 * Saved-but-unsubmitted markbook detection for HOD oversight.
 *
 * A markbook is "pending" when a trainer has saved draft marks for a component
 * (CAT or Exam) but no component submission record exists yet. Nothing is ever
 * submitted automatically — the HOD reviews and submits on the trainer's behalf.
 */

export interface PendingMarkSubmission {
  assessmentId: string;
  unitCode: string;
  unitName: string;
  periodName: string;
  component: 'cat' | 'exam';
  rosterCount: number;
  enteredCount: number;
  missingCount: number;
  trainerNames: string[];
  lastSavedAt: string | null;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const CHUNK_SIZE = 100;

function chunk<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) out.push(items.slice(i, i + CHUNK_SIZE));
  return out;
}

async function loadDraftState(supabase: SupabaseServerClient, assessmentIds: string[]) {
  const drafts: Array<{ assessment_id: string; student_id: string; cat_mark: number | null; exam_mark: number | null; updated_by: string | null; updated_at: string | null }> = [];
  const roster: Array<{ assessment_id: string; student_id: string; cat_absent: boolean | null; pre_assessment_status: string | null }> = [];
  const submissions: Array<{ assessment_id: string; component_key: string }> = [];

  for (const ids of chunk(assessmentIds)) {
    const [draftRes, rosterRes, subRes] = await Promise.all([
      supabase
        .from('assessment_online_mark_drafts')
        .select('assessment_id, student_id, cat_mark, exam_mark, updated_by, updated_at')
        .in('assessment_id', ids),
      supabase.from('assessment_roster').select('assessment_id, student_id, cat_absent, pre_assessment_status').in('assessment_id', ids),
      supabase.from('assessment_mark_component_submissions').select('assessment_id, component_key').in('assessment_id', ids),
    ]);
    if (draftRes.error) throw new Error(`Unable to load saved marks: ${draftRes.error.message}`);
    if (rosterRes.error) throw new Error(`Unable to load assessment rosters: ${rosterRes.error.message}`);
    if (subRes.error) throw new Error(`Unable to load mark submissions: ${subRes.error.message}`);
    drafts.push(...(draftRes.data ?? []));
    roster.push(...(rosterRes.data ?? []));
    submissions.push(...(subRes.data ?? []));
  }

  return { drafts, roster, submissions };
}

type DraftState = Awaited<ReturnType<typeof loadDraftState>>;

/**
 * Counts roster students with a recorded result for a component: either a saved
 * mark, or an explicit AB the trainer has already set (CAT absence / exam absence).
 */
function countRecorded(state: DraftState, assessmentId: string, component: 'cat' | 'exam') {
  const markedStudents = new Set(
    state.drafts
      .filter((d) => d.assessment_id === assessmentId && (component === 'cat' ? d.cat_mark : d.exam_mark) !== null)
      .map((d) => d.student_id),
  );
  const rosterRows = state.roster.filter((r) => r.assessment_id === assessmentId);
  const recorded = rosterRows.filter((r) =>
    markedStudents.has(r.student_id)
    || (component === 'cat' ? Boolean(r.cat_absent) : r.pre_assessment_status === 'absent'),
  ).length;
  return { rosterCount: rosterRows.length, markedCount: markedStudents.size, recorded };
}

/** Lists every markbook in the HOD's active department with saved but unsubmitted CAT/Exam marks. */
export const getPendingMarkSubmissions = cache(async (): Promise<PendingMarkSubmission[]> => {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return [];
  const supabase = await createClient();

  const { data: events, error } = await supabase
    .from('assessment_events')
    .select('id, status, exam_marks_finalized_at, unit:units(code, name), academic_period:academic_periods(name)')
    .eq('department_id', profile.activeDepartmentId)
    .is('exam_marks_finalized_at', null)
    .neq('status', 'closed');
  if (error) throw new Error(`Unable to load markbooks: ${error.message}`);
  if (!events?.length) return [];

  const state = await loadDraftState(supabase, events.map((e) => e.id));
  const { drafts, submissions } = state;

  const submitted = new Set(submissions.map((s) => `${s.assessment_id}:${s.component_key}`));

  const editorIds = new Set(drafts.map((d) => d.updated_by).filter((v): v is string => Boolean(v)));
  const trainerNameByProfile = new Map<string, string>();
  for (const ids of chunk([...editorIds])) {
    const { data: trainers } = await supabase.from('trainers').select('profile_id, full_name').in('profile_id', ids);
    for (const t of trainers ?? []) if (t.profile_id) trainerNameByProfile.set(t.profile_id, t.full_name);
  }

  const pending: PendingMarkSubmission[] = [];
  for (const event of events) {
    const unit = Array.isArray(event.unit) ? event.unit[0] : event.unit;
    const period = Array.isArray(event.academic_period) ? event.academic_period[0] : event.academic_period;
    const eventDrafts = drafts.filter((d) => d.assessment_id === event.id);

    for (const component of ['cat', 'exam'] as const) {
      if (submitted.has(`${event.id}:${component}`)) continue;
      // Exam submission only becomes relevant once CAT has been submitted.
      if (component === 'exam' && !submitted.has(`${event.id}:cat`)) continue;
      const withMark = eventDrafts.filter((d) => (component === 'cat' ? d.cat_mark : d.exam_mark) !== null);
      if (withMark.length === 0) continue;
      const counts = countRecorded(state, event.id, component);

      const names = [...new Set(withMark.map((d) => (d.updated_by ? trainerNameByProfile.get(d.updated_by) : undefined)).filter((v): v is string => Boolean(v)))];
      const lastSavedAt = withMark.map((d) => d.updated_at).filter((v): v is string => Boolean(v)).sort().at(-1) ?? null;

      pending.push({
        assessmentId: event.id,
        unitCode: unit?.code ?? '—',
        unitName: unit?.name ?? 'Unit',
        periodName: period?.name ?? '',
        component,
        rosterCount: counts.rosterCount,
        enteredCount: counts.recorded,
        missingCount: Math.max(counts.rosterCount - counts.recorded, 0),
        trainerNames: names,
        lastSavedAt,
      });
    }
  }

  return pending.sort((a, b) => (b.lastSavedAt ?? '').localeCompare(a.lastSavedAt ?? ''));
});

/** CAT on-behalf status for a single markbook (used on the markbook page). */
export const getCatOnBehalfStatus = cache(async (assessmentId: string) => {
  await requireHodAccess();
  const supabase = await createClient();
  const state = await loadDraftState(supabase, [assessmentId]);
  const catSubmitted = state.submissions.some((s) => s.component_key === 'cat');
  const counts = countRecorded(state, assessmentId, 'cat');
  const editorIds = [...new Set(state.drafts.filter((d) => d.cat_mark !== null).map((d) => d.updated_by).filter((v): v is string => Boolean(v)))];
  const { data: trainers } = editorIds.length
    ? await supabase.from('trainers').select('full_name').in('profile_id', editorIds)
    : { data: [] as Array<{ full_name: string }> };
  return {
    catSubmitted,
    trainerNames: (trainers ?? []).map((t) => t.full_name),
    rosterCount: counts.rosterCount,
    enteredCount: counts.recorded,
    missingCount: Math.max(counts.rosterCount - counts.recorded, 0),
    canSubmitOnBehalf: !catSubmitted && counts.markedCount > 0 && counts.rosterCount > 0,
  };
});
