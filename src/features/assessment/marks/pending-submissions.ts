import { cache } from 'react';

import { getUnifiedUnitRoster } from '@/features/academic-roster/unified-roster';
import { requireHodAccess } from '@/features/auth/authorization';
import { resolveAssessmentIdsWithSiblings } from '@/features/staff-assessment/online-marks-query';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Saved-but-unsubmitted markbook detection for HOD oversight.
 *
 * A markbook is "pending" when a trainer has saved draft marks for a component
 * (CAT or Exam) but no component submission record exists yet. Nothing is ever
 * submitted automatically — the HOD reviews and submits on the trainer's behalf.
 */

export interface MissingStudentInfo {
  studentId: string;
  admissionNumber: string;
  fullName: string;
}

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

const CHUNK_SIZE = 50;

function chunk<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) out.push(items.slice(i, i + CHUNK_SIZE));
  return out;
}

async function fetchAllPaged<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const results: T[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await fetchPage(offset, offset + pageSize - 1);
    if (error) throw new Error(`Unable to load ${label}: ${error.message}`);
    if (!data || data.length === 0) break;
    results.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return results;
}

async function loadDraftState(supabase: SupabaseServerClient, assessmentIds: string[]) {
  const drafts: Array<{ assessment_id: string; student_id: string; cat_mark: number | null; exam_mark: number | null; updated_by: string | null; updated_at: string | null }> = [];
  const roster: Array<{ assessment_id: string; student_id: string; cat_absent: boolean | null; pre_assessment_status: string | null }> = [];
  const submissions: Array<{ assessment_id: string; component_key: string }> = [];

  for (const ids of chunk(assessmentIds)) {
    const [draftRows, rosterRows, popRows, subRows] = await Promise.all([
      fetchAllPaged(
        (from, to) =>
          supabase
            .from('assessment_online_mark_drafts')
            .select('id, assessment_id, student_id, cat_mark, exam_mark, updated_by, updated_at')
            .in('assessment_id', ids)
            .order('id', { ascending: true })
            .range(from, to),
        'saved marks',
      ),
      fetchAllPaged(
        (from, to) =>
          supabase
            .from('assessment_roster')
            .select('id, assessment_id, student_id, cat_absent, pre_assessment_status')
            .in('assessment_id', ids)
            .order('id', { ascending: true })
            .range(from, to),
        'assessment rosters',
      ),
      fetchAllPaged(
        (from, to) =>
          supabase
            .from('assessment_population')
            .select('id, assessment_event_id, student_id, attendance_status')
            .in('assessment_event_id', ids)
            .eq('population_status', 'expected')
            .order('id', { ascending: true })
            .range(from, to),
        'assessment population',
      ),
      fetchAllPaged(
        (from, to) =>
          supabase
            .from('assessment_mark_component_submissions')
            .select('id, assessment_id, component_key')
            .in('assessment_id', ids)
            .order('id', { ascending: true })
            .range(from, to),
        'mark submissions',
      ),
    ]);

    drafts.push(...draftRows);
    submissions.push(...subRows);

    const seen = new Set(rosterRows.map((r) => `${r.assessment_id}:${r.student_id}`));
    roster.push(...rosterRows);
    for (const p of popRows) {
      const key = `${p.assessment_event_id}:${p.student_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        roster.push({
          assessment_id: p.assessment_event_id,
          student_id: p.student_id,
          cat_absent: null,
          pre_assessment_status: p.attendance_status === 'absent' ? 'absent' : null,
        });
      }
    }
  }

  // Exclude non-active or off-class students (e.g., dropped_out, deferred, attachment)
  const rosterStudentIds = [...new Set(roster.map((r) => r.student_id).filter(Boolean))];
  const inactiveStudentIds = new Set<string>();
  for (const ids of chunk(rosterStudentIds)) {
    const { data: studentRows } = await supabase
      .from('students')
      .select('id, lifecycle_status, academic_phase')
      .in('id', ids);
    for (const st of studentRows ?? []) {
      const lifecycle = (st.lifecycle_status ?? '').toLowerCase();
      const phase = (st.academic_phase ?? '').toLowerCase();
      if ((lifecycle && !['admitted', 'active'].includes(lifecycle)) || (phase && phase !== 'in_class')) {
        inactiveStudentIds.add(st.id);
      }
    }
  }

  return {
    drafts,
    roster: inactiveStudentIds.size > 0 ? roster.filter((r) => !inactiveStudentIds.has(r.student_id)) : roster,
    submissions,
  };
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
    .select('id, status, cat_marks_finalized_at, exam_marks_finalized_at, unit:units(code, name), academic_period:academic_periods(name)')
    .eq('department_id', profile.activeDepartmentId)
    .is('exam_marks_finalized_at', null)
    .neq('status', 'closed');
  if (error) throw new Error(`Unable to load markbooks: ${error.message}`);
  if (!events?.length) return [];

  const state = await loadDraftState(supabase, events.map((e) => e.id));
  const { drafts, submissions } = state;

  const submitted = new Set(submissions.map((s) => `${s.assessment_id}:${s.component_key}`));
  for (const event of events) {
    if (event.cat_marks_finalized_at) {
      submitted.add(`${event.id}:cat`);
    }
  }

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
  const resolvedIds = await resolveAssessmentIdsWithSiblings(supabase, assessmentId);
  const targetEventIds = resolvedIds.length > 0 ? resolvedIds : [assessmentId];
  const targetEventSet = new Set(targetEventIds);

  const [state, eventsRes] = await Promise.all([
    loadDraftState(supabase, targetEventIds),
    supabase
      .from('assessment_events')
      .select('id, unit_id, academic_period_id, cat_marks_finalized_at')
      .in('id', targetEventIds),
  ]);

  const anyCatFinalized = (eventsRes.data ?? []).some((e) => Boolean(e.cat_marks_finalized_at));
  const catSubmitted = anyCatFinalized || state.submissions.some((s) => targetEventSet.has(s.assessment_id) && s.component_key === 'cat');

  // Discover all marked candidates across target events
  const relevantDrafts = state.drafts.filter((d) => targetEventSet.has(d.assessment_id) && d.cat_mark !== null);
  const markedStudents = new Set(relevantDrafts.map((d) => d.student_id));

  // Deduplicate roster across siblings
  const rosterByStudent = new Map<string, (typeof state.roster)[number]>();
  for (const r of state.roster) {
    if (targetEventSet.has(r.assessment_id) && r.student_id && !rosterByStudent.has(r.student_id)) {
      rosterByStudent.set(r.student_id, r);
    }
  }

  // Merge authoritative unified roster (includes individual student_class_assignments)
  const rootEvent = (eventsRes.data ?? []).find((e) => e.id === assessmentId) ?? (eventsRes.data ?? [])[0];
  if (rootEvent?.unit_id && rootEvent?.academic_period_id) {
    const admin = createAdminClient();
    const unifiedRoster = await getUnifiedUnitRoster({
      supabase: admin,
      unitId: rootEvent.unit_id,
      academicPeriodId: rootEvent.academic_period_id,
    });
    for (const candidate of unifiedRoster.students) {
      if (!rosterByStudent.has(candidate.studentId)) {
        rosterByStudent.set(candidate.studentId, {
          assessment_id: assessmentId,
          student_id: candidate.studentId,
          cat_absent: false,
          pre_assessment_status: null,
        });
      }
    }
  }

  const rosterRows = Array.from(rosterByStudent.values());
  const missingStudentIds: string[] = [];
  let recorded = 0;

  for (const r of rosterRows) {
    const hasMark = markedStudents.has(r.student_id);
    const isAbsent = Boolean(r.cat_absent);
    if (hasMark || isAbsent) {
      recorded++;
    } else {
      missingStudentIds.push(r.student_id);
    }
  }

  const editorIds = [
    ...new Set(
      relevantDrafts.map((d) => d.updated_by).filter((v): v is string => Boolean(v)),
    ),
  ];

  const [{ data: trainers }, { data: missingStudentData }] = await Promise.all([
    editorIds.length
      ? supabase.from('trainers').select('full_name').in('profile_id', editorIds)
      : Promise.resolve({ data: [] as Array<{ full_name: string }> }),
    missingStudentIds.length > 0
      ? supabase
          .from('students')
          .select('id, admission_number, full_name')
          .in('id', missingStudentIds)
          .order('admission_number')
      : Promise.resolve({ data: [] as Array<{ id: string; admission_number: string; full_name: string }> }),
  ]);

  const missingStudents: MissingStudentInfo[] = (missingStudentData ?? []).map((s) => ({
    studentId: s.id,
    admissionNumber: s.admission_number,
    fullName: s.full_name,
  }));

  const rosterCount = rosterRows.length;
  const missingCount = Math.max(rosterCount - recorded, 0);

  return {
    catSubmitted,
    trainerNames: (trainers ?? []).map((t) => t.full_name),
    rosterCount,
    enteredCount: recorded,
    missingCount,
    missingStudents,
    canSubmitOnBehalf: !catSubmitted && markedStudents.size > 0 && rosterCount > 0,
  };
});
