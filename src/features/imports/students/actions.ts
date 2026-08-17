'use server';

import { revalidatePath } from 'next/cache';
import { requireHodAccess } from '@/features/auth/authorization';
import { ImportWorkbookError, markDuplicateImportRows, validateImportFileDescriptor, validateParsedImportRow } from '@/features/imports';
import { studentsImportTemplate } from '@/features/imports/templates/students';
import { readImportWorkbook } from '@/features/imports/workbook-reader';
import { inferStudentAdmissionNumber } from '@/features/students/admission-number';
import { createClient } from '@/lib/supabase/server';
import type { NormalizedStudentImportRow, RawStudentImportRow, StudentImportActionState, StudentImportRpcResult } from './types';
import { studentImportBaseSchema } from './validation';

function key(value: string) { return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function duplicateKey(admissionNumber: string) { return `student:${admissionNumber.trim().toUpperCase()}`; }

function intakeMonth(intakeLabel: string | null) {
  if (intakeLabel === 'JAN') return 1;
  if (intakeLabel === 'MAR') return 3;
  if (intakeLabel === 'MAY') return 5;
  if (intakeLabel === 'SEP') return 9;
  return null;
}

function isoDate(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function addReferenceYear(year: number, month: number) {
  return `${year + 1}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Student history can pre-date timetable master data by many years. During
 * staging we provision only the minimum reference records needed to preserve
 * that history. Reference programmes are deliberately non-timetable records
 * and carry an explicit review note; they must be completed in Programme
 * Setup before they are used for live scheduling.
 */
async function ensureHistoricalStudentMasterData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departmentId: string,
  rows: Array<{ status: string; normalizedData: RawStudentImportRow | null }>,
) {
  const evidence = rows.flatMap((row) => {
    if (row.status !== 'valid' || !row.normalizedData) return [];
    const inference = inferStudentAdmissionNumber(row.normalizedData.admissionNumber);
    const programmeCode = row.normalizedData.programmeCode?.trim().toUpperCase() || inference.programmeCode;
    const month = intakeMonth(inference.intakeLabel);
    if (!programmeCode || !month || !inference.admissionYear || !inference.intakeLabel) return [];
    return [{
      programmeCode,
      month,
      year: inference.admissionYear,
      intakeLabel: inference.intakeLabel,
      progressionGroupLabel: inference.progressionGroupLabel,
      lifecycleStatus: row.normalizedData.lifecycleStatus,
    }];
  });

  if (!evidence.length) return;

  const requiredCodes = [...new Set(evidence.map((item) => item.programmeCode))];
  const { data: currentProgrammes, error: programmeReadError } = await supabase
    .from('programmes')
    .select('id,code')
    .eq('department_id', departmentId);
  if (programmeReadError) throw new Error(programmeReadError.message);

  const existingCodes = new Set((currentProgrammes ?? []).map((programme) => key(programme.code)));
  const missingCodes = requiredCodes.filter((code) => !existingCodes.has(key(code)));

  if (missingCodes.length) {
    const { error } = await supabase.from('programmes').insert(missingCodes.map((code) => ({
      department_id: departmentId,
      code,
      name: `Reference programme ${code}`,
      short_name: code,
      award_level: 'other',
      duration_value: 1,
      duration_unit: 'years',
      total_academic_periods: 1,
      is_active: true,
      is_timetable_available: false,
      notes: 'Created automatically from historical student admission data. Review the official programme name, award level, duration and academic periods before enabling this programme for live academic operations.',
    })));
    if (error) throw new Error(error.message);
  }

  const { data: programmes, error: refreshedProgrammeError } = await supabase
    .from('programmes')
    .select('id,code')
    .eq('department_id', departmentId);
  if (refreshedProgrammeError) throw new Error(refreshedProgrammeError.message);
  const programmeByCode = new Map((programmes ?? []).map((programme) => [key(programme.code), programme]));

  const { data: currentCohorts, error: cohortReadError } = await supabase
    .from('cohorts')
    .select('programme_id,code,name');
  if (cohortReadError) throw new Error(cohortReadError.message);
  const existingCohortCodes = new Set((currentCohorts ?? []).map((cohort) => key(cohort.code)));
  const existingProgrammeCohortNames = new Set(
    (currentCohorts ?? []).map((cohort) => `${cohort.programme_id}:${key(cohort.name)}`),
  );

  type RequiredCohort = {
    programmeId: string;
    programmeCode: string;
    code: string;
    name: string;
    intakeDate: string;
    completionMonth: number;
    year: number;
    active: boolean;
    kind: 'admission' | 'progression';
  };

  const requiredCohorts = new Map<string, RequiredCohort>();
  const addRequired = (item: RequiredCohort) => {
    const cohortKey = key(item.code);
    const existing = requiredCohorts.get(cohortKey);
    requiredCohorts.set(cohortKey, { ...item, active: Boolean(existing?.active || item.active) });
  };

  for (const item of evidence) {
    const programme = programmeByCode.get(key(item.programmeCode));
    if (!programme) continue;
    const isActive = item.lifecycleStatus === 'active' || item.lifecycleStatus === 'deferred';
    const shortYear = String(item.year).slice(-2);

    // Preserve the true historical admission intake.
    addRequired({
      programmeId: programme.id,
      programmeCode: item.programmeCode,
      code: `${item.programmeCode}-${item.intakeLabel}-${item.year}`,
      name: `${item.programmeCode} ${item.intakeLabel} ${shortYear}`,
      intakeDate: isoDate(item.year, item.month),
      completionMonth: item.intakeLabel === 'JAN' || item.intakeLabel === 'MAR' ? 1 : item.month,
      year: item.year,
      active: isActive,
      kind: 'admission',
    });

    // January and March share one operational progression group while their
    // admission cohorts remain distinct for history and reporting.
    if (item.progressionGroupLabel === 'JAN-MAR') {
      addRequired({
        programmeId: programme.id,
        programmeCode: item.programmeCode,
        code: `${item.programmeCode}-JAN-MAR-${item.year}`,
        name: `${item.programmeCode} JAN/MAR ${shortYear}`,
        intakeDate: isoDate(item.year, 1),
        completionMonth: 1,
        year: item.year,
        active: isActive,
        kind: 'progression',
      });
    }
  }

  const inserts = [...requiredCohorts.values()]
    .filter((item) =>
      !existingCohortCodes.has(key(item.code)) &&
      !existingProgrammeCohortNames.has(`${item.programmeId}:${key(item.name)}`),
    )
    .map((item) => ({
      programme_id: item.programmeId,
      code: item.code,
      name: item.name,
      intake_date: item.intakeDate,
      expected_completion_date: addReferenceYear(item.year, item.completionMonth),
      current_academic_period_number: 1,
      actual_size: 0,
      status: item.active ? 'active' : 'archived',
      is_timetable_available: false,
      notes: item.kind === 'progression'
        ? 'JAN/MAR progression group created from departmental intake rules. January and March admission cohorts remain distinct, but share this operational academic timeline. Review official duration and academic-period metadata before live timetable use.'
        : 'Reference admission cohort created automatically from historical student admission data. Review expected completion and academic-period metadata before live timetable use.',
    }));

  if (inserts.length) {
    const { error } = await supabase.from('cohorts').insert(inserts);
    if (error) throw new Error(error.message);
  }
}

export async function stageStudentImportAction(_previousState: StudentImportActionState, formData: FormData): Promise<StudentImportActionState> {
  const profile = await requireHodAccess();
  const uploadedFile = formData.get('workbook');
  if (!(uploadedFile instanceof File)) return { status: 'error', message: 'Select a Students Excel workbook.' };

  try { validateImportFileDescriptor({ name: uploadedFile.name, size: uploadedFile.size, type: uploadedFile.type }); }
  catch (error) {
    if (error instanceof ImportWorkbookError) return { status: 'error', message: error.message, details: error.details };
    return { status: 'error', message: 'The selected workbook could not be validated.' };
  }

  let workbook;
  try { workbook = await readImportWorkbook({ fileName: uploadedFile.name, buffer: await uploadedFile.arrayBuffer(), definition: studentsImportTemplate }); }
  catch (error) {
    if (error instanceof ImportWorkbookError) return { status: 'error', message: error.message, details: error.details };
    return { status: 'error', message: 'The workbook could not be read.' };
  }

  const baseResults = markDuplicateImportRows<RawStudentImportRow>(workbook.rows.map((row) => validateParsedImportRow<RawStudentImportRow>({
    row, schema: studentImportBaseSchema, duplicateKey: (student) => duplicateKey(student.admissionNumber),
  })));

  const supabase = await createClient();

  try {
    await ensureHistoricalStudentMasterData(
      supabase,
      profile.activeDepartmentId,
      baseResults.map((result) => ({ status: result.status, normalizedData: result.normalizedData ?? null })),
    );
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Historical programme and cohort reference data could not be prepared.',
    };
  }

  const [{ data: programmes, error: programmeError }, { data: cohorts, error: cohortError }, { data: existing, error: studentError }] = await Promise.all([
    supabase.from('programmes').select('id,code,name,department_id').eq('department_id', profile.activeDepartmentId),
    supabase.from('cohorts').select('id,code,name,programme_id,intake_date'),
    supabase.from('students').select('admission_number').eq('department_id', profile.activeDepartmentId),
  ]);

  if (programmeError || cohortError || studentError) return { status: 'error', message: programmeError?.message ?? cohortError?.message ?? studentError?.message ?? 'Student reference data could not be loaded.' };

  const programmeByCode = new Map((programmes ?? []).map((p) => [key(p.code), p]));
  const existingAdmissionNumbers = new Set((existing ?? []).map((s) => s.admission_number.trim().toUpperCase()));

  const resolved = baseResults.map((result) => {
    if (result.status !== 'valid' || !result.normalizedData) return result as typeof result & { normalizedData: NormalizedStudentImportRow | null };
    const raw = result.normalizedData;
    const inference = inferStudentAdmissionNumber(raw.admissionNumber);
    const programmeCode = raw.programmeCode?.trim().toUpperCase() || inference.programmeCode;
    const programme = programmeCode ? programmeByCode.get(key(programmeCode)) : undefined;

    if (!programme) {
      result.status = 'invalid';
      result.fieldErrors.programmeCode = [raw.programmeCode ? 'No programme in the active department matches this code.' : 'Programme could not be inferred safely from the admission number. Enter Programme Code explicitly.'];
      return result as typeof result & { normalizedData: NormalizedStudentImportRow | null };
    }

    const programmeCohorts = (cohorts ?? []).filter((cohort) => cohort.programme_id === programme.id);
    let admissionCohort;
    let admissionSource: 'explicit' | 'inferred' = 'explicit';

    if (raw.admissionCohortCode) {
      admissionCohort = programmeCohorts.find((cohort) => key(cohort.code) === key(raw.admissionCohortCode!) || key(cohort.name) === key(raw.admissionCohortCode!));
    } else {
      admissionSource = 'inferred';
      const inferredAdmissionCode = inference.intakeLabel && inference.admissionYear
        ? `${programme.code}-${inference.intakeLabel}-${inference.admissionYear}`
        : null;
      admissionCohort = inferredAdmissionCode
        ? programmeCohorts.find((cohort) => key(cohort.code) === key(inferredAdmissionCode))
        : undefined;

      if (!admissionCohort) {
        const month = intakeMonth(inference.intakeLabel);
        admissionCohort = programmeCohorts.find((cohort) => {
          if (!cohort.intake_date || !month || !inference.admissionYear) return false;
          const [year, cohortMonth] = cohort.intake_date.split('-').map(Number);
          return year === inference.admissionYear && cohortMonth === month && !key(cohort.code).includes('JANMAR');
        });
      }
    }

    if (!admissionCohort) {
      result.status = 'invalid';
      result.fieldErrors.admissionCohortCode = [raw.admissionCohortCode ? 'No cohort in the resolved programme matches this admission cohort.' : 'Admission cohort could not be matched safely. Enter Admission Cohort Code explicitly or create the cohort first.'];
      return result as typeof result & { normalizedData: NormalizedStudentImportRow | null };
    }

    let currentCohort = admissionCohort;
    let currentSource: 'explicit' | 'admission_default' | 'progression_group' = 'admission_default';
    let resolvedCurrentEffectiveDate = raw.currentCohortEffectiveDate;

    if (raw.currentCohortCode) {
      currentSource = 'explicit';
      const matchedCurrentCohort = programmeCohorts.find((cohort) => key(cohort.code) === key(raw.currentCohortCode!) || key(cohort.name) === key(raw.currentCohortCode!));
      if (!matchedCurrentCohort) {
        result.status = 'invalid';
        result.fieldErrors.currentCohortCode = ['Current Cohort Code does not match a cohort in the resolved programme.'];
        return result as typeof result & { normalizedData: NormalizedStudentImportRow | null };
      }
      currentCohort = matchedCurrentCohort;
    } else if (inference.progressionGroupLabel === 'JAN-MAR' && inference.admissionYear && inference.intakeLabel) {
      const progressionCode = `${programme.code}-JAN-MAR-${inference.admissionYear}`;
      const progressionCohort = programmeCohorts.find((cohort) => key(cohort.code) === key(progressionCode));
      if (progressionCohort) {
        currentCohort = progressionCohort;
        currentSource = 'progression_group';
        const intakeMonthValue = intakeMonth(inference.intakeLabel);
        resolvedCurrentEffectiveDate = intakeMonthValue
          ? isoDate(inference.admissionYear, intakeMonthValue)
          : raw.currentCohortEffectiveDate;
      }
    }

    if (currentCohort.id !== admissionCohort.id && currentSource === 'explicit' && !resolvedCurrentEffectiveDate) {
      result.status = 'invalid';
      result.fieldErrors.currentCohortEffectiveDate = ['Provide the effective date when the current cohort differs from the admission cohort.'];
      return result as typeof result & { normalizedData: NormalizedStudentImportRow | null };
    }

    const requiredPhase = raw.lifecycleStatus === 'deferred'
      ? 'deferred'
      : raw.lifecycleStatus === 'dropped_out'
        ? 'dropped_out'
      : raw.lifecycleStatus === 'completed'
        ? 'awaiting_graduation'
        : raw.lifecycleStatus === 'graduated'
          ? 'graduated'
          : raw.academicPhase;

    if (raw.lifecycleStatus === 'active' && !['in_class', 'clinical_rotation', 'attachment'].includes(raw.academicPhase)) {
      result.status = 'invalid';
      result.fieldErrors.academicPhase = ['Active students must be in class, clinical rotation or attachment.'];
      return result as typeof result & { normalizedData: NormalizedStudentImportRow | null };
    }

    if (existingAdmissionNumbers.has(raw.admissionNumber.trim().toUpperCase())) {
      result.status = 'duplicate';
      result.rowErrors.push('A student with this admission number already exists in the active department.');
    }

    const normalized: NormalizedStudentImportRow = {
      ...raw,
      academicPhase: requiredPhase,
      currentCohortEffectiveDate: resolvedCurrentEffectiveDate,
      programmeCode: raw.programmeCode?.trim().toUpperCase(),
      admissionCohortCode: raw.admissionCohortCode?.trim().toUpperCase(),
      currentCohortCode: raw.currentCohortCode?.trim().toUpperCase(),
      programmeId: programme.id,
      resolvedProgrammeCode: programme.code,
      admissionCohortId: admissionCohort.id,
      resolvedAdmissionCohortCode: admissionCohort.code,
      currentCohortId: currentCohort.id,
      resolvedCurrentCohortCode: currentCohort.code,
      inference,
      resolutionSource: {
        programme: raw.programmeCode ? 'explicit' : 'inferred',
        admissionCohort: admissionSource,
        currentCohort: currentSource,
      },
    };

    return { ...result, normalizedData: normalized };
  });

  const { data: batch, error: batchError } = await supabase.from('import_batches').insert({
    entity_type: 'students', department_id: profile.activeDepartmentId, template_version: workbook.metadata.templateVersion,
    original_file_name: workbook.fileName, file_size_bytes: workbook.fileSizeBytes, status: 'validating',
    validation_summary: { warnings: workbook.warnings, inferencePolicy: 'suggest-and-validate' }, import_options: { duplicateStrategy: 'skip' },
  }).select('id').single();
  if (batchError || !batch) return { status: 'error', message: batchError?.message ?? 'The student import batch could not be created.' };

  const { error: rowsError } = await supabase.from('import_rows').insert(resolved.map((result) => ({
    import_batch_id: batch.id, source_row_number: result.sourceRowNumber, status: result.status,
    source_data: result.sourceData, normalized_data: result.normalizedData ?? {}, field_errors: result.fieldErrors,
    row_errors: result.rowErrors, duplicate_key: result.duplicateKey,
  })));
  if (rowsError) {
    await supabase.from('import_batches').update({ status: 'failed', failure_message: rowsError.message }).eq('id', batch.id);
    return { status: 'error', message: `Validated student rows could not be staged: ${rowsError.message}` };
  }

  const { error: finalizeError } = await supabase.from('import_batches').update({ status: 'validated', validation_summary: { warnings: workbook.warnings, validatedAt: new Date().toISOString(), inferencePolicy: 'suggest-and-validate' } }).eq('id', batch.id);
  if (finalizeError) return { status: 'error', message: `The student import batch could not be finalized: ${finalizeError.message}` };

  revalidatePath(`/students/registry/import/${batch.id}`);
  return { status: 'success', message: 'Workbook validated. Review inferred and explicit cohort assignments before import.', batchId: batch.id };
}

const STUDENT_IMPORT_BATCH_SIZE = 25;
const STUDENT_IMPORT_MAX_BATCH_CALLS = 100;

export async function confirmStudentImportAction(_previousState: StudentImportActionState, formData: FormData): Promise<StudentImportActionState> {
  await requireHodAccess();
  const batchId = formData.get('batchId');
  if (typeof batchId !== 'string' || !batchId.trim()) return { status: 'error', message: 'The student import batch identifier is invalid.' };

  const supabase = await createClient();
  let result: StudentImportRpcResult | null = null;
  let previousRemaining: number | null = null;

  for (let call = 0; call < STUDENT_IMPORT_MAX_BATCH_CALLS; call += 1) {
    const { data, error } = await supabase.rpc('import_student_rows_batch', {
      target_batch_id: batchId,
      requested_batch_size: STUDENT_IMPORT_BATCH_SIZE,
    });

    if (error) {
      const importedSoFar = result?.imported_count ?? 0;
      revalidatePath(`/students/registry/import/${batchId}`);
      return {
        status: 'error',
        message: importedSoFar > 0
          ? `Import paused safely after ${importedSoFar} student${importedSoFar === 1 ? '' : 's'}. Retry to continue.`
          : error.message || 'The student import could not be completed.',
        batchId,
        importedCount: importedSoFar,
        skippedCount: result?.skipped_count ?? 0,
        failedCount: result?.failed_count ?? 0,
      };
    }

    result = (Array.isArray(data) ? data[0] : data) as StudentImportRpcResult | null;
    if (!result) {
      return { status: 'error', message: 'The student import returned no batch result.', batchId };
    }

    if (result.completed || result.remaining_count === 0) break;

    if (previousRemaining !== null && result.remaining_count >= previousRemaining) {
      return {
        status: 'error',
        message: 'Import paused because no further rows were processed. Retry safely.',
        batchId,
        importedCount: result.imported_count,
        skippedCount: result.skipped_count,
        failedCount: result.failed_count,
      };
    }
    previousRemaining = result.remaining_count;
  }

  if (!result) {
    return { status: 'error', message: 'The student import returned no batch result.', batchId };
  }

  if (!result.completed && result.remaining_count > 0) {
    return {
      status: 'error',
      message: 'Import paused before all rows were processed. Retry safely to continue.',
      batchId,
      importedCount: result.imported_count,
      skippedCount: result.skipped_count,
      failedCount: result.failed_count,
    };
  }

  revalidatePath('/students');
  revalidatePath('/students/registry');
  revalidatePath(`/students/registry/import/${batchId}`);

  return {
    status: 'success',
    message: result.failed_count > 0
      ? `Import completed with ${result.failed_count} failed row${result.failed_count === 1 ? '' : 's'}.`
      : 'Student import completed.',
    batchId,
    importedCount: result.imported_count,
    skippedCount: result.skipped_count,
    failedCount: result.failed_count,
  };
}
