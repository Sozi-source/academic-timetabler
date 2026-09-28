'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getAssessmentById, getAssessmentPopulation } from '@/features/assessment/queries';
import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

import { gradeFor, parseAssessmentMarksWorkbook } from './workbook';
import type { MarkUploadActionState } from './types';

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

export async function stageAssessmentMarksAction(
  _previousState: MarkUploadActionState,
  formData: FormData,
): Promise<MarkUploadActionState> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return { status: 'error', message: 'Select a department first.' };
  const assessmentId = text(formData, 'assessmentId');
  const workbookFile = formData.get('workbook');
  if (!assessmentId || !(workbookFile instanceof File)) return { status: 'error', message: 'Select an Excel workbook.' };
  if (!workbookFile.name.toLowerCase().endsWith('.xlsx')) return { status: 'error', message: 'Use the system-generated .xlsx workbook.' };
  if (workbookFile.size > 12 * 1024 * 1024) return { status: 'error', message: 'Workbook is too large.' };

  const [assessment, population] = await Promise.all([getAssessmentById(assessmentId), getAssessmentPopulation(assessmentId)]);
  if (!assessment) return { status: 'error', message: 'Unit markbook not found.' };
  if (assessment.exam_marks_finalized_at) {
    return { status: 'error', message: 'This unit markbook is complete and locked against further marks uploads.' };
  }
  if (population.length === 0) {
    return { status: 'error', message: 'Build the unit population before uploading marks.' };
  }
  const importPhase: 'cat' | 'exam' = assessment.attendance_finalized_at ? 'exam' : 'cat';
  if (importPhase === 'exam' && !assessment.cat_marks_finalized_at) {
    return { status: 'error', message: 'Coursework/CAT marks must be committed before final examination marks.' };
  }

  let parsed;
  try {
    parsed = await parseAssessmentMarksWorkbook(await workbookFile.arrayBuffer());
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'Workbook could not be read.' };
  }
  if (parsed.assessmentId !== assessment.id || parsed.unitId !== assessment.unit?.id) {
    return { status: 'error', message: 'This workbook belongs to a different unit markbook.' };
  }

  const populationByAdmission = new Map(
    population.filter((row) => row.student).map((row) => [row.student!.admission_number.trim().toUpperCase(), row]),
  );
  const seen = new Set<string>();
  const stagedRows: Array<Record<string, unknown>> = [];

  for (const sheet of parsed.sheets) {
    for (const row of sheet.rows) {
      const errors: string[] = [];
      const candidate = populationByAdmission.get(row.admissionNumber);
      if (!candidate?.student) errors.push('Student is not in the expected unit population.');
      if (candidate?.cohort && row.cohortLabel && ![candidate.cohort.name, candidate.cohort.code].some((label) => label.trim().toLowerCase() === row.cohortLabel.trim().toLowerCase())) {
        errors.push('The displayed cohort/group has been changed.');
      }
      if (seen.has(row.admissionNumber)) errors.push('Student appears more than once in this workbook.');
      seen.add(row.admissionNumber);

      const attendance = candidate?.attendance_status ?? 'pending';
      const marks = row.componentMarks;
      if (importPhase === 'cat') {
        if (row.uploadedAbsent) errors.push('Do not type AB. Examination absence is recorded from the physical attendance sheet.');
        const cat1 = marks.cat1;
        if (cat1 !== null && cat1 !== undefined && (cat1 < 0 || cat1 > 15)) errors.push('CAT 1 mark must be between 0 and 15.');
      } else {
        if (attendance === 'absent' && !row.uploadedAbsent) errors.push('Student was recorded absent in the system; the workbook must retain AB.');
        if (attendance !== 'absent' && row.uploadedAbsent) errors.push('AB can only come from attendance recorded in the system.');
        const checks: Array<[string, number | null | undefined, number, boolean]> = [
          ['Assignment', marks.assignment, 5, true],
          ['Presentation/Practical', marks.presentation, 10, true],
          ['RAT', marks.rat, 15, true],
          ['CAT 1', marks.cat1, 15, true],
          ['Exam', marks.exam, 70, attendance !== 'absent'],
        ];
        for (const [label, value, maximum, required] of checks) {
          if (required && (value === null || value === undefined)) errors.push(`${label} mark is missing.`);
          else if (value !== null && value !== undefined && (value < 0 || value > maximum)) errors.push(`${label} mark must be between 0 and ${maximum}.`);
        }
      }

      const total = importPhase === 'exam' && attendance !== 'absent' ? row.totalMark : null;
      const grade = importPhase === 'exam' ? gradeFor(total, 100) : null;
      const comment = importPhase === 'exam' ? (attendance === 'absent' ? 'ABSENT' : total === null ? null : total >= 40 ? 'PASS' : 'FAIL') : null;
      stagedRows.push({
        sheet_name: sheet.sheetName,
        row_number: row.rowNumber,
        student_id: candidate?.student?.id ?? null,
        cohort_id: candidate?.cohort?.id ?? null,
        admission_number: row.admissionNumber,
        row_status: errors.length ? 'invalid' : 'ready',
        errors,
        component_marks: importPhase === 'cat' ? { cat1: marks.cat1 ?? null } : row.componentMarks,
        total_mark: total,
        grade,
        comment,
      });
    }
  }

  const missingAdmissions = [...populationByAdmission.keys()].filter((admission) => !seen.has(admission));
  for (const [missingIndex, admission] of missingAdmissions.entries()) {
    const candidate = populationByAdmission.get(admission)!;
    stagedRows.push({
      sheet_name: 'Missing from workbook',
      row_number: missingIndex + 1,
      student_id: candidate.student?.id ?? null,
      cohort_id: candidate.cohort?.id ?? null,
      admission_number: admission,
      row_status: 'invalid',
      errors: ['Expected student is missing from the workbook.'],
      component_marks: {},
      total_mark: null,
      grade: null,
      comment: null,
    });
  }

  const validRows = stagedRows.filter((row) => row.row_status === 'ready').length;
  const invalidRows = stagedRows.length - validRows;
  const supabase = await createClient();
  const { data: batch, error: batchError } = await supabase
    .from('assessment_mark_import_batches')
    .insert({
      assessment_event_id: assessment.id,
      department_id: profile.activeDepartmentId,
      original_file_name: workbookFile.name,
      total_rows: stagedRows.length,
      valid_rows: validRows,
      invalid_rows: invalidRows,
      sheet_count: parsed.sheets.length,
      import_phase: importPhase,
      status: 'staged',
    })
    .select('id')
    .single();
  if (batchError || !batch) return { status: 'error', message: batchError?.message ?? 'Import preview could not be created.' };

  const rowsWithBatch = stagedRows.map((row) => ({ ...row, batch_id: batch.id }));
  for (let start = 0; start < rowsWithBatch.length; start += 100) {
    const { error } = await supabase.from('assessment_mark_import_rows').insert(rowsWithBatch.slice(start, start + 100));
    if (error) return { status: 'error', message: `Unable to stage workbook rows: ${error.message}` };
  }
  return { status: 'success', message: importPhase === 'cat' ? 'CAT marks validated.' : 'Final exam workbook validated.', batchId: batch.id };
}

export async function commitAssessmentMarksAction(formData: FormData) {
  await requireHodAccess();
  const batchId = text(formData, 'batchId');
  const assessmentId = text(formData, 'assessmentId');
  if (!batchId || !assessmentId) return;
  const assessment = await getAssessmentById(assessmentId);
  if (!assessment) redirect('/assessment/marks?error=not-found');
  if (assessment.exam_marks_finalized_at) redirect(`/assessment/marks/${assessmentId}?error=locked`);

  const supabase = await createClient();
  const { data: batch, error: batchLookupError } = await supabase
    .from('assessment_mark_import_batches')
    .select('id, assessment_event_id, invalid_rows, status, import_phase')
    .eq('id', batchId)
    .eq('assessment_event_id', assessmentId)
    .maybeSingle();

  if (batchLookupError || !batch) redirect(`/assessment/marks/${assessmentId}?error=batch`);
  if (batch.invalid_rows > 0 || batch.status !== 'staged') {
    redirect(`/assessment/marks/${assessmentId}?error=batch`);
  }
  if (batch.import_phase === 'exam' && !assessment.attendance_finalized_at) {
    redirect(`/assessment/marks/${assessmentId}?error=attendance-required`);
  }

  const { error } = await supabase.rpc('commit_assessment_mark_import_batch', { target_batch_id: batchId });
  revalidatePath('/assessment');
  revalidatePath('/assessment/marks');
  revalidatePath('/assessment/analysis');
  revalidatePath(`/assessment/marks/${assessmentId}`);
  if (error) redirect(`/assessment/marks/import/${batchId}?error=commit`);
  redirect(`/assessment/marks/${assessmentId}?imported=1`);
}
