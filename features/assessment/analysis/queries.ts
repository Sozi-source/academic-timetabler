import { cache } from 'react';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import type { AssessmentAnalysis, AssessmentAnalysisEvent, AssessmentAnalysisStudent, CohortAnalysisRow } from './types';

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mean(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export const getAssessmentAnalysis = cache(async (assessmentId: string): Promise<AssessmentAnalysis | null> => {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return null;

  const supabase = await createClient();
  const { data: event, error: eventError } = await supabase
    .from('assessment_events')
    .select(`
      id,title,assessment_type,assessment_date,max_mark,pass_mark,status,attendance_finalized_at,
      academic_period:academic_periods(id,code,name),
      unit:units(id,code,name)
    `)
    .eq('id', assessmentId)
    .eq('department_id', profile.activeDepartmentId)
    .maybeSingle();

  if (eventError) throw new Error(`Unable to load assessment analysis: ${eventError.message}`);
  if (!event) return null;

  const { data: population, error: populationError } = await supabase
    .from('assessment_population')
    .select(`
      student_id,attendance_status,population_status,
      student:students(id,admission_number,full_name),
      cohort:cohorts(id,code,name)
    `)
    .eq('assessment_event_id', assessmentId)
    .eq('population_status', 'expected')
    .order('created_at', { ascending: true });

  if (populationError) throw new Error(`Unable to load assessment population: ${populationError.message}`);

  const { data: results, error: resultsError } = await supabase
    .from('assessment_results')
    .select('student_id,component_marks,total_mark,grade,comment')
    .eq('assessment_event_id', assessmentId);

  if (resultsError) throw new Error(`Unable to load assessment results: ${resultsError.message}`);

  const resultMap = new Map((results ?? []).map((result) => [result.student_id, result]));
  const students: AssessmentAnalysisStudent[] = (population ?? []).map((row) => {
    const student = Array.isArray(row.student) ? row.student[0] : row.student;
    const cohort = Array.isArray(row.cohort) ? row.cohort[0] : row.cohort;
    const result = resultMap.get(row.student_id);
    return {
      studentId: row.student_id,
      admissionNumber: student?.admission_number ?? '',
      fullName: student?.full_name ?? '',
      cohortId: cohort?.id ?? '',
      cohortCode: cohort?.code ?? '',
      cohortName: cohort?.name ?? '',
      attendanceStatus: row.attendance_status as AssessmentAnalysisStudent['attendanceStatus'],
      componentMarks: (result?.component_marks as Record<string, number | null> | null | undefined) ?? null,
      totalMark: numberValue(result?.total_mark),
      grade: result?.grade ?? null,
      comment: result?.comment ?? null,
    };
  });

  const typedEvent = event as unknown as AssessmentAnalysisEvent;
  const markedStudents = students.filter((student) => student.totalMark !== null);
  const presentStudents = students.filter((student) => student.attendanceStatus === 'present');
  const absentStudents = students.filter((student) => student.attendanceStatus === 'absent');
  const passedStudents = markedStudents.filter((student) => (student.totalMark ?? 0) >= typedEvent.pass_mark);
  const failedStudents = markedStudents.filter((student) => (student.totalMark ?? 0) < typedEvent.pass_mark);
  const totals = markedStudents.map((student) => student.totalMark as number);

  const cohortGroups = new Map<string, AssessmentAnalysisStudent[]>();
  for (const student of students) {
    const key = student.cohortId || 'unresolved';
    const list = cohortGroups.get(key) ?? [];
    list.push(student);
    cohortGroups.set(key, list);
  }

  const cohorts: CohortAnalysisRow[] = Array.from(cohortGroups.entries()).map(([cohortId, list]) => {
    const marked = list.filter((student) => student.totalMark !== null);
    const present = list.filter((student) => student.attendanceStatus === 'present');
    const absent = list.filter((student) => student.attendanceStatus === 'absent');
    const passed = marked.filter((student) => (student.totalMark ?? 0) >= typedEvent.pass_mark);
    const failed = marked.filter((student) => (student.totalMark ?? 0) < typedEvent.pass_mark);
    return {
      cohortId,
      cohortCode: list[0]?.cohortCode ?? '',
      cohortName: list[0]?.cohortName ?? '',
      expected: list.length,
      present: present.length,
      absent: absent.length,
      marked: marked.length,
      missingMarks: present.filter((student) => student.totalMark === null).length,
      passed: passed.length,
      failed: failed.length,
      mean: mean(marked.map((student) => student.totalMark as number)),
    };
  }).sort((a, b) => a.cohortName.localeCompare(b.cohortName));

  const courseworkValues = markedStudents.map((student) => numberValue(student.componentMarks?.coursework)).filter((value): value is number => value !== null);
  const examValues = markedStudents.map((student) => numberValue(student.componentMarks?.exam)).filter((value): value is number => value !== null);

  return {
    event: typedEvent,
    students,
    cohorts,
    expected: students.length,
    present: presentStudents.length,
    absent: absentStudents.length,
    marked: markedStudents.length,
    missingMarks: presentStudents.filter((student) => student.totalMark === null).length,
    passed: passedStudents.length,
    failed: failedStudents.length,
    passRate: markedStudents.length > 0 ? (passedStudents.length / markedStudents.length) * 100 : null,
    mean: mean(totals),
    highest: totals.length > 0 ? Math.max(...totals) : null,
    lowest: totals.length > 0 ? Math.min(...totals) : null,
    courseworkMean: mean(courseworkValues),
    examMean: mean(examValues),
  };
});
