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

export async function getRecordOfWorkContext(allocationId: string): Promise<{
  header: TVETDocumentHeaderContext;
  entries: TVETRecordOfWorkEntry[];
} | null> {
  const profile = await requireTrainerAccess();
  const admin = createAdminClient();

  // 1. Fetch allocation and metadata
  const { data: allocation, error } = await admin
    .from('teaching_allocations')
    .select(`
      id,
      unit_id,
      cohort_id,
      academic_period_id,
      weekly_hours,
      trainer_id,
      unit:units(id, code, name, weekly_session_count),
      cohort:cohorts(id, code, name, programme:programmes(name, department:departments(name))),
      academic_period:academic_periods(id, code, name),
      trainer:trainers(id, full_name, email)
    `)
    .eq('id', allocationId)
    .maybeSingle();

  if (error || !allocation) {
    return null;
  }

  const unit = one(allocation.unit as Relation<{ id: string; code: string; name: string; weekly_session_count: number }>);
  const cohort = one(allocation.cohort as Relation<{
    id: string;
    code: string;
    name: string;
    programme: Relation<{ name: string; department: Relation<{ name: string }> }>;
  }>);
  const period = one(allocation.academic_period as Relation<{ id: string; code: string; name: string }>);
  const trainer = one(allocation.trainer as Relation<{ id: string; full_name: string; email?: string }>);

  const deptName = one(one(cohort?.programme)?.department)?.name ?? profile.departmentName ?? 'Department';
  const weeklyHours = Number(allocation.weekly_hours) || (unit?.weekly_session_count ? unit.weekly_session_count * 2 : 4);

  const header: TVETDocumentHeaderContext = {
    institutionName: 'Academic Planner TVET Institute',
    departmentName: deptName,
    academicPeriodName: period?.name ?? 'Current Semester',
    unitCode: unit?.code ?? 'Unit Code',
    unitName: unit?.name ?? 'Unit Name',
    cohortName: cohort?.name ?? 'Cohort',
    trainerName: trainer?.full_name ?? profile.fullName ?? 'Trainer',
    trainerEmail: trainer?.email ?? profile.email ?? '',
    totalNominalHours: weeklyHours * 14,
    weeklyHours,
  };

  // 2. Fetch or initialize record of work document
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

