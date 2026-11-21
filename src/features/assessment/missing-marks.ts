import 'server-only';

import { cache } from 'react';

import { requireHodAccess } from '@/features/auth/authorization';
import { compareAdmissionNumbers } from '@/features/students/admission-number-sort';
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
  examMarkingStarted: boolean;
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

    const { data: eventsRaw, error: eventsError } = await supabase
      .from('assessment_events')
      .select(`
        id,
        unit_id,
        cohort_id,
        cat_marks_finalized_at,
        exam_marks_finalized_at,
        unit:units(id, code, name, programme:programmes(id, code, name))
      `)
      .eq('department_id', departmentId)
      .eq('academic_period_id', selectedPeriod.id)
      .eq('title', 'Unit Markbook');

    if (eventsError) throw new Error(`Unable to load assessment markbooks: ${eventsError.message}`);

    const events = eventsRaw ?? [];
    if (events.length === 0) {
      return {
        departmentName: profile.departmentName,
        periods,
        selectedPeriodId: selectedPeriod.id,
        selectedPeriodName: selectedPeriod.name,
        records: [],
      };
    }

    const eventIds = events.map((e) => e.id);
    const eventById = new Map(events.map((e) => [e.id, e]));

    const [popRows, rosterRows, draftRows, resultRows] = await Promise.all([
      fetchAllPaged(
        (from, to) =>
          supabase
            .from('assessment_population')
            .select(`
              id,
              assessment_event_id,
              student_id,
              attendance_status,
              cat_absence_reason,
              exam_absence_reason,
              student:students(id, admission_number, full_name, lifecycle_status, academic_phase, programme:programmes(id, code)),
              cohort:cohorts(id, code, name)
            `)
            .in('assessment_event_id', eventIds)
            .eq('population_status', 'expected')
            .order('id', { ascending: true })
            .range(from, to),
        'assessment population',
      ),
      fetchAllPaged(
        (from, to) =>
          supabase
            .from('assessment_roster')
            .select(`
              id,
              assessment_id,
              student_id,
              cat_absent,
              pre_assessment_status,
              student:students(id, admission_number, full_name, lifecycle_status, academic_phase, programme:programmes(id, code)),
              cohort:cohorts(id, code, name)
            `)
            .in('assessment_id', eventIds)
            .order('id', { ascending: true })
            .range(from, to),
        'assessment roster',
      ),
      fetchAllPaged(
        (from, to) =>
          supabase
            .from('assessment_online_mark_drafts')
            .select('id, assessment_id, student_id, cat_mark, exam_mark')
            .in('assessment_id', eventIds)
            .order('id', { ascending: true })
            .range(from, to),
        'online mark drafts',
      ),
      fetchAllPaged(
        (from, to) =>
          supabase
            .from('assessment_results')
            .select('id, assessment_event_id, student_id, component_marks, grade')
            .in('assessment_event_id', eventIds)
            .order('id', { ascending: true })
            .range(from, to),
        'assessment results',
      ),
    ]);

    // Track per-event marking activity (whether at least 1 candidate has a CAT/Exam mark or absence)
    const eventCatStarted = new Set<string>();
    const eventExamStarted = new Set<string>();

    for (const e of events) {
      if (e.cat_marks_finalized_at) eventCatStarted.add(e.id);
      if (e.exam_marks_finalized_at) eventExamStarted.add(e.id);
    }

    type MarkState = {
      catMark: number | null;
      examMark: number | null;
      resultCatAb: boolean;
      resultExamAb: boolean;
    };
    const markByKey = new Map<string, MarkState>();

    const getOrCreateMark = (key: string): MarkState => {
      let state = markByKey.get(key);
      if (!state) {
        state = { catMark: null, examMark: null, resultCatAb: false, resultExamAb: false };
        markByKey.set(key, state);
      }
      return state;
    };

    for (const d of draftRows) {
      if (!d.assessment_id || !d.student_id) continue;
      const state = getOrCreateMark(`${d.assessment_id}:${d.student_id}`);
      const cat = extractNumericMark(d.cat_mark);
      const exam = extractNumericMark(d.exam_mark);
      if (cat !== null) {
        state.catMark = cat;
        eventCatStarted.add(d.assessment_id);
      }
      if (exam !== null) {
        state.examMark = exam;
        eventExamStarted.add(d.assessment_id);
      }
    }

    for (const r of resultRows) {
      if (!r.assessment_event_id || !r.student_id) continue;
      const state = getOrCreateMark(`${r.assessment_event_id}:${r.student_id}`);
      const comps =
        r.component_marks && typeof r.component_marks === 'object'
          ? (r.component_marks as Record<string, unknown>)
          : null;
      const cat = extractNumericMark(comps?.cat);
      const exam = extractNumericMark(comps?.exam);
      if (cat !== null && state.catMark === null) {
        state.catMark = cat;
        eventCatStarted.add(r.assessment_event_id);
      }
      if (exam !== null && state.examMark === null) {
        state.examMark = exam;
        eventExamStarted.add(r.assessment_event_id);
      }
      if (isExplicitAb(comps?.cat)) {
        state.resultCatAb = true;
        eventCatStarted.add(r.assessment_event_id);
      }
      if (isExplicitAb(comps?.exam) || isExplicitAb(r.grade)) {
        state.resultExamAb = true;
        eventExamStarted.add(r.assessment_event_id);
      }
    }

    // Merge population and roster candidates per (assessment_event_id, student_id)
    type CandidateEntry = {
      assessmentId: string;
      studentId: string;
      admissionNumber: string;
      fullName: string;
      programmeId: string;
      programmeCode: string;
      cohortId: string | null;
      cohortName: string;
      catAbsent: boolean;
      catAbsenceReason: string | null;
      examAbsent: boolean;
      examAbsenceReason: string | null;
    };

    const candidateMap = new Map<string, CandidateEntry>();

    const isActiveInClass = (
      lifecycle: string | null | undefined,
      phase: string | null | undefined,
    ) => {
      const l = (lifecycle ?? '').toLowerCase();
      if (l && !['admitted', 'active'].includes(l)) return false;
      const p = (phase ?? '').toLowerCase();
      if (p && p !== 'in_class') return false;
      return true;
    };

    for (const p of popRows) {
      const student = firstOf(p.student);
      if (!student?.id || !p.assessment_event_id) continue;
      if (!isActiveInClass(student.lifecycle_status, student.academic_phase)) continue;

      const cohort = firstOf(p.cohort);
      const studentProg = firstOf(student.programme);
      const event = eventById.get(p.assessment_event_id);
      const unit = firstOf(event?.unit);
      const unitProg = firstOf(unit?.programme);

      const key = `${p.assessment_event_id}:${student.id}`;
      const examAbsent = p.attendance_status === 'absent' || Boolean(p.exam_absence_reason);
      const catAbsent = Boolean(p.cat_absence_reason);
      if (catAbsent) eventCatStarted.add(p.assessment_event_id);
      if (examAbsent) eventExamStarted.add(p.assessment_event_id);

      const existing = candidateMap.get(key);
      if (!existing) {
        candidateMap.set(key, {
          assessmentId: p.assessment_event_id,
          studentId: student.id,
          admissionNumber: student.admission_number ?? '—',
          fullName: student.full_name ?? 'Unknown Student',
          programmeId: studentProg?.id ?? unitProg?.id ?? '',
          programmeCode: studentProg?.code ?? unitProg?.code ?? '—',
          cohortId: cohort?.id ?? null,
          cohortName: cohort?.name ?? cohort?.code ?? 'Unassigned',
          catAbsent,
          catAbsenceReason: p.cat_absence_reason ?? null,
          examAbsent,
          examAbsenceReason: p.exam_absence_reason ?? null,
        });
      } else {
        existing.catAbsent = existing.catAbsent || catAbsent;
        existing.examAbsent = existing.examAbsent || examAbsent;
        if (!existing.catAbsenceReason && p.cat_absence_reason) existing.catAbsenceReason = p.cat_absence_reason;
        if (!existing.examAbsenceReason && p.exam_absence_reason) existing.examAbsenceReason = p.exam_absence_reason;
      }
    }

    for (const r of rosterRows) {
      const student = firstOf(r.student);
      if (!student?.id || !r.assessment_id) continue;
      if (!isActiveInClass(student.lifecycle_status, student.academic_phase)) continue;

      const cohort = firstOf(r.cohort);
      const studentProg = firstOf(student.programme);
      const event = eventById.get(r.assessment_id);
      const unit = firstOf(event?.unit);
      const unitProg = firstOf(unit?.programme);

      const key = `${r.assessment_id}:${student.id}`;
      const catAbsent = Boolean(r.cat_absent);
      const examAbsent = r.pre_assessment_status === 'absent';
      if (catAbsent) eventCatStarted.add(r.assessment_id);
      if (examAbsent) eventExamStarted.add(r.assessment_id);

      const existing = candidateMap.get(key);
      if (!existing) {
        candidateMap.set(key, {
          assessmentId: r.assessment_id,
          studentId: student.id,
          admissionNumber: student.admission_number ?? '—',
          fullName: student.full_name ?? 'Unknown Student',
          programmeId: studentProg?.id ?? unitProg?.id ?? '',
          programmeCode: studentProg?.code ?? unitProg?.code ?? '—',
          cohortId: cohort?.id ?? null,
          cohortName: cohort?.name ?? cohort?.code ?? 'Unassigned',
          catAbsent,
          catAbsenceReason: null,
          examAbsent,
          examAbsenceReason: null,
        });
      } else {
        existing.catAbsent = existing.catAbsent || catAbsent;
        existing.examAbsent = existing.examAbsent || examAbsent;
      }
    }

    // Deduplicate by (studentId, unitId) within the period and keep only flagged rows
    const dedupedByStudentUnit = new Map<string, MissingMarkRecord>();

    for (const [key, entry] of candidateMap.entries()) {
      const event = eventById.get(entry.assessmentId);
      const unit = firstOf(event?.unit);
      if (!unit?.id) continue;

      const marks = markByKey.get(key);
      const catMark = marks?.catMark ?? null;
      const examMark = marks?.examMark ?? null;

      const catIsAbsent = entry.catAbsent || Boolean(marks?.resultCatAb);
      const examIsAbsent = entry.examAbsent || Boolean(marks?.resultExamAb);

      const catStatus: ComponentMarkStatus = catIsAbsent
        ? 'absent'
        : catMark !== null
          ? 'present'
          : 'missing';
      const examStatus: ComponentMarkStatus = examIsAbsent
        ? 'absent'
        : examMark !== null
          ? 'present'
          : 'missing';

      // Skip students who have valid numeric marks for both CAT and Exam
      if (catStatus === 'present' && examStatus === 'present') continue;

      const record: MissingMarkRecord = {
        key: `${entry.studentId}:${unit.id}`,
        assessmentId: entry.assessmentId,
        studentId: entry.studentId,
        admissionNumber: entry.admissionNumber,
        fullName: entry.fullName,
        programmeId: entry.programmeId,
        programmeCode: entry.programmeCode,
        cohortId: entry.cohortId,
        cohortName: entry.cohortName,
        unitId: unit.id,
        unitCode: unit.code ?? '—',
        unitName: unit.name ?? 'Unnamed Unit',
        catStatus,
        catMark,
        catAbsenceReason: entry.catAbsenceReason,
        examStatus,
        examMark,
        examAbsenceReason: entry.examAbsenceReason,
        catMarkingStarted: eventCatStarted.has(entry.assessmentId),
        examMarkingStarted: eventExamStarted.has(entry.assessmentId),
      };

      const existing = dedupedByStudentUnit.get(record.key);
      if (!existing) {
        dedupedByStudentUnit.set(record.key, record);
      } else {
        // Prefer the record that actually has marks or explicit absences
        const existingScore =
          (existing.catStatus === 'present' ? 2 : existing.catStatus === 'absent' ? 1 : 0) +
          (existing.examStatus === 'present' ? 2 : existing.examStatus === 'absent' ? 1 : 0);
        const nextScore =
          (record.catStatus === 'present' ? 2 : record.catStatus === 'absent' ? 1 : 0) +
          (record.examStatus === 'present' ? 2 : record.examStatus === 'absent' ? 1 : 0);
        if (nextScore > existingScore) {
          dedupedByStudentUnit.set(record.key, record);
        }
      }
    }

    const records = Array.from(dedupedByStudentUnit.values()).sort(
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
