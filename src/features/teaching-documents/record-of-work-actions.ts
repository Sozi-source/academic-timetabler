'use server';

import { revalidatePath } from 'next/cache';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  TVETDocumentHeaderContext,
  TVETRecordOfWorkEntry,
} from './tvet-standards';

type Relation<T> = T | T[] | null;
function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getDocumentHeaderContext(
  allocationId: string
): Promise<TVETDocumentHeaderContext | null> {
  const profile = await requireTrainerAccess();
  const admin = createAdminClient();

  // 1. Fetch allocation and metadata — use REAL column names from the schema
  const { data: allocation, error } = await admin
    .from('teaching_allocations')
    .select(`
      id,
      unit_id,
      cohort_id,
      academic_period_id,
      weekly_sessions,
      session_duration_minutes,
      trainer_id,
      units (id, code, name, weekly_sessions),
      cohorts (id, code, name),
      academic_periods (id, code, name),
      trainers (id, full_name, email)
    `)
    .eq('id', allocationId)
    .maybeSingle();

  let targetAllocation = allocation;

  if (error || !targetAllocation) {
    // Fallback: fetch allocation without joins, then resolve each FK individually
    const { data: basicAlloc } = await admin
      .from('teaching_allocations')
      .select('id, unit_id, cohort_id, academic_period_id, weekly_sessions, session_duration_minutes, trainer_id')
      .eq('id', allocationId)
      .maybeSingle();

    if (!basicAlloc) {
      return null;
    }

    targetAllocation = basicAlloc as typeof allocation;
  }

  if (!targetAllocation) {
    return null;
  }

  // 2. Ownership Verification:
  // Trainers can only access their own allocated units (HODs & Admins can access all for oversight)
  if (profile.role === 'trainer') {
    const { data: trainerRec } = await admin
      .from('trainers')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!trainerRec || targetAllocation.trainer_id !== trainerRec.id) {
      return null;
    }
  }

  // 3. Resolve Relations safely
  const rawUnit = (targetAllocation as Record<string, unknown>).units ?? (targetAllocation as Record<string, unknown>).unit;
  let unit = one(rawUnit as Relation<{ id: string; code: string; name: string; weekly_sessions?: number }>);
  if (!unit && targetAllocation.unit_id) {
    const { data: directUnit } = await admin
      .from('units')
      .select('id, code, name, weekly_sessions')
      .eq('id', targetAllocation.unit_id)
      .maybeSingle();
    unit = directUnit;
  }

  const rawCohort = (targetAllocation as Record<string, unknown>).cohorts ?? (targetAllocation as Record<string, unknown>).cohort;
  let cohort = one(rawCohort as Relation<{ id: string; code?: string; name: string }>);
  if (!cohort && targetAllocation.cohort_id) {
    const { data: directCohort } = await admin
      .from('cohorts')
      .select('id, code, name')
      .eq('id', targetAllocation.cohort_id)
      .maybeSingle();
    cohort = directCohort;
  }

  const rawPeriod = (targetAllocation as Record<string, unknown>).academic_periods ?? (targetAllocation as Record<string, unknown>).academic_period;
  let period = one(rawPeriod as Relation<{ id: string; code?: string; name: string }>);
  if (!period && targetAllocation.academic_period_id) {
    const { data: directPeriod } = await admin
      .from('academic_periods')
      .select('id, code, name')
      .eq('id', targetAllocation.academic_period_id)
      .maybeSingle();
    period = directPeriod;
  }

  const rawTrainer = (targetAllocation as Record<string, unknown>).trainers ?? (targetAllocation as Record<string, unknown>).trainer;
  let trainer = one(rawTrainer as Relation<{ id: string; full_name: string; email?: string }>);
  if (!trainer && targetAllocation.trainer_id) {
    const { data: directTrainer } = await admin
      .from('trainers')
      .select('id, full_name, email')
      .eq('id', targetAllocation.trainer_id)
      .maybeSingle();
    trainer = directTrainer;
  }

  const deptName = profile.departmentName ?? 'Department';
  const weeklySessionCount = Number(targetAllocation.weekly_sessions) || (unit?.weekly_sessions ?? 2);
  const sessionDurationHrs = (Number(targetAllocation.session_duration_minutes) || 120) / 60;
  const weeklyHours = weeklySessionCount * sessionDurationHrs;

  const header: TVETDocumentHeaderContext = {
    institutionName: 'Imperial College of Medical & Health Sciences',
    departmentName: deptName,
    academicPeriodName: period?.name ?? 'Current Semester',
    unitCode: unit?.code ?? 'UNIT',
    unitName: unit?.name ?? 'Unit Name',
    cohortName: cohort?.name ?? 'Cohort',
    trainerName: trainer?.full_name ?? profile.fullName ?? 'Trainer',
    trainerEmail: trainer?.email ?? profile.email ?? '',
    totalNominalHours: weeklyHours * 14,
    weeklyHours,
  };

  // Preload DB-persisted curriculum definitions for this unit code.
  // Record of Work tracks actual delivery against the Scheme of Work's
  // planned weekly topics, so it must load the scheme_of_work variant
  // specifically — not whatever shared/course_outline entry happened to exist.
  const { loadPersistedUnitCurriculum } = await import('./curriculum-registry');
  await loadPersistedUnitCurriculum(header.unitCode, header.unitName, 'scheme_of_work');

  return header;
}

export async function getRecordOfWorkContext(allocationId: string): Promise<{
  header: TVETDocumentHeaderContext;
  entries: TVETRecordOfWorkEntry[];
} | null> {
  const header = await getDocumentHeaderContext(allocationId);
  if (!header) {
    return null;
  }

  const admin = createAdminClient();

  // Fetch or initialize record of work document
  const { data: doc } = await admin
    .from('teaching_documents')
    .select('id, storage_path, original_filename')
    .eq('allocation_id', allocationId)
    .eq('document_type', 'record_of_work')
    .maybeSingle();

  let entries: TVETRecordOfWorkEntry[] = [];

  if (doc?.original_filename) {
    try {
      const parsed = JSON.parse(doc.original_filename);
      if (Array.isArray(parsed)) {
        entries = parsed;
      }
    } catch {
      entries = [];
    }
  }

  return {
    header,
    entries,
  };
}

export async function addRecordOfWorkEntryAction(
  allocationId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireTrainerAccess();
  const admin = createAdminClient();

  const weekNumber = Number(formData.get('weekNumber'));
  const sessionDate = String(formData.get('sessionDate') || '').trim();
  const workCovered = String(formData.get('workCovered') || '').trim();
  const outcomesAchieved = String(formData.get('outcomesAchieved') || '').trim();
  const attendanceSummary = String(formData.get('attendanceSummary') || '').trim();
  const remarks = String(formData.get('remarks') || '').trim();

  if (!weekNumber || weekNumber < 1 || weekNumber > 14) {
    return { ok: false, error: 'Week number must be between 1 and 14.' };
  }
  if (!sessionDate) {
    return { ok: false, error: 'Session date is required.' };
  }
  if (!workCovered) {
    return { ok: false, error: 'Work covered description is required.' };
  }

  const context = await getRecordOfWorkContext(allocationId);
  if (!context) {
    return { ok: false, error: 'Allocation not found.' };
  }

  const newEntry: TVETRecordOfWorkEntry = {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    allocationId,
    weekNumber,
    sessionDate,
    workCovered,
    outcomesAchieved: outcomesAchieved || 'Competencies achieved in accordance with syllabus.',
    attendanceSummary: attendanceSummary || 'Recorded in class attendance sheet.',
    remarks: remarks || 'Delivered as scheduled.',
    trainerSignature: context.header.trainerName,
    signedAt: new Date().toISOString(),
    hodStatus: 'pending',
  };

  const updatedEntries = [...context.entries, newEntry];

  // Fetch or upsert teaching document row
  const { data: existingDoc } = await admin
    .from('teaching_documents')
    .select('id, template_id')
    .eq('allocation_id', allocationId)
    .eq('document_type', 'record_of_work')
    .maybeSingle();

  // Find template id
  const { data: template } = await admin
    .from('teaching_document_templates')
    .select('id')
    .eq('document_type', 'record_of_work')
    .limit(1)
    .maybeSingle();

  const payloadString = JSON.stringify(updatedEntries);

  if (existingDoc) {
    await admin
      .from('teaching_documents')
      .update({
        original_filename: payloadString,
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      })
      .eq('id', existingDoc.id);
  } else if (template) {
    // Get allocation row to get period_id, cohort_id, unit_id, trainer_id
    const { data: alloc } = await admin
      .from('teaching_allocations')
      .select('academic_period_id, cohort_id, unit_id, trainer_id')
      .eq('id', allocationId)
      .single();

    if (alloc) {
      await admin.from('teaching_documents').insert({
        allocation_id: allocationId,
        academic_period_id: alloc.academic_period_id,
        cohort_id: alloc.cohort_id,
        unit_id: alloc.unit_id,
        trainer_id: alloc.trainer_id ?? profile.id,
        document_type: 'record_of_work',
        template_id: template.id,
        version_number: 1,
        status: 'draft',
        original_filename: payloadString,
        created_by: profile.id,
        updated_by: profile.id,
      });
    }
  }

  revalidatePath(`/staff/units/${allocationId}/documents`);
  revalidatePath(`/staff/units/${allocationId}/documents/record-of-work`);
  return { ok: true };
}

export async function deleteRecordOfWorkEntryAction(
  allocationId: string,
  entryId: string
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireTrainerAccess();
  const admin = createAdminClient();

  const context = await getRecordOfWorkContext(allocationId);
  if (!context) {
    return { ok: false, error: 'Allocation not found.' };
  }

  const updatedEntries = context.entries.filter((e) => e.id !== entryId);
  const payloadString = JSON.stringify(updatedEntries);

  const { data: existingDoc } = await admin
    .from('teaching_documents')
    .select('id')
    .eq('allocation_id', allocationId)
    .eq('document_type', 'record_of_work')
    .maybeSingle();

  if (existingDoc) {
    await admin
      .from('teaching_documents')
      .update({
        original_filename: payloadString,
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      })
      .eq('id', existingDoc.id);
  }

  revalidatePath(`/staff/units/${allocationId}/documents`);
  revalidatePath(`/staff/units/${allocationId}/documents/record-of-work`);
  return { ok: true };
}

export async function generateRecordOfWorkFromSchemeAction(
  allocationId: string
): Promise<{ ok: boolean; count: number; error?: string }> {
  const profile = await requireTrainerAccess();
  const admin = createAdminClient();

  const context = await getRecordOfWorkContext(allocationId);
  if (!context) {
    return { ok: false, count: 0, error: 'Allocation not found.' };
  }

  // Import Scheme generator
  const { generateTVETSchemeOfWork } = await import('./tvet-standards');
  const scheme = generateTVETSchemeOfWork(context.header);

  // Generate 14-week entries from Scheme of Work
  const generatedEntries: TVETRecordOfWorkEntry[] = scheme.plannedWeeks.map(
    (week, i) => ({
      id: `row-gen-${Date.now()}-${i + 1}`,
      allocationId,
      weekNumber: week.weekNumber,
      sessionDate: new Date(Date.now() + i * 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      workCovered: `${week.topic}: ${week.subTopics}`,
      outcomesAchieved: week.specificLearningOutcomes,
      attendanceSummary: 'Recorded in attendance sheet',
      remarks: week.assessmentAndRemarks || 'Delivered as scheduled',
      trainerSignature: context.header.trainerName,
      signedAt: new Date().toISOString(),
      hodStatus: 'pending',
    })
  );

  const payloadString = JSON.stringify(generatedEntries);

  const { data: existingDoc } = await admin
    .from('teaching_documents')
    .select('id')
    .eq('allocation_id', allocationId)
    .eq('document_type', 'record_of_work')
    .maybeSingle();

  if (existingDoc) {
    await admin
      .from('teaching_documents')
      .update({
        original_filename: payloadString,
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      })
      .eq('id', existingDoc.id);
  } else {
    const { data: template } = await admin
      .from('teaching_document_templates')
      .select('id')
      .eq('document_type', 'record_of_work')
      .limit(1)
      .maybeSingle();

    const { data: alloc } = await admin
      .from('teaching_allocations')
      .select('academic_period_id, cohort_id, unit_id, trainer_id')
      .eq('id', allocationId)
      .single();

    if (alloc && template) {
      await admin.from('teaching_documents').insert({
        allocation_id: allocationId,
        academic_period_id: alloc.academic_period_id,
        cohort_id: alloc.cohort_id,
        unit_id: alloc.unit_id,
        trainer_id: alloc.trainer_id ?? profile.id,
        document_type: 'record_of_work',
        template_id: template.id,
        version_number: 1,
        status: 'draft',
        original_filename: payloadString,
        created_by: profile.id,
        updated_by: profile.id,
      });
    }
  }

  revalidatePath(`/staff/units/${allocationId}/documents`);
  revalidatePath(`/staff/units/${allocationId}/documents/record-of-work`);
  return { ok: true, count: generatedEntries.length };
}

