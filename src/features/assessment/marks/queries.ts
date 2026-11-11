import { cache } from 'react';

import { requireHodAccess } from '@/features/auth/authorization';
import { calculateOnlineFinalTotal, calculateRatCatAverage } from '@/features/staff-assessment/online-marks-domain';
import { resolveAssessmentIdsWithSiblings } from '@/features/staff-assessment/online-marks-query';
import { createClient } from '@/lib/supabase/server';

import type { AssessmentMarkImportBatch, AssessmentMarkImportRow, CandidateMarkRecord } from './types';

export const getAssessmentMarkImportBatch = cache(async (batchId: string) => {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return null;
  const supabase = await createClient();
  const { data: batch, error } = await supabase
    .from('assessment_mark_import_batches')
    .select(`
      id,assessment_event_id,original_file_name,status,total_rows,valid_rows,invalid_rows,sheet_count,created_at,
      assessment:assessment_events(id,title,assessment_type,unit:units(code,name),academic_period:academic_periods(name))
    `)
    .eq('id', batchId)
    .eq('department_id', profile.activeDepartmentId)
    .maybeSingle();
  if (error) throw new Error(`Unable to load marks import: ${error.message}`);
  if (!batch) return null;

  const { data: rows, error: rowsError } = await supabase
    .from('assessment_mark_import_rows')
    .select(`
      id,sheet_name,row_number,admission_number,row_status,errors,component_marks,total_mark,grade,comment,
      student:students(full_name),cohort:cohorts(code,name)
    `)
    .eq('batch_id', batchId)
    .order('sheet_name')
    .order('row_number');
  if (rowsError) throw new Error(`Unable to load mark rows: ${rowsError.message}`);
  return { batch: batch as unknown as AssessmentMarkImportBatch, rows: (rows ?? []) as unknown as AssessmentMarkImportRow[] };
});

export const getAssessmentResultCount = cache(async (assessmentId: string) => {
  const supabase = await createClient();
  const resolvedIds = await resolveAssessmentIdsWithSiblings(supabase, assessmentId);
  const targetEventIds = resolvedIds.length > 0 ? resolvedIds : [assessmentId];

  const [resultsRes, draftsRes] = await Promise.all([
    supabase
      .from('assessment_results')
      .select('student_id')
      .in('assessment_event_id', targetEventIds),
    supabase
      .from('assessment_online_mark_drafts')
      .select('student_id, assignment_mark, presentation_mark, rat_mark, cat_mark, exam_mark')
      .in('assessment_id', targetEventIds),
  ]);
  if (resultsRes.error) throw new Error(`Unable to load assessment results count: ${resultsRes.error.message}`);
  if (draftsRes.error) throw new Error(`Unable to load assessment drafts count: ${draftsRes.error.message}`);

  const studentsWithResults = new Set((resultsRes.data ?? []).map((r) => r.student_id).filter(Boolean));
  const studentsWithDrafts = new Set(
    (draftsRes.data ?? [])
      .filter((d) =>
        d.assignment_mark !== null ||
        d.presentation_mark !== null ||
        d.rat_mark !== null ||
        d.cat_mark !== null ||
        d.exam_mark !== null,
      )
      .map((d) => d.student_id)
      .filter(Boolean),
  );

  return new Set([...studentsWithResults, ...studentsWithDrafts]).size;
});

export const getAssessmentMarkComponentSubmissions = cache(async (assessmentId: string) => {
  await requireHodAccess();
  const supabase = await createClient();
  const resolvedIds = await resolveAssessmentIdsWithSiblings(supabase, assessmentId);
  const targetEventIds = resolvedIds.length > 0 ? resolvedIds : [assessmentId];

  const [submissionResult, assessmentResult] = await Promise.all([
    supabase
      .from('assessment_mark_component_submissions')
      .select('id,cohort_id,component_key,submitted_at,cohort:cohorts(code,name)')
      .in('assessment_id', targetEventIds)
      .order('submitted_at', { ascending: false }),
    supabase
      .from('assessment_events')
      .select('id,operational_workflow_status,marks_submitted_at,cat_marks_finalized_at,exam_marks_finalized_at,status')
      .in('id', targetEventIds),
  ]);
  if (submissionResult.error) throw new Error(`Unable to load submitted mark components: ${submissionResult.error.message}`);
  if (assessmentResult.error) throw new Error(`Unable to load markbook status: ${assessmentResult.error.message}`);

  const assessments = assessmentResult.data ?? [];
  const primaryAssessment = assessments.find((a) => a.id === assessmentId) ?? assessments[0];
  const workflowStatus = primaryAssessment?.operational_workflow_status;

  const seenScopes = new Set<string>();
  const uniqueSubmissions: NonNullable<typeof submissionResult.data> = [];
  for (const sub of submissionResult.data ?? []) {
    const key = `${sub.cohort_id ?? 'all'}:${sub.component_key}`;
    if (!seenScopes.has(key)) {
      seenScopes.add(key);
      uniqueSubmissions.push(sub);
    }
  }

  const anyCatFinalized = assessments.find((a) => Boolean(a.cat_marks_finalized_at));
  const hasCatSub = uniqueSubmissions.some((s) => s.component_key === 'cat');
  if (anyCatFinalized && !hasCatSub) {
    uniqueSubmissions.push({
      id: `cat-finalized-${assessmentId}`,
      cohort_id: null,
      component_key: 'cat',
      submitted_at: anyCatFinalized.cat_marks_finalized_at!,
      cohort: null,
    });
  }

  return {
    submissions: uniqueSubmissions,
    canUnlock: Boolean(primaryAssessment)
      && !primaryAssessment?.marks_submitted_at
      && !primaryAssessment?.exam_marks_finalized_at
      && primaryAssessment?.status !== 'closed'
      && !['submitted', 'finalised', 'archived'].includes(workflowStatus ?? ''),
  };
});

export const getAssessmentCandidateMarks = cache(
  async (assessmentId: string): Promise<Record<string, CandidateMarkRecord>> => {
    await requireHodAccess();
    const supabase = await createClient();
    const resolvedIds = await resolveAssessmentIdsWithSiblings(supabase, assessmentId);
    const targetEventIds = resolvedIds.length > 0 ? resolvedIds : [assessmentId];

    const [resultsResult, draftsResult, rosterResult] = await Promise.all([
      supabase
        .from('assessment_results')
        .select('student_id, component_marks, total_mark, grade, comment, operational_result_status, imported_at, updated_at')
        .in('assessment_event_id', targetEventIds),
      supabase
        .from('assessment_online_mark_drafts')
        .select('student_id, assignment_mark, presentation_mark, rat_mark, cat_mark, exam_mark, updated_at')
        .in('assessment_id', targetEventIds),
      supabase
        .from('assessment_roster')
        .select('student_id, cat_absent, pre_assessment_status')
        .in('assessment_id', targetEventIds),
    ]);

    if (resultsResult.error) {
      throw new Error(`Unable to load assessment marks: ${resultsResult.error.message}`);
    }
    if (draftsResult.error) {
      throw new Error(`Unable to load assessment mark drafts: ${draftsResult.error.message}`);
    }

    const rosterMap = new Map<string, { catAbsent: boolean; isAbsent: boolean }>();
    for (const r of rosterResult.data ?? []) {
      if (r.student_id) {
        rosterMap.set(r.student_id, {
          catAbsent: Boolean(r.cat_absent),
          isAbsent: r.pre_assessment_status === 'absent',
        });
      }
    }

    const draftMap = new Map<string, (typeof draftsResult.data)[number]>();
    for (const d of draftsResult.data ?? []) {
      if (!d.student_id) continue;
      const existing = draftMap.get(d.student_id);
      if (!existing) {
        draftMap.set(d.student_id, d);
      } else {
        const hasMarks = (row: typeof d) =>
          row.assignment_mark !== null ||
          row.presentation_mark !== null ||
          row.rat_mark !== null ||
          row.cat_mark !== null ||
          row.exam_mark !== null;
        if (!hasMarks(existing) && hasMarks(d)) {
          draftMap.set(d.student_id, d);
        } else if (hasMarks(d) && String(d.updated_at ?? '') > String(existing.updated_at ?? '')) {
          draftMap.set(d.student_id, d);
        }
      }
    }

    const resultMap = new Map<string, (typeof resultsResult.data)[number]>();
    for (const r of resultsResult.data ?? []) {
      if (r.student_id) {
        resultMap.set(r.student_id, r);
      }
    }

    const allStudentIds = new Set([
      ...resultMap.keys(),
      ...draftMap.keys(),
      ...rosterMap.keys(),
    ]);

    const records: Record<string, CandidateMarkRecord> = {};

    const asNum = (v: unknown): number | null => {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string' && v.trim()) {
        const parsed = Number(v);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    for (const studentId of allStudentIds) {
      const res = resultMap.get(studentId);
      const draft = draftMap.get(studentId);
      const rosterInfo = rosterMap.get(studentId);

      const isExamAbsent = rosterInfo?.isAbsent ?? false;
      const isCatAbsent = rosterInfo?.catAbsent ?? false;

      const cm = res?.component_marks && typeof res.component_marks === 'object' && !Array.isArray(res.component_marks)
        ? (res.component_marks as Record<string, unknown>)
        : null;

      const assignment = asNum(cm?.assignment) ?? asNum(draft?.assignment_mark);
      const presentation = asNum(cm?.presentation) ?? asNum(draft?.presentation_mark);
      const rat = asNum(cm?.rat) ?? asNum(draft?.rat_mark);
      const cat = asNum(cm?.cat1 ?? cm?.cat) ?? asNum(draft?.cat_mark);
      const exam = isExamAbsent ? null : (asNum(cm?.exam) ?? asNum(draft?.exam_mark));

      let ratCatAverage: number | null = asNum(cm?.ratCatAverage);
      if (ratCatAverage === null && (rat !== null || cat !== null)) {
        ratCatAverage = calculateRatCatAverage({ rat, cat });
      }

      let coursework: number | null = asNum(cm?.coursework);
      if (coursework === null && (assignment !== null || presentation !== null || ratCatAverage !== null)) {
        coursework = Math.round((assignment ?? 0) + (presentation ?? 0) + (ratCatAverage ?? 0));
      } else if (coursework !== null) {
        coursework = Math.round(coursework);
      }

      let total: number | null = asNum(res?.total_mark) ?? asNum(cm?.total);
      if (total === null && !isExamAbsent) {
        const calculated = calculateOnlineFinalTotal(
          { assignment, presentation, rat, cat, exam },
          isExamAbsent,
        );
        total = calculated !== null ? Math.round(calculated) : null;
      } else if (total !== null) {
        total = Math.round(total);
      }

      let grade = res?.grade ?? null;
      let comment = res?.comment ?? null;

      if (!grade) {
        if (isExamAbsent) {
          grade = 'ABSENT';
          comment = 'Exam Absent';
        } else if (total !== null) {
          if (total >= 75) grade = 'DISTINCTION';
          else if (total >= 65) grade = 'CREDIT';
          else if (total >= 40) grade = 'PASS';
          else grade = 'REFER';

          comment = total >= 40 ? 'Pass' : 'Refer';
        }
      }

      const source: CandidateMarkRecord['source'] = res ? 'official' : draft ? 'draft' : 'none';

      records[studentId] = {
        studentId,
        assignment,
        presentation,
        rat,
        cat,
        catAbsent: isCatAbsent,
        exam,
        isExamAbsent,
        ratCatAverage,
        coursework,
        total,
        grade,
        comment,
        isCommitted: Boolean(res),
        source,
      };
    }

    return records;
  }
);
