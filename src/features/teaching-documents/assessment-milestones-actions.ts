'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  AssessmentMilestones,
  DEFAULT_ASSESSMENT_MILESTONES,
} from './assessment-milestones';

const CONFIG_KEY = 'cfg-assessment-milestones';

/**
 * Server action for Admin/HOD to update assessment milestone weeks.
 */
export async function saveAssessmentMilestonesAction(formData: FormData) {
  const ratWeek = Number(formData.get('ratWeek')) || DEFAULT_ASSESSMENT_MILESTONES.ratWeek;
  const catWeek = Number(formData.get('catWeek')) || DEFAULT_ASSESSMENT_MILESTONES.catWeek;
  const examWeek = Number(formData.get('examWeek')) || DEFAULT_ASSESSMENT_MILESTONES.examWeek;
  const ratRemarks = String(formData.get('ratRemarks') || '').trim() || DEFAULT_ASSESSMENT_MILESTONES.ratRemarks;
  const catRemarks = String(formData.get('catRemarks') || '').trim() || DEFAULT_ASSESSMENT_MILESTONES.catRemarks;
  const examRemarks = String(formData.get('examRemarks') || '').trim() || DEFAULT_ASSESSMENT_MILESTONES.examRemarks;

  const config: AssessmentMilestones = {
    ratWeek,
    catWeek,
    examWeek,
    ratRemarks,
    catRemarks,
    examRemarks,
  };

  const admin = createAdminClient();
  const { error } = await admin.from('teaching_document_templates').upsert({
    id: CONFIG_KEY,
    document_type: 'course_outline',
    name: 'Assessment Milestones Config',
    version_number: 1,
    status: 'active',
    storage_bucket: 'teaching-documents',
    storage_path: 'config/assessment-milestones.json',
    original_filename: JSON.stringify(config),
    notes: `RAT: W${ratWeek} · CAT: W${catWeek} · Exam: W${examWeek}`,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to save assessment milestones: ${error.message}`);
  }

  revalidatePath('/teaching-documents/curriculum');
  revalidatePath('/staff/documents');
  revalidatePath('/staff/units/[allocationId]/documents/scheme-of-work', 'page');
  revalidatePath('/staff/units/[allocationId]/documents/course-outline', 'page');
}
