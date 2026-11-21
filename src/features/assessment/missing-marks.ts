import 'server-only';

import { cache } from 'react';

import { requireHodAccess } from '@/features/auth/authorization';
import { compareAdmissionNumbers } from '@/features/students/admission-number-sort';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type ComponentMarkStatus = 'present' | 'absent' | 'missing';

export interface MissingMarkPeriodOption {
  id: string;
  code: string;
  name: string;
  status: string;
}

export interface MissingMarkRecord {
  key: string;
  assessmentId: string;
  studentId: string;
  admissionNumber: string;
  fullName: string;
  programmeId: string;
  programmeCode: string;
  cohortId: string | null;
  cohortName: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  catStatus: ComponentMarkStatus;
  catMark: number | null;
  catAbsenceReason: string | null;
  examStatus: ComponentMarkStatus;
  examMark: number | null;
  examAbsenceReason: string | null;
  catMarkingStarted: boolean;
  examSubmitted: boolean;
}

export interface MissingMarksPageData {
  departmentName: string;
  periods: MissingMarkPeriodOption[];
  selectedPeriodId: string | null;
  selectedPeriodName: string;
  records: MissingMarkRecord[];
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function extractNumericMark(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isExplicitAb(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const norm = value.trim().toUpperCase();
  return norm === 'AB' || norm === 'ABSENT';
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

async function fetchAllByChunks<T>(
  ids: string[],
  fetchChunk: (chunk: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const results: T[] = [];
  const chunkSize = 200;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const chunkRows = await fetchAllPaged(
      (from, to) => fetchChunk(chunk, from, to),
      label,
    );
    results.push(...chunkRows);
  }

  return results;
}

export const getMissingMarksAndAbsencesData = cache(
  async (requestedPeriodId?: string): Promise<MissingMarksPageData> => {
    const profile = await requireHodAccess();
    if (!profile.activeDepartmentId) {
      return {
        departmentName: profile.departmentName,
        periods: [],
        selectedPeriodId: null,
        selectedPeriodName: '',
        records: [],
      };
    }

    const supabase = await createClient();
    const admin = createAdminClient();
    const departmentId = profile.activeDepartmentId;

    const { data: periodsRaw, error: periodsError } = await supabase
      .from('academic_periods')
      .select('id, code, name, status, starts_on')
      .order('starts_on', { ascending: false });

    if (periodsError) throw new Error(`Unable to load academic periods: ${periodsError.message}`);

    const periods: MissingMarkPeriodOption[] = (periodsRaw ?? []).map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      status: p.status,
    }));

    const selectedPeriod =
      (requestedPeriodId ? periods.find((p) => p.id === requestedPeriodId) : null) ??
      periods.find((p) => p.status === 'active') ??
      periods[0] ??
      null;

    if (!selectedPeriod) {
      return {
        departmentName: profile.departmentName,
        periods,
        selectedPeriodId: null,
        selectedPeriodName: '',
        records: [],
      };
    }

    // 1. Load ONLY units students actually registered for in the selected academic period,
    // scoped to active in-class students in the HOD's active department.
    const registrations = await fetchAllPaged(
      (from, to) =>
        supabase
          .from('student_unit_registrations')
          .select(`
            id,
            student_id,
            unit_id,
            student:students!inner(
              id,
              admission_number,
              full_name,
              department_id,
              lifecycle_status,
              academic_phase,
              programme:programmes(id, code),
              current_cohort:cohorts!students_current_cohort_id_fkey(id, code, name),
              admission_cohort:cohorts!students_admission_cohort_id_fkey(id, code, name)
            ),
            unit:units!inner(id, code, name)
          `)
          .eq('academic_period_id', selectedPeriod.id)
          .eq('registration_status', 'registered')
          .eq('student.department_id', departmentId)
          .in('student.lifecycle_status', ['admitted', 'active'])
          .eq('student.academic_phase', 'in_class')
          .order('id', { ascending: true })
          .range(from, to),
      'student unit registrations',
    );

    if (registrations.length === 0) {
      return {
        departmentName: profile.departmentName,
        periods,
        selectedPeriodId: selectedPeriod.id,
        selectedPeriodName: selectedPeriod.name,
        records: [],
      };
    }

    const registeredUnitIds = [...new Set(registrations.map((r) => r.unit_id).filter(Boolean))];

    // 2. Resolve shared/equivalent sibling units (approved unit equivalences + shared_class_key)
    // so marks entered on a sibling shared-class markbook are accurately matched to the student.
    const [equivMembersRes, sharedOfferingsRes] = await Promise.all([
      admin
        .from('unit_equivalence_members')
        .select('equivalence_group_id, unit_id, group:unit_equivalence_groups!inner(id, status)')
        .eq('status', 'approved')
        .eq('group.status', 'active'),
      admin
        .from('unit_offerings')
        .select('unit_id, shared_class_key')
        .eq('academic_period_id', selectedPeriod.id)
        .not('shared_class_key', 'is', null),
    ]);

    const siblingUnitsByUnit = new Map<string, Set<string>>();
    const linkUnits = (unitGroup: string[]) => {
      const unique = [...new Set(unitGroup.filter(Boolean))];
      if (unique.length < 2) return;
      const merged = new Set<string>(unique);
      for (const u of unique) {
        const existing = siblingUnitsByUnit.get(u);
        if (existing) {
          for (const item of existing) merged.add(item);
        }
      }
      for (const u of merged) {
        siblingUnitsByUnit.set(u, merged);
      }
    };

    const byEquivGroup = new Map<string, string[]>();
    for (const row of equivMembersRes.data ?? []) {
      const list = byEquivGroup.get(row.equivalence_group_id) ?? [];
      list.push(row.unit_id);
      byEquivGroup.set(row.equivalence_group_id, list);
    }
    for (const group of byEquivGroup.values()) linkUnits(group);

    const bySharedKey = new Map<string, string[]>();
    for (const row of sharedOfferingsRes.data ?? []) {
      if (!row.shared_class_key || !row.unit_id) continue;
      const list = bySharedKey.get(row.shared_class_key) ?? [];
      list.push(row.unit_id);
      bySharedKey.set(row.shared_class_key, list);
    }
    for (const group of bySharedKey.values()) linkUnits(group);

    const allRelevantUnitIds = new Set<string>(registeredUnitIds);
    for (const uid of registeredUnitIds) {
      const siblings = siblingUnitsByUnit.get(uid);
      if (siblings) {
        for (const s of siblings) allRelevantUnitIds.add(s);
      }
    }

    // 3. Load all Unit Markbook assessment_events for these units (including cross-dept shared siblings)
    // in the selected period via admin client (marks are still scoped to our department's registered students).
    const relevantEvents = await fetchAllByChunks(
      Array.from(allRelevantUnitIds),
      (chunk, from, to) =>
        admin
          .from('assessment_events')
          .select('id, unit_id, department_id, cat_marks_finalized_at, exam_marks_finalized_at, marks_submitted_at')
          .eq('academic_period_id', selectedPeriod.id)
          .eq('title', 'Unit Markbook')
          .in('unit_id', chunk)
          .order('id', { ascending: true })
          .range(from, to),
      'assessment markbooks',
    );

    const eventIds = relevantEvents.map((e) => e.id);
    const eventsByUnitId = new Map<string, typeof relevantEvents>();
    for (const ev of relevantEvents) {
      if (!ev.unit_id) continue;
      const list = eventsByUnitId.get(ev.unit_id) ?? [];
      list.push(ev);
      eventsByUnitId.set(ev.unit_id, list);
    }

    // 4. Fetch marks, absences, and submissions across all relevant markbooks
    const [popRows, rosterRows, draftRows, resultRows, submissionRows] = await Promise.all([
      fetchAllByChunks(
        eventIds,
        (chunk, from, to) =>
          admin
            .from('assessment_population')
            .select('id, assessment_event_id, student_id, attendance_status, cat_absence_reason, exam_absence_reason')
            .in('assessment_event_id', chunk)
            .order('id', { ascending: true })
            .range(from, to),
        'assessment population',
      ),
      fetchAllByChunks(
        eventIds,
        (chunk, from, to) =>
          admin
            .from('assessment_roster')
            .select('id, assessment_id, student_id, cat_absent, pre_assessment_status')
            .in('assessment_id', chunk)
            .order('id', { ascending: true })
            .range(from, to),
        'assessment roster',
      ),
      fetchAllByChunks(
        eventIds,
        (chunk, from, to) =>
          admin
            .from('assessment_online_mark_drafts')
            .select('id, assessment_id, student_id, cat_mark, exam_mark')
            .in('assessment_id', chunk)
            .order('id', { ascending: true })
            .range(from, to),
        'online mark drafts',
      ),
      fetchAllByChunks(
        eventIds,
        (chunk, from, to) =>
          admin
            .from('assessment_results')
            .select('id, assessment_event_id, student_id, component_marks, grade')
            .in('assessment_event_id', chunk)
            .order('id', { ascending: true })
            .range(from, to),
        'assessment results',
      ),
      fetchAllByChunks(
        eventIds,
        (chunk, from, to) =>
          admin
            .from('assessment_mark_component_submissions')
            .select('id, assessment_id, component_key')
            .in('assessment_id', chunk)
            .order('id', { ascending: true })
            .range(from, to),
        'mark component submissions',
      ),
    ]);

    const eventCatStarted = new Set<string>();
    const eventExamSubmitted = new Set<string>();

    for (const e of relevantEvents) {
      if (e.cat_marks_finalized_at) eventCatStarted.add(e.id);
      if (e.exam_marks_finalized_at || e.marks_submitted_at) eventExamSubmitted.add(e.id);
    }

    for (const sub of submissionRows) {
      if (!sub.assessment_id) continue;
      if (sub.component_key === 'cat') eventCatStarted.add(sub.assessment_id);
      if (sub.component_key === 'exam') eventExamSubmitted.add(sub.assessment_id);
    }

    type EventStudentState = {
      catMark: number | null;
      examMark: number | null;
      catAbsent: boolean;
      examAbsent: boolean;
      catAbsenceReason: string | null;
      examAbsenceReason: string | null;
    };

    const stateByEventStudent = new Map<string, EventStudentState>();
    const getOrCreateState = (eventId: string, studentId: string): EventStudentState => {
      const k = `${eventId}:${studentId}`;
      let st = stateByEventStudent.get(k);
      if (!st) {
        st = {
          catMark: null,
          examMark: null,
          catAbsent: false,
          examAbsent: false,
          catAbsenceReason: null,
          examAbsenceReason: null,
        };
        stateByEventStudent.set(k, st);
      }
      return st;
    };

    for (const d of draftRows) {
      if (!d.assessment_id || !d.student_id) continue;
      const st = getOrCreateState(d.assessment_id, d.student_id);
      const cat = extractNumericMark(d.cat_mark);
      const exam = extractNumericMark(d.exam_mark);
      if (cat !== null) {
        st.catMark = cat;
        eventCatStarted.add(d.assessment_id);
      }
      if (exam !== null) {
        st.examMark = exam;
      }
    }

    for (const r of resultRows) {
      if (!r.assessment_event_id || !r.student_id) continue;
      const st = getOrCreateState(r.assessment_event_id, r.student_id);
      const comps =
        r.component_marks && typeof r.component_marks === 'object' && !Array.isArray(r.component_marks)
          ? (r.component_marks as Record<string, unknown>)
          : null;
      // Support both `cat1` and `cat` keys in component_marks (matching getAssessmentCandidateMarks)
      const cat = extractNumericMark(comps?.cat1 ?? comps?.cat);
      const exam = extractNumericMark(comps?.exam ?? comps?.final_exam);
      if (cat !== null && st.catMark === null) {
        st.catMark = cat;
        eventCatStarted.add(r.assessment_event_id);
      }
      if (exam !== null && st.examMark === null) {
        st.examMark = exam;
        eventExamSubmitted.add(r.assessment_event_id);
      }
      if (isExplicitAb(comps?.cat1) || isExplicitAb(comps?.cat)) {
        st.catAbsent = true;
        eventCatStarted.add(r.assessment_event_id);
      }
      if (isExplicitAb(comps?.exam) || isExplicitAb(comps?.final_exam) || isExplicitAb(r.grade)) {
        st.examAbsent = true;
        eventExamSubmitted.add(r.assessment_event_id);
      }
    }

    for (const p of popRows) {
      if (!p.assessment_event_id || !p.student_id) continue;
      const st = getOrCreateState(p.assessment_event_id, p.student_id);
      if (p.cat_absence_reason) {
        st.catAbsent = true;
        st.catAbsenceReason = p.cat_absence_reason;
        eventCatStarted.add(p.assessment_event_id);
      }
      if (p.attendance_status === 'absent' || p.exam_absence_reason) {
        st.examAbsent = true;
        if (p.exam_absence_reason) st.examAbsenceReason = p.exam_absence_reason;
      }
    }

    for (const r of rosterRows) {
      if (!r.assessment_id || !r.student_id) continue;
      const st = getOrCreateState(r.assessment_id, r.student_id);
      if (r.cat_absent) {
        st.catAbsent = true;
        eventCatStarted.add(r.assessment_id);
      }
      if (r.pre_assessment_status === 'absent') {
        st.examAbsent = true;
      }
    }

    // 5. Evaluate each registered (student, unit) pair across its own and sibling markbooks
    const seenStudentUnit = new Set<string>();
    const records: MissingMarkRecord[] = [];

    for (const reg of registrations) {
      const student = firstOf(reg.student);
      const unit = firstOf(reg.unit);
      if (!student?.id || !unit?.id) continue;

      const pairKey = `${student.id}:${unit.id}`;
      if (seenStudentUnit.has(pairKey)) continue;
      seenStudentUnit.add(pairKey);

      const siblingUnitIds = siblingUnitsByUnit.get(unit.id) ?? new Set([unit.id]);
      const matchingEvents = Array.from(siblingUnitIds).flatMap((uid) => eventsByUnitId.get(uid) ?? []);

      // Pick the department's own markbook for this unit first for the "Open Markbook" link
      const primaryEvent =
        matchingEvents.find((ev) => ev.unit_id === unit.id && ev.department_id === departmentId) ??
        matchingEvents.find((ev) => ev.department_id === departmentId) ??
        matchingEvents[0] ??
        null;

      if (!primaryEvent) continue;

      let catMark: number | null = null;
      let examMark: number | null = null;
      let catAbsent = false;
      let examAbsent = false;
      let catAbsenceReason: string | null = null;
      let examAbsenceReason: string | null = null;
      let catMarkingStarted = false;
      let examSubmitted = false;

      for (const ev of matchingEvents) {
        if (eventCatStarted.has(ev.id)) catMarkingStarted = true;
        if (eventExamSubmitted.has(ev.id)) examSubmitted = true;

        const st = stateByEventStudent.get(`${ev.id}:${student.id}`);
        if (!st) continue;
        if (st.catMark !== null && catMark === null) catMark = st.catMark;
        if (st.examMark !== null && examMark === null) examMark = st.examMark;
        if (st.catAbsent) catAbsent = true;
        if (st.examAbsent) examAbsent = true;
        if (!catAbsenceReason && st.catAbsenceReason) catAbsenceReason = st.catAbsenceReason;
        if (!examAbsenceReason && st.examAbsenceReason) examAbsenceReason = st.examAbsenceReason;
      }

      // If a numeric mark is recorded on any sibling markbook, it takes precedence over missing
      const catStatus: ComponentMarkStatus =
        catMark !== null ? 'present' : catAbsent ? 'absent' : 'missing';
      const examStatus: ComponentMarkStatus =
        examMark !== null ? 'present' : examAbsent ? 'absent' : 'missing';

      // Skip students who have valid recorded marks for both CAT and Exam
      if (catStatus === 'present' && examStatus === 'present') continue;

      const prog = firstOf(student.programme);
      const cohort = firstOf(student.current_cohort) ?? firstOf(student.admission_cohort);

      records.push({
        key: pairKey,
        assessmentId: primaryEvent.id,
        studentId: student.id,
        admissionNumber: student.admission_number ?? '—',
        fullName: student.full_name ?? 'Unknown Student',
        programmeId: prog?.id ?? '',
        programmeCode: prog?.code ?? '—',
        cohortId: cohort?.id ?? null,
        cohortName: cohort?.name ?? cohort?.code ?? 'Unassigned',
        unitId: unit.id,
        unitCode: unit.code ?? '—',
        unitName: unit.name ?? 'Unnamed Unit',
        catStatus,
        catMark,
        catAbsenceReason,
        examStatus,
        examMark,
        examAbsenceReason,
        catMarkingStarted,
        examSubmitted,
      });
    }

    records.sort(
      (a, b) =>
        compareAdmissionNumbers(a.admissionNumber, b.admissionNumber) ||
        a.unitCode.localeCompare(b.unitCode),
    );

    return {
      departmentName: profile.departmentName,
      periods,
      selectedPeriodId: selectedPeriod.id,
      selectedPeriodName: selectedPeriod.name,
      records,
    };
  },
);
